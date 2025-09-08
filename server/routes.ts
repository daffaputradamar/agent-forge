import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertKnowledgeDocumentSchema, insertConversationSchema, insertMessageSchema } from "@shared/schema";
import { generateAgentResponse, processKnowledgeDocument, findRelevantKnowledge } from "./openai";
import multer from "multer";
import { z } from "zod";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Mock user for demo purposes - in real app you'd have authentication
  const DEMO_USER_ID = "demo-user";

  // Agents routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAgents(DEMO_USER_ID);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
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

      const content = req.file.buffer.toString('utf-8');
      
      // Process the document with OpenAI
      const { summary, embedding } = await processKnowledgeDocument(content);

      const docData = {
        agentId: req.params.agentId,
        userId: DEMO_USER_ID,
        filename: req.file.originalname,
        content: content,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      };

      const document = await storage.createKnowledgeDocument(docData);
      
      // Update with embedding
      await storage.updateKnowledgeDocument(document.id, {
        embedding: JSON.stringify(embedding),
        processed: true,
      });

      res.status(201).json({ ...document, summary });
    } catch (error) {
      console.error("Error uploading knowledge document:", error);
      res.status(500).json({ message: "Failed to upload knowledge document" });
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
      const processedDocs = knowledgeDocuments
        .filter(doc => doc.processed && doc.embedding)
        .map(doc => ({ content: doc.content, embedding: doc.embedding! }));

      const knowledgeContext = await findRelevantKnowledge(content, processedDocs);

      // Generate agent response
      const response = await generateAgentResponse(
        agent.systemInstructions,
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
