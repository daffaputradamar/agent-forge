export interface Agent {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  tone: string;
  responseStyle: string;
  systemInstructions: string;
  status: string;
  avatar?: string;
  // Embed / deployment fields
  allowEmbed?: boolean;
  publicKey?: string | null;
  embedAllowedOrigins?: string | null; // comma separated list or *
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  agentId: string;
  userId: string;
  filename: string;
  content: string;
  fileSize: number;
  mimeType: string;
  processed: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  agentId: string;
  userId?: string;
  title?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  metadata?: any;
  createdAt: string;
}

export interface ToolParameterDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  description?: string;
}

export interface Tool {
  id: string;
  agentId: string;
  userId: string;
  name: string;
  description?: string;
  method: 'GET' | 'POST';
  endpoint: string;
  parameters?: ToolParameterDefinition[];
  headers?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateToolData {
  name: string;
  description?: string;
  method: 'GET' | 'POST';
  endpoint: string;
  parameters?: ToolParameterDefinition[];
  headers?: Record<string, string>;
}

export interface Stats {
  totalAgents: number;
  activeConversations: number;
  totalDocuments: number;
  totalMessages: number;
}

export interface CreateAgentData {
  name: string;
  description?: string;
  category: string;
  tone: string;
  responseStyle: string;
  systemInstructions: string;
  // Optional on create (typically managed later)
  allowEmbed?: boolean;
  embedAllowedOrigins?: string;
}
