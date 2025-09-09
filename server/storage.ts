import { 
  users, agents, knowledgeDocuments, conversations, messages,
  type User, type InsertUser, type Agent, type InsertAgent,
  type KnowledgeDocument, type InsertKnowledgeDocument,
  type Conversation, type InsertConversation,
  type Message, type InsertMessage
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Agents
  getAgents(userId: string): Promise<Agent[]>;
  getAgent(id: string, userId: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, agent: Partial<InsertAgent>, userId: string): Promise<Agent | undefined>;
  deleteAgent(id: string, userId: string): Promise<boolean>;
  
  // Knowledge Documents
  getKnowledgeDocuments(agentId: string, userId: string): Promise<KnowledgeDocument[]>;
  createKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument>;
  updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined>;
  
  // Conversations
  getConversations(userId: string, agentId?: string): Promise<Conversation[]>;
  getConversation(id: string, userId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  deleteConversation(id: string, userId: string): Promise<boolean>;
  
  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  
  // Statistics
  getAgentStats(userId: string): Promise<{
    totalAgents: number;
    activeConversations: number;
    totalDocuments: number;
    totalMessages: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAgents(userId: string): Promise<Agent[]> {
    return await db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(desc(agents.createdAt));
  }

  async getAgent(id: string, userId: string): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return agent || undefined;
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const [newAgent] = await db
      .insert(agents)
      .values(agent)
      .returning();
    return newAgent;
  }

  async updateAgent(id: string, agent: Partial<InsertAgent>, userId: string): Promise<Agent | undefined> {
    const [updatedAgent] = await db
      .update(agents)
      .set({ ...agent, updatedAt: new Date() })
      .where(and(eq(agents.id, id), eq(agents.userId, userId)))
      .returning();
    return updatedAgent || undefined;
  }

  async deleteAgent(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(agents)
      .where(and(eq(agents.id, id), eq(agents.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getKnowledgeDocuments(agentId: string, userId: string): Promise<KnowledgeDocument[]> {
    return await db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.agentId, agentId), eq(knowledgeDocuments.userId, userId)))
      .orderBy(desc(knowledgeDocuments.createdAt));
  }

  async createKnowledgeDocument(doc: InsertKnowledgeDocument): Promise<KnowledgeDocument> {
    const [newDoc] = await db
      .insert(knowledgeDocuments)
      .values(doc)
      .returning();
    return newDoc;
  }

  async updateKnowledgeDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | undefined> {
    // Ensure embedding is stored as a JSON string if an array is passed in
    const safeUpdates = { ...updates } as Partial<KnowledgeDocument>;
    if ((safeUpdates as any).embedding && Array.isArray((safeUpdates as any).embedding)) {
      (safeUpdates as any).embedding = JSON.stringify((safeUpdates as any).embedding);
    }

    const [updatedDoc] = await db
      .update(knowledgeDocuments)
      .set(safeUpdates)
      .where(eq(knowledgeDocuments.id, id))
      .returning();
    return updatedDoc || undefined;
  }

  async getConversations(userId: string, agentId?: string): Promise<Conversation[]> {
    const conditions = agentId 
      ? and(eq(conversations.userId, userId), eq(conversations.agentId, agentId))
      : eq(conversations.userId, userId);
      
    return await db
      .select()
      .from(conversations)
      .where(conditions)
      .orderBy(desc(conversations.updatedAt));
  }

  async getConversation(id: string, userId: string): Promise<Conversation | undefined> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return conversation || undefined;
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const [newConversation] = await db
      .insert(conversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
    return (result.rowCount || 0) > 0;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [newMessage] = await db
      .insert(messages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getAgentStats(userId: string): Promise<{
    totalAgents: number;
    activeConversations: number;
    totalDocuments: number;
    totalMessages: number;
  }> {
    const [agentCount] = await db
      .select({ count: count() })
      .from(agents)
      .where(eq(agents.userId, userId));

    const [conversationCount] = await db
      .select({ count: count() })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), eq(conversations.status, "active")));

    const [documentCount] = await db
      .select({ count: count() })
      .from(knowledgeDocuments)
      .where(eq(knowledgeDocuments.userId, userId));

    const [messageCount] = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(eq(conversations.userId, userId));

    return {
      totalAgents: agentCount.count,
      activeConversations: conversationCount.count,
      totalDocuments: documentCount.count,
      totalMessages: messageCount.count,
    };
  }
}

export const storage = new DatabaseStorage();
