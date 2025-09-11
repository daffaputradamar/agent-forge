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
import { nanoid } from "nanoid";
import { readPdf } from "./lib";

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
        if (req.file.mimetype === "application/pdf") {
          try {
            try {
              let fullText = await readPdf(rawBuffer);

              if (fullText.trim()) {
                processedContent = fullText;
                console.info(
                  `PDF text extracted: length=${fullText.length} chars`
                );
              } else {
                console.warn(
                  `PDF extraction produced empty text. Rejecting upload.`
                );
                return res.status(400).json({
                  message:
                    "Failed to extract text from PDF; please upload a searchable PDF.",
                });
              }
            } catch (err) {
              console.warn("pdfreader parse failed:", err);
              return res.status(400).json({
                message:
                  "Failed to parse PDF; please upload a searchable PDF or try a different file.",
              });
            }
          } catch (err) {
            console.warn("Unexpected error parsing PDF:", err);
            return res.status(400).json({
              message:
                "Failed to parse PDF; please upload a searchable PDF or try a different file.",
            });
          }
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
          const conversationRecord = await storage.getConversation(
            conversationId,
            userId
          );
          if (
            conversationRecord &&
            (!conversationRecord.title || !conversationRecord.title.trim())
          ) {
            // Count messages for this conversation to determine if first
            const msgs = await storage.getMessages(conversationId);
            const userMessagesCount = msgs.filter(
              (m) => m.role === "user"
            ).length;
            if (userMessagesCount <= 1) {
              const trimmed = (content || "").trim().slice(0, 120);
              // try to cut at last space for nicer titles
              const lastSpace = trimmed.lastIndexOf(" ");
              const title =
                lastSpace > 20 ? trimmed.slice(0, lastSpace) : trimmed;
              await storage.updateConversation(
                conversationId,
                { title },
                userId
              );
            }
          }
        } catch (e) {
          console.warn(
            "Failed to set conversation title from first message",
            e
          );
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

        // ---- Tool Integration ----
        // Fetch tools for this agent
        const tools = await storage.getTools(agent.id, userId);
        let toolRunSummary: any = null;
        let finalAssistantContent: string;
        const toolCatalog = tools.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description || "",
          method: t.method,
          endpoint: t.endpoint,
          parameters: (t.parameters || []) as any[],
        }));

        // If tools exist, ask model if a tool should be invoked, or if clarification is needed.
        if (toolCatalog.length > 0) {
          const decisionPrompt = `You are a planning component for an AI assistant with optional HTTP tools.
Tools (array):\n${JSON.stringify(toolCatalog, null, 2)}\n
Conversation (recent):\n${chatHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n
Latest user message: ${content}\n
Task: Decide among three actions BEFORE answering:
1. "call"  - you have (or can confidently infer) ALL required parameters for a relevant tool; include params.
2. "ask"   - a tool is clearly relevant BUT at least one required parameter is missing or unclear; list missing names.
3. "none"  - no tool would help or user asks general question.
Output ONLY raw JSON: {"action":"call"|"ask"|"none","toolId?":"<id>","params?":{...},"missing?": ["paramA", ...] }.
Rules:
- Prefer ONE tool only.
- Do not hallucinate parameter values; if unsure, use action "ask".
- If action is "ask" include only missing required parameter names in "missing".
- If action is "call" you MUST NOT list any missing required param.
- Never include explanations outside JSON.`;
          const { runModelPrompt } = await import('./gemini');
          let decisionRaw = await runModelPrompt(decisionPrompt);
          const match = decisionRaw.match(/\{[\s\S]*\}/);
          if (match) decisionRaw = match[0];
          console.log("Decision Raw: ", decisionRaw);
          
          let decision: any = null; try { decision = JSON.parse(decisionRaw); } catch {}
          if (decision && decision.action === 'ask' && decision.toolId) {
            const tool = tools.find(t => t.id === decision.toolId);
            if (tool) {
              const missingList: string[] = Array.isArray(decision.missing) ? decision.missing : [];
              const paramMeta = (tool.parameters as any[] || []).filter((p: any) => missingList.includes(p.name));
              const clarification = `I can use the tool "${tool.name}" to help, but I still need: ${missingList.map(m => `"${m}"`).join(', ')}.${paramMeta.length ? '\n' + paramMeta.map((p: any) => `- ${p.name}${p.required ? ' (required)' : ''}: ${p.description || ''}`).join('\n') : ''}\nPlease provide the missing value${missingList.length>1?'s':''}.`;
              const assistantMessage = await storage.createMessage({
                conversationId,
                role: 'assistant',
                content: clarification,
                metadata: { toolClarification: { toolId: tool.id, missing: missingList, knownParams: decision.params || {} } } as any
              });
              const meta = (assistantMessage.metadata as any) || {};
              return res.json({ userMessage, assistantMessage, metadata: { toolClarification: meta.toolClarification } });
            }
          }
          if (decision && decision.action === 'call' && decision.toolId) {
            const tool = tools.find(t => t.id === decision.toolId);
            if (tool) {
              const execParams: Record<string, any> = {};
              if (decision.params && typeof decision.params === 'object') {
                for (const [k,v] of Object.entries(decision.params)) {
                  if (v !== null && v !== undefined && typeof v !== 'object') execParams[k] = v;
                }
              }
              // Execute (inline logic)
              let url = tool.endpoint;
              const method = tool.method.toUpperCase();
              const headers: Record<string,string> = { 'Accept':'application/json', ...(tool.headers||{}) };
              let body: any = undefined;
              if (method === 'GET') {
                const urlObj = new URL(url, url.startsWith('http') ? undefined : 'http://localhost');
                Object.entries(execParams).forEach(([k,v]) => { if (v!=null) urlObj.searchParams.set(k,String(v)); });
                url = urlObj.toString();
              } else if (method === 'POST') {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify(execParams);
              }
              if (/^https?:\/\/(localhost|127\.0\.0\.1|::1)/i.test(url) && !process.env.ALLOW_INTERNAL_TOOL_CALLS) {
                toolRunSummary = { tool: tool.name, skipped: true, reason: 'blocked_internal_endpoint' };
              } else {
                try {
                  const tStart = Date.now();
                  const toolResp = await fetch(url, { method, headers, body });
                  const elapsedMs = Date.now() - tStart;
                  const ctype = toolResp.headers.get('content-type') || '';
                  let toolData: any; try { toolData = ctype.includes('application/json') ? await toolResp.json() : await toolResp.text(); } catch { toolData = 'unparsable'; }
                  toolRunSummary = { tool: tool.name, status: toolResp.status, elapsedMs, data: toolData };
                } catch (err) {
                  toolRunSummary = { tool: tool.name, error: (err as Error).message };
                }
              }
            }
          }
        }

        if (toolRunSummary) {
          // Use model again to craft final answer using tool result
          const { runModelPrompt } = await import("./gemini");
          const answerPrompt = `${combinedSystemInstructions}\n\nA tool was executed. Tool result (JSON):\n${JSON.stringify(
            toolRunSummary
          ).slice(
            0,
            8000
          )}\n\nUser message: ${content}\nCompose the best helpful answer. If tool failed, gracefully explain inability.`;
          const answer = await runModelPrompt(answerPrompt);
          finalAssistantContent =
            answer.trim() || "I had trouble forming a response.";
        } else {
          // Fall back to existing generation logic
          const response = await generateAgentResponse(
            combinedSystemInstructions,
            chatHistory,
            knowledgeContext
          );
          finalAssistantContent = response.content;
        }

        const assistantMessage = await storage.createMessage({
          conversationId,
          role: "assistant",
          content: finalAssistantContent,
          metadata: {
            hasKnowledgeContext: !!knowledgeContext,
            toolRun: toolRunSummary || undefined,
          },
        });

        res.json({
          userMessage,
          assistantMessage,
          metadata: { toolRun: toolRunSummary },
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

  // ===== Tools CRUD =====
  app.get("/api/agents/:agentId/tools", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const tools = await storage.getTools(req.params.agentId, userId);
      res.json(tools);
    } catch (e) {
      console.error("List tools failed", e);
      res.status(500).json({ message: "Failed to list tools" });
    }
  });

  app.post("/api/agents/:agentId/tools", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const agent = await storage.getAgent(req.params.agentId, userId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const { insertToolSchema } = await import("@shared/schema");
      const parsed = insertToolSchema.parse(req.body);
      const created = await storage.createTool({
        ...parsed,
        agentId: agent.id,
        userId,
      });
      res.status(201).json(created);
    } catch (e: any) {
      if (e?.issues)
        return res
          .status(400)
          .json({ message: "Invalid tool data", errors: e.issues });
      console.error("Create tool failed", e);
      res.status(500).json({ message: "Failed to create tool" });
    }
  });

  app.put("/api/tools/:id", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      // fetch tool to ensure ownership
      const tool = await storage.getTool(req.params.id, userId);
      if (!tool) return res.status(404).json({ message: "Tool not found" });
      const { insertToolSchema } = await import("@shared/schema");
      // Partial validation: allow partial update by merging defaults
      const partialSchema = insertToolSchema.partial();
      const parsed = partialSchema.parse(req.body);
      const updated = await storage.updateTool(tool.id, parsed, userId);
      res.json(updated);
    } catch (e: any) {
      if (e?.issues)
        return res
          .status(400)
          .json({ message: "Invalid tool data", errors: e.issues });
      console.error("Update tool failed", e);
      res.status(500).json({ message: "Failed to update tool" });
    }
  });

  app.delete("/api/tools/:id", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const deleted = await storage.deleteTool(req.params.id, userId);
      if (!deleted) return res.status(404).json({ message: "Tool not found" });
      res.status(204).send();
    } catch (e) {
      console.error("Delete tool failed", e);
      res.status(500).json({ message: "Failed to delete tool" });
    }
  });

  // Execute a tool (server performs outbound HTTP call)
  app.post("/api/tools/:id/execute", requireAuth(), async (req, res) => {
    try {
      const userId = await resolveUserId(req);
      const tool = await storage.getTool(req.params.id, userId);
      if (!tool) return res.status(404).json({ message: "Tool not found" });

      const params = (req.body && req.body.params) || {};
      // Build URL & fetch options
      let url = tool.endpoint;
      const method = tool.method.toUpperCase();
      const headers: Record<string, string> = {
        Accept: "application/json",
        ...(tool.headers || {}),
      };

      let body: any = undefined;
      if (method === "GET") {
        // append query params
        const urlObj = new URL(
          url,
          url.startsWith("http") ? undefined : "http://localhost"
        );
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null)
            urlObj.searchParams.set(k, String(v));
        });
        url = urlObj.toString();
      } else if (method === "POST") {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(params);
      } else {
        return res.status(400).json({ message: "Unsupported method" });
      }

      // Basic safety: block localhost SSRF except if explicitly allowed (simple heuristic)
      if (
        /^https?:\/\/(localhost|127\.0\.0\.1|::1)/i.test(url) &&
        !process.env.ALLOW_INTERNAL_TOOL_CALLS
      ) {
        return res
          .status(400)
          .json({ message: "Calling internal network endpoints is blocked." });
      }

      const start = Date.now();
      console.debug("[tool-exec] calling", {
        url,
        method,
        headers,
        hasHeaders: !!tool.headers,
        toolId: tool.id,
      });
      const resp = await fetch(url, { method, headers, body });
      const elapsed = Date.now() - start;
      const contentType = resp.headers.get("content-type") || "";
      let data: any;
      try {
        if (contentType.includes("application/json")) {
          data = await resp.json();
        } else {
          data = await resp.text();
        }
      } catch (e) {
        data = { parseError: true };
      }
      res.json({ status: resp.status, elapsedMs: elapsed, data });
    } catch (e) {
      console.error("Execute tool failed", e);
      res.status(500).json({ message: "Failed to execute tool" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
// Embed API (public, outside registerRoutes for clarity could be placed inside if preferred)
// NOTE: Must be called after express.json middleware in index.ts
export function registerEmbedRoutes(app: Express) {
  // Helper: parse allowed origins string
  function originAllowed(
    allowed: string | null | undefined,
    requestOrigin: string | undefined
  ): boolean {
    console.log("allowed", allowed);
    console.log("requestOrigin", requestOrigin);

    const a = (allowed || "").trim();
    if (!a) return false;
    // Full wildcard allows any origin (including requests without an Origin header)
    if (a === "*") return true;
    // For non-wildcard lists we require an Origin header to validate
    if (!requestOrigin) return false;
    const list = a
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return list.some((rule) => {
      if (rule.startsWith(".")) {
        // subdomain wildcard: .example.com matches a.example.com, example.com
        return requestOrigin.endsWith(rule.replace(/^\./, ""));
      }
      return requestOrigin === rule;
    });
  }

  // Helper: derive request origin - prefer Origin header, fall back to Referer
  function extractRequestOrigin(req: any): string | undefined {
    const o = req.headers?.origin as string | undefined;
    if (o) return o;
    const ref = (req.headers?.referer || req.headers?.referrer) as
      | string
      | undefined;
    if (!ref) return undefined;
    try {
      return new URL(ref).origin;
    } catch (e) {
      return undefined;
    }
  }

  // Publish / rotate public key (authenticated)
  app.post("/api/agents/:id/publish", requireAuth(), async (req, res) => {
    try {
      const userId = await (async () => {
        const clerkUserId = getUserId(req);
        if (!clerkUserId) throw new Error("Missing user");
        const existing = await storage.getUserByUsername(clerkUserId);
        return existing
          ? existing.id
          : (
              await storage.createUser({
                username: clerkUserId,
                password: "oauth",
                email: clerkUserId + "@example.com",
              })
            ).id;
      })();
      const agent = await storage.getAgent(req.params.id, userId);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      const body = req.body as {
        allowEmbed?: boolean;
        embedAllowedOrigins?: string;
        rotate?: boolean;
      };
      const allowEmbed = body.allowEmbed ?? true;
      // Determine publicKey: only generate when embedding is enabled and either there's
      // no existing key or caller requested rotation.
      let publicKey: string | null = agent.publicKey ?? null;
      if (allowEmbed) {
        if (body.rotate) {
          publicKey = nanoid(24);
        } else if (!publicKey) {
          publicKey = nanoid(24);
        }
      }
      await storage.updateAgent(
        agent.id,
        {
          allowEmbed,
          embedAllowedOrigins: body.embedAllowedOrigins,
          publicKey,
        } as any,
        userId
      );
      res.json({ publicKey, allowEmbed });
    } catch (e) {
      console.error("Publish agent failed", e);
      res.status(500).json({ message: "Failed to publish agent" });
    }
  });

  // Create / reuse embedded session
  app.post("/api/embed/:publicKey/session", async (req, res) => {
    try {
      const { publicKey } = req.params;
      const agent = await storage.getAgentByPublicKey(publicKey);
      if (!agent || !agent.allowEmbed)
        return res.status(404).json({ message: "Agent not embeddable" });
      const requestOrigin = extractRequestOrigin(req);
      if (!originAllowed(agent.embedAllowedOrigins || "", requestOrigin)) {
        return res.status(403).json({ message: "Origin not allowed" });
      }
      const externalUserId = (req.body && req.body.externalUserId) || null;
      const { sessionId: incomingSession, newConversation } = req.body || {};
      let sessionId = incomingSession;
      let conversation;
      if (sessionId && !newConversation) {
        conversation = await storage.getEmbeddedConversation(
          agent.id,
          sessionId
        );
      }
      if (!conversation) {
        sessionId = nanoid(32);
        conversation = await storage.createEmbeddedConversation(
          agent.id,
          sessionId,
          requestOrigin,
          externalUserId
        );
      }
      res.json({
        sessionId,
        conversationId: conversation.id,
        agentName: agent.name,
        agentAvatar: agent.avatar || null,
      });
    } catch (e) {
      console.error("Embedded session error", e);
      res.status(500).json({ message: "Failed to create embedded session" });
    }
  });

  // Post message (embedded)
  app.post("/api/embed/:publicKey/messages", async (req, res) => {
    try {
      const { publicKey } = req.params;
      const agent = await storage.getAgentByPublicKey(publicKey);
      if (!agent || !agent.allowEmbed)
        return res.status(404).json({ message: "Agent not embeddable" });
      const requestOrigin = extractRequestOrigin(req);
      console.log("Embed message request from origin:", requestOrigin);

      if (!originAllowed(agent.embedAllowedOrigins || "", requestOrigin)) {
        return res.status(403).json({ message: "Origin not allowed" });
      }
      const { sessionId, content } = req.body || {};
      if (!sessionId || !content)
        return res
          .status(400)
          .json({ message: "sessionId and content required" });
      const conversation = await storage.getEmbeddedConversation(
        agent.id,
        sessionId
      );
      if (!conversation)
        return res.status(404).json({ message: "Session not found" });

      // Persist user message
      const userMessage = await storage.createMessage({
        conversationId: conversation.id,
        role: "user",
        content,
      });

      // Build limited history
      const allMessages = await storage.getMessages(conversation.id);
      const chatHistory = allMessages
        .slice(-10)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

      // Knowledge retrieval (need agent owner's userId). We stored agent.userId.
      const knowledgeDocuments = await storage.getKnowledgeDocuments(
        agent.id,
        agent.userId
      );
      const processedDocs = knowledgeDocuments
        .filter((d) => d.processed && d.embedding)
        .map((d) => ({ content: d.content, embedding: d.embedding! }));
      const knowledgeContext = await findRelevantKnowledge(
        content,
        processedDocs
      );

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
      const response = await generateAgentResponse(
        combinedSystemInstructions,
        chatHistory,
        knowledgeContext
      );

      const assistantMessage = await storage.createMessage({
        conversationId: conversation.id,
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
    } catch (e) {
      console.error("Embedded message error", e);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  // Get messages (embedded)
  app.get("/api/embed/:publicKey/messages", async (req, res) => {
    try {
      const { publicKey } = req.params;
      const agent = await storage.getAgentByPublicKey(publicKey);
      if (!agent || !agent.allowEmbed)
        return res.status(404).json({ message: "Agent not embeddable" });
      const requestOrigin = extractRequestOrigin(req);
      if (!originAllowed(agent.embedAllowedOrigins || "", requestOrigin)) {
        return res.status(403).json({ message: "Origin not allowed" });
      }
      const sessionId = req.query.sessionId as string;
      if (!sessionId)
        return res.status(400).json({ message: "sessionId required" });
      const conversation = await storage.getEmbeddedConversation(
        agent.id,
        sessionId
      );
      if (!conversation)
        return res.status(404).json({ message: "Session not found" });
      const msgs = await storage.getMessages(conversation.id);
      res.json(msgs.slice(-50));
    } catch (e) {
      console.error("Embedded fetch messages error", e);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });
}
