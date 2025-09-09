import { apiRequest } from "./queryClient";
import type { Agent, KnowledgeDocument, Conversation, Message, Stats, CreateAgentData } from "../types";

export const api = {
  // Agents
  getAgents: async (): Promise<Agent[]> => {
    const response = await apiRequest("GET", "/api/agents");
    return response.json();
  },

  getAgent: async (id: string): Promise<Agent> => {
    const response = await apiRequest("GET", `/api/agents/${id}`);
    return response.json();
  },

  createAgent: async (data: CreateAgentData): Promise<Agent> => {
    const response = await apiRequest("POST", "/api/agents", data);
    return response.json();
  },

  updateAgent: async (id: string, data: Partial<CreateAgentData>): Promise<Agent> => {
    const response = await apiRequest("PUT", `/api/agents/${id}`, data);
    return response.json();
  },

  deleteAgent: async (id: string): Promise<void> => {
    await apiRequest("DELETE", `/api/agents/${id}`);
  },

  // Knowledge
  getKnowledgeDocuments: async (agentId: string): Promise<KnowledgeDocument[]> => {
    const response = await apiRequest("GET", `/api/agents/${agentId}/knowledge`);
    return response.json();
  },

  uploadKnowledgeDocument: async (agentId: string, file: File): Promise<KnowledgeDocument> => {
    const formData = new FormData();
    formData.append("file", file);
    
    const response = await fetch(`/api/agents/${agentId}/knowledge`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status}: ${text}`);
    }

    return response.json();
  },

  uploadKnowledgeFromUrl: async (agentId: string, url: string): Promise<KnowledgeDocument> => {
    const response = await apiRequest("POST", `/api/agents/${agentId}/knowledge/url`, { url });
    return response.json();
  },

  // Conversations
  getConversations: async (agentId?: string): Promise<Conversation[]> => {
    const url = agentId ? `/api/conversations?agentId=${agentId}` : "/api/conversations";
    const response = await apiRequest("GET", url);
    return response.json();
  },

  createConversation: async (agentId: string, title?: string): Promise<Conversation> => {
    const response = await apiRequest("POST", "/api/conversations", { agentId, title });
    return response.json();
  },

  deleteConversation: async (conversationId: string): Promise<void> => {
    await apiRequest("DELETE", `/api/conversations/${conversationId}`);
  },

  // Messages
  getMessages: async (conversationId: string): Promise<Message[]> => {
    const response = await apiRequest("GET", `/api/conversations/${conversationId}/messages`);
    return response.json();
  },

  sendMessage: async (conversationId: string, content: string): Promise<{
    userMessage: Message;
    assistantMessage: Message;
    metadata: any;
  }> => {
    const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
      content,
      role: "user",
    });
    return response.json();
  },

  // Statistics
  getStats: async (): Promise<Stats> => {
    const response = await apiRequest("GET", "/api/stats");
    return response.json();
  },
};
