import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth, getUserId } from "./middleware/auth";
import {
  insertAgentSchema,
  insertKnowledgeDocumentSchema,
  insertConversationSchema,
  insertMessageSchema,
} from "@shared/schema";
import {
  generateAgentResponse,
  processKnowledgeDocument,
  findRelevantKnowledge,
} from "./gemini";
import * as cheerio from "cheerio";
import * as XLSX from "xlsx";
import multer from "multer";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to map Clerk user to local user record (auto-provision if missing)
  async function resolveUserId(req: any): Promise<string> {
    const clerkUserId = getUserId(req);
    if (!clerkUserId) throw new Error("Missing authenticated user");
    // Use clerkUserId as username/email placeholder (customize as needed)
    const existing = await storage.getUserByUsername(clerkUserId);
    if (existing) return existing.id;
    const created = await storage.createUser({
      username: clerkUserId,
      password: "oauth",
      email: `${clerkUserId}@example.com`, // placeholder; ideally fetch real email from Clerk API
    });
    return created.id;
  }

  // Agents routes
  app.get("/api/agents", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const agents = await storage.getAgents(userId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.delete(
    "/api/agents/:agentId/knowledge/:id",
    requireAuth(),
    async (req, res) => {
      try {
        const userId = await resolveUserId(req);
        const deleted = await storage.deleteKnowledgeDocument(
          req.params.id,
          userId
        );
        if (!deleted)
          return res.status(404).json({ message: "Document not found" });
        res.status(204).send();
      } catch (err) {
        console.error("Failed to delete knowledge document", err);
        res.status(500).json({ message: "Failed to delete document" });
      }
    }
  );

  app.get("/api/agents/:id", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const agent = await storage.getAgent(req.params.id, userId);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const agentData = insertAgentSchema.parse({
        ...req.body,
        userId,
      });
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", requireAuth(), async (req, res) => {
    try {
      const updateData = insertAgentSchema.partial().parse(req.body);
      const userId = await resolveUserId(req);
      const agent = await storage.updateAgent(
        req.params.id,
        updateData,
        userId
      );
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const deleted = await storage.deleteAgent(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Knowledge documents routes
  app.get("/api/agents/:agentId/knowledge", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const documents = await storage.getKnowledgeDocuments(
        req.params.agentId,
        userId
      );
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  app.post(
    "/api/agents/:agentId/knowledge",
    requireAuth(),
    upload.single("file"),
    async (req, res) => {
      try {
        const userId = await resolveUserId(req);
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const rawBuffer = req.file.buffer;

        // If the uploaded file contains NUL bytes, Postgres text columns will
        // reject the value with an "invalid byte sequence for encoding \"UTF8\""
        // error. Strip any NUL bytes before converting to string. For binary
        // files you may want to store as base64 or use a bytea column instead.
        let content: string;
        if (rawBuffer.includes(0)) {
          console.warn(
            `Uploaded file ${req.file.originalname} contains NUL bytes; stripping before DB insert.`
          );
          content = rawBuffer.toString("utf-8").replace(/\u0000/g, "");
        } else {
          content = rawBuffer.toString("utf-8");
        }

        // If PDF, try to extract text instead of using raw binary content
        let processedContent = content;
        // Excel (xlsx / xls) -> parse sheets to text
        if (
          req.file.mimetype ===
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          req.file.mimetype === "application/vnd.ms-excel"
        ) {
          try {
            const wb = XLSX.read(rawBuffer, { type: "buffer" });
            const sheetTexts: string[] = [];
            for (const sheetName of wb.SheetNames) {
              const sheet = wb.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              if (csv.trim()) sheetTexts.push(`# Sheet: ${sheetName}\n${csv}`);
            }
            if (sheetTexts.length) {
              processedContent = sheetTexts.join("\n\n");
            }
          } catch (e) {
            console.warn(
              "Failed to parse Excel file, falling back to raw text",
              e
            );
          }
        }
        try {
          if (req.file.mimetype === "application/pdf") {
            try {
              // Use pdfjs-dist directly and pass a Uint8Array (pdfjs expects typed array)
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");

              // Convert Buffer to Uint8Array in a safe way
              const uint8 = new Uint8Array(
                rawBuffer.buffer,
                rawBuffer.byteOffset,
                rawBuffer.byteLength
              );

              const loadingTask = pdfjs.getDocument({ data: uint8 });
              const pdf = await loadingTask.promise;
              let fullText = "";
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items
                  .map((it: any) => it.str || "")
                  .join(" ");
                fullText += strings + "\n\n";
              }
              if (fullText.trim()) {
                processedContent = fullText;
                console.info(
                  `PDF text extracted: length=${fullText.length} chars, pages=${pdf.numPages}`
                );
              } else {
                console.warn(
                  `PDF extraction produced empty text (pages=${pdf.numPages}). Rejecting upload.`
                );
                return res.status(400).json({ message: "Failed to extract text from PDF; please upload a searchable PDF." });
              }
            } catch (err) {
              // pdfjs-dist can warn about optional canvas polyfills (DOMMatrix/Path2D)
              // Installing `canvas` in the environment can silence those warnings but is optional.
              console.warn(
                "pdfjs-dist parse failed:",
                err
              );
              return res.status(400).json({ message: "Failed to parse PDF; please upload a searchable PDF or try a different file." });
            }
          }
        } catch (err) {
          console.warn(
            "Unexpected error parsing PDF:",
            err
          );
          return res.status(400).json({ message: "Failed to parse PDF; please upload a searchable PDF or try a different file." });
        }

        // Process the document with OpenAI
        const { summary, embedding } = await processKnowledgeDocument(
          processedContent
        );

        const docData = {
          agentId: req.params.agentId,
          userId,
          filename: req.file.originalname,
          content: processedContent,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
        };

        const document = await storage.createKnowledgeDocument(docData);

        // Update with embedding only if embedding data is valid
        if (Array.isArray(embedding) && embedding.length > 0) {
          await storage.updateKnowledgeDocument(document.id, {
            embedding: JSON.stringify(embedding),
            processed: true,
          });
        } else {
          console.warn(
            `processKnowledgeDocument returned empty embedding for file ${req.file.originalname}`
          );
          // leave processed = false so it won't be considered by the retriever
          await storage.updateKnowledgeDocument(document.id, {
            processed: false,
          });
        }

        res.status(201).json({ ...document, summary });
      } catch (error) {
        console.error("Error uploading knowledge document:", error);
        res
          .status(500)
          .json({ message: "Failed to upload knowledge document" });
      }
    }
  );

  // Knowledge URL ingestion
  app.post(
    "/api/agents/:agentId/knowledge/url",
    requireAuth(),
    async (req, res) => {
      try {
        const userId = await resolveUserId(req);
        const { url } = req.body as { url?: string };
        if (!url || !/^https?:\/\//i.test(url)) {
          return res.status(400).json({ message: "Invalid URL" });
        }
        const response = await fetch(url);
        if (!response.ok) {
          return res
            .status(400)
            .json({ message: `Failed to fetch URL: ${response.status}` });
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        // Remove script/style/noscript
        ["script", "style", "noscript"].forEach((tag) => $(tag).remove());
        const text = $("body").text().replace(/\s+/g, " ").trim();
        if (!text) {
          return res
            .status(400)
            .json({ message: "No readable text extracted" });
        }
        const truncated = text.slice(0, 150_000); // safety limit
        const { summary, embedding } = await processKnowledgeDocument(
          truncated
        );
        const filename = new URL(url).hostname + (new URL(url).pathname || "/");
        const docData = {
          agentId: req.params.agentId,
          userId,
          filename: `URL: ${filename}`,
          content: truncated,
          fileSize: Buffer.byteLength(truncated, "utf-8"),
          mimeType: "text/html",
        };
        const document = await storage.createKnowledgeDocument(docData);
        if (Array.isArray(embedding) && embedding.length > 0) {
          await storage.updateKnowledgeDocument(document.id, {
            embedding: JSON.stringify(embedding),
            processed: true,
          });
        } else {
          await storage.updateKnowledgeDocument(document.id, {
            processed: false,
          });
        }
        res.status(201).json({ ...document, summary });
      } catch (error) {
        console.error("Error ingesting URL:", error);
        res.status(500).json({ message: "Failed to ingest URL" });
      }
    }
  );

  // Conversations routes
  app.get("/api/conversations", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const agentId = req.query.agentId as string;
      const conversations = await storage.getConversations(userId, agentId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const conversationData = insertConversationSchema.parse({
        ...req.body,
        userId,
      });
      const conversation = await storage.createConversation(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const deleted = await storage.deleteConversation(req.params.id, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Messages routes
  app.get(
    "/api/conversations/:conversationId/messages",
    requireAuth(),
    async (req, res) => {
      try {
        const messages = await storage.getMessages(req.params.conversationId);
        res.json(messages);
      } catch (error) {
        res.status(500).json({ message: "Failed to fetch messages" });
      }
    }
  );

  app.post(
    "/api/conversations/:conversationId/messages",
    requireAuth(),
    async (req, res) => {
      try {
        const conversationId = req.params.conversationId;
        const { content, role } = req.body;
        const userId = await resolveUserId(req);

        // Store user message
        const userMessage = await storage.createMessage({
          conversationId,
          role: "user",
          content,
        });

        // If this is the first user message for the conversation and the
        // conversation has no title, set a short trimmed title from this
        // message (first 80 chars, trimmed to word boundary).
        try {
          const conversationRecord = await storage.getConversation(conversationId, userId);
          if (conversationRecord && (!conversationRecord.title || !conversationRecord.title.trim())) {
            // Count messages for this conversation to determine if first
            const msgs = await storage.getMessages(conversationId);
            const userMessagesCount = msgs.filter(m => m.role === 'user').length;
            if (userMessagesCount <= 1) {
              const trimmed = (content || "").trim().slice(0, 120);
              // try to cut at last space for nicer titles
              const lastSpace = trimmed.lastIndexOf(' ');
              const title = lastSpace > 20 ? trimmed.slice(0, lastSpace) : trimmed;
              await storage.updateConversation(conversationId, { title }, userId);
            }
          }
        } catch (e) {
          console.warn('Failed to set conversation title from first message', e);
        }

  // Get conversation and agent details
        const conversation = await storage.getConversation(
          conversationId,
          userId
        );
        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        const agent = await storage.getAgent(conversation.agentId, userId);
        if (!agent) {
          return res.status(404).json({ message: "Agent not found" });
        }

        // Get conversation history
        const allMessages = await storage.getMessages(conversationId);
        const chatHistory = allMessages.slice(-10).map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

        // Get relevant knowledge
        const knowledgeDocuments = await storage.getKnowledgeDocuments(
          agent.id,
          userId
        );
        console.debug(
          `Loaded ${knowledgeDocuments.length} knowledge documents for agent ${agent.id}`
        );
        const processedDocs = knowledgeDocuments
          .filter((doc) => doc.processed && doc.embedding)
          .map((doc) => ({ content: doc.content, embedding: doc.embedding! }));

        console.debug(
          `Processed docs with embeddings: ${processedDocs.length}`
        );

        const knowledgeContext = await findRelevantKnowledge(
          content,
          processedDocs
        );

        // Merge agent-level tone/response style into the system instructions so
        // the model adopts the configured personality for this agent.
        const toneInstr = agent.tone
          ? `Please adopt a ${agent.tone} tone when replying.`
          : "";
        const styleInstr = agent.responseStyle
          ? `Respond in a ${agent.responseStyle} style.`
          : "";
        const combinedSystemInstructions = [
          agent.systemInstructions,
          toneInstr,
          styleInstr,
        ]
          .filter(Boolean)
          .join("\n\n");

        // Generate agent response
        const response = await generateAgentResponse(
          combinedSystemInstructions,
          chatHistory,
          knowledgeContext
        );

        // Store agent response
        const assistantMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: response.content,
          metadata: {
            tokensUsed: response.tokensUsed,
            responseTime: response.responseTime,
            hasKnowledgeContext: !!knowledgeContext,
          },
        });

        res.json({
          userMessage,
          assistantMessage,
          metadata: {
            tokensUsed: response.tokensUsed,
            responseTime: response.responseTime,
          },
        });
      } catch (error) {
        console.error("Error creating message:", error);
        res.status(500).json({ message: "Failed to create message" });
      }
    }
  );

  // Statistics route
  app.get("/api/stats", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const stats = await storage.getAgentStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
