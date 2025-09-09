import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertKnowledgeDocumentSchema, insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { generateAgentResponse, processKnowledgeDocument, findRelevantKnowledge } from "./gemini";
import * as cheerio from "cheerio";
import * as XLSX from "xlsx";
import multer from "multer";
import { z } from "zod";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure a demo user exists for demo purposes (real apps should use proper auth).
  // We look up a user with username 'demo' and create it if missing, then use its id.
  let DEMO_USER_ID: string;
  try {
    const existing = await storage.getUserByUsername("demo");
    if (existing) {
      DEMO_USER_ID = existing.id;
    } else {
      const created = await storage.createUser({ username: "demo", password: "demo", email: "demo@example.com" });
      DEMO_USER_ID = created.id;
    }
  } catch (err) {
    // If user lookup/creation fails, rethrow so the server doesn't start in a broken state
    console.error("Failed to ensure demo user exists:", err);
    throw err;
  }

  // Agents routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents(DEMO_USER_ID);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.delete("/api/agents/:agentId/knowledge/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteKnowledgeDocument(req.params.id, DEMO_USER_ID);
      if (!deleted) return res.status(404).json({ message: "Document not found" });
      res.status(204).send();
    } catch (err) {
      console.error('Failed to delete knowledge document', err);
      res.status(500).json({ message: 'Failed to delete document' });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id, DEMO_USER_ID);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const agentData = insertAgentSchema.parse({
        ...req.body,
        userId: DEMO_USER_ID
      });
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const updateData = insertAgentSchema.partial().parse(req.body);
      const agent = await storage.updateAgent(req.params.id, updateData, DEMO_USER_ID);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAgent(req.params.id, DEMO_USER_ID);
      if (!deleted) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Knowledge documents routes
  app.get("/api/agents/:agentId/knowledge", async (req, res) => {
    try {
      const documents = await storage.getKnowledgeDocuments(req.params.agentId, DEMO_USER_ID);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge documents" });
    }
  });

  app.post("/api/agents/:agentId/knowledge", upload.single("file"), async (req, res) => {
    try {
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
        console.warn(`Uploaded file ${req.file.originalname} contains NUL bytes; stripping before DB insert.`);
        content = rawBuffer.toString('utf-8').replace(/\u0000/g, '');
      } else {
        content = rawBuffer.toString('utf-8');
      }

      // If PDF, try to extract text instead of using raw binary content
      let processedContent = content;
      // Excel (xlsx / xls) -> parse sheets to text
      if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || req.file.mimetype === 'application/vnd.ms-excel') {
        try {
          const wb = XLSX.read(rawBuffer, { type: 'buffer' });
          const sheetTexts: string[] = [];
            for (const sheetName of wb.SheetNames) {
              const sheet = wb.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_csv(sheet);
              if (csv.trim()) sheetTexts.push(`# Sheet: ${sheetName}\n${csv}`);
            }
          if (sheetTexts.length) {
            processedContent = sheetTexts.join('\n\n');
          }
        } catch (e) {
          console.warn('Failed to parse Excel file, falling back to raw text', e);
        }
      }
        try {
          if (req.file.mimetype === 'application/pdf') {
            try {
              // Use pdfjs-dist directly and pass a Uint8Array (pdfjs expects typed array)
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');

              // Convert Buffer to Uint8Array in a safe way
              const uint8 = new Uint8Array(rawBuffer.buffer, rawBuffer.byteOffset, rawBuffer.byteLength);

              const loadingTask = pdfjs.getDocument({ data: uint8 });
              const pdf = await loadingTask.promise;
              let fullText = '';
              for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map((it: any) => it.str || '').join(' ');
                fullText += strings + '\n\n';
              }
              if (fullText.trim()) {
                processedContent = fullText;
                console.info(`PDF text extracted: length=${fullText.length} chars, pages=${pdf.numPages}`);
              } else {
                console.info(`PDF extraction produced empty text (pages=${pdf.numPages}) – falling back to raw content.`);
              }
            } catch (err) {
              // pdfjs-dist can warn about optional canvas polyfills (DOMMatrix/Path2D)
              // Installing `canvas` in the environment can silence those warnings but is optional.
              console.warn('pdfjs-dist parse failed, falling back to raw text conversion. Tip: install `canvas` to silence DOMMatrix/Path2D warnings:', err);
            }
          }
        } catch (err) {
          console.warn('Unexpected error parsing PDF, falling back to raw text conversion:', err);
        }

      // Process the document with OpenAI
      const { summary, embedding } = await processKnowledgeDocument(processedContent);

      const docData = {
        agentId: req.params.agentId,
        userId: DEMO_USER_ID,
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
        console.warn(`processKnowledgeDocument returned empty embedding for file ${req.file.originalname}`);
        // leave processed = false so it won't be considered by the retriever
        await storage.updateKnowledgeDocument(document.id, {
          processed: false,
        });
      }

      res.status(201).json({ ...document, summary });
    } catch (error) {
      console.error("Error uploading knowledge document:", error);
      res.status(500).json({ message: "Failed to upload knowledge document" });
    }
  });

  // Knowledge URL ingestion
  app.post("/api/agents/:agentId/knowledge/url", async (req, res) => {
    try {
      const { url } = req.body as { url?: string };
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ message: "Invalid URL" });
      }
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ message: `Failed to fetch URL: ${response.status}` });
      }
      const html = await response.text();
      const $ = cheerio.load(html);
      // Remove script/style/noscript
      ['script','style','noscript'].forEach(tag => $(tag).remove());
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      if (!text) {
        return res.status(400).json({ message: "No readable text extracted" });
      }
      const truncated = text.slice(0, 150_000); // safety limit
      const { summary, embedding } = await processKnowledgeDocument(truncated);
      const filename = new URL(url).hostname + (new URL(url).pathname || '/');
      const docData = {
        agentId: req.params.agentId,
        userId: DEMO_USER_ID,
        filename: `URL: ${filename}`,
        content: truncated,
        fileSize: Buffer.byteLength(truncated, 'utf-8'),
        mimeType: 'text/html',
      };
      const document = await storage.createKnowledgeDocument(docData);
      if (Array.isArray(embedding) && embedding.length > 0) {
        await storage.updateKnowledgeDocument(document.id, {
          embedding: JSON.stringify(embedding),
          processed: true,
        });
      } else {
        await storage.updateKnowledgeDocument(document.id, { processed: false });
      }
      res.status(201).json({ ...document, summary });
    } catch (error) {
      console.error('Error ingesting URL:', error);
      res.status(500).json({ message: 'Failed to ingest URL' });
    }
  });

  // Conversations routes
  app.get("/api/conversations", async (req, res) => {
    try {
      const agentId = req.query.agentId as string;
      const conversations = await storage.getConversations(DEMO_USER_ID, agentId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversationData = insertConversationSchema.parse({
        ...req.body,
        userId: DEMO_USER_ID
      });
      const conversation = await storage.createConversation(conversationData);
      res.status(201).json(conversation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid conversation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteConversation(req.params.id, DEMO_USER_ID);
      if (!deleted) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // Messages routes
  app.get("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages(req.params.conversationId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    try {
      const conversationId = req.params.conversationId;
      const { content, role } = req.body;

      // Store user message
      const userMessage = await storage.createMessage({
        conversationId,
        role: "user",
        content,
      });

      // Get conversation and agent details
      const conversation = await storage.getConversation(conversationId, DEMO_USER_ID);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const agent = await storage.getAgent(conversation.agentId, DEMO_USER_ID);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Get conversation history
      const allMessages = await storage.getMessages(conversationId);
      const chatHistory = allMessages.slice(-10).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Get relevant knowledge
      const knowledgeDocuments = await storage.getKnowledgeDocuments(agent.id, DEMO_USER_ID);
      console.debug(`Loaded ${knowledgeDocuments.length} knowledge documents for agent ${agent.id}`);
      const processedDocs = knowledgeDocuments
        .filter(doc => doc.processed && doc.embedding)
        .map(doc => ({ content: doc.content, embedding: doc.embedding! }));

      console.debug(`Processed docs with embeddings: ${processedDocs.length}`);

      const knowledgeContext = await findRelevantKnowledge(content, processedDocs);

      // Merge agent-level tone/response style into the system instructions so
      // the model adopts the configured personality for this agent.
      const toneInstr = agent.tone ? `Please adopt a ${agent.tone} tone when replying.` : "";
      const styleInstr = agent.responseStyle ? `Respond in a ${agent.responseStyle} style.` : "";
      const combinedSystemInstructions = [agent.systemInstructions, toneInstr, styleInstr].filter(Boolean).join('\n\n');

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
  });

  // Statistics route
  app.get("/api/stats", async (req, res) => {
    try {
      const stats = await storage.getAgentStats(DEMO_USER_ID);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
