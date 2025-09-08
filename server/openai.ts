import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  content: string;
  tokensUsed: number;
  responseTime: number;
}

export async function generateAgentResponse(
  systemInstructions: string,
  messages: ChatMessage[],
  knowledgeContext?: string
): Promise<AgentResponse> {
  const startTime = Date.now();
  
  try {
    const systemPrompt = knowledgeContext 
      ? `${systemInstructions}\n\nAdditional Knowledge Context:\n${knowledgeContext}`
      : systemInstructions;

    // Convert messages to Gemini format
    const conversationHistory = messages.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user", 
        parts: [{ text: `${systemPrompt}\n\nPlease respond to the following conversation:\n${messages.map(m => `${m.role}: ${m.content}`).join('\n')}` }]
      }],
    });

    const content = response.text || "";
    const tokensUsed = 0; // Gemini doesn't provide token count in the same way
    const responseTime = Date.now() - startTime;

    return {
      content,
      tokensUsed,
      responseTime,
    };
  } catch (error: any) {
    throw new Error(`Failed to generate agent response: ${error?.message || error}`);
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: { parts: [{ text }] },
    });

    return response.embeddings?.[0]?.values || [];
  } catch (error: any) {
    throw new Error(`Failed to generate embedding: ${error?.message || error}`);
  }
}

export async function processKnowledgeDocument(content: string): Promise<{
  summary: string;
  embedding: number[];
}> {
  try {
    // Generate summary
    const summaryResponse = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{
        role: "user",
        parts: [{ text: `You are a document processing assistant. Create a concise summary of the provided document that captures the key information and context. Respond with JSON in this format: { "summary": "your summary here" }\n\nDocument content:\n\n${content}` }]
      }],
    });

    const summaryData = JSON.parse(summaryResponse.text || "{}");
    const summary = summaryData.summary || "No summary available";

    // Generate embedding for the content
    const embedding = await generateEmbedding(content);

    return {
      summary,
      embedding,
    };
  } catch (error: any) {
    throw new Error(`Failed to process knowledge document: ${error?.message || error}`);
  }
}

export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function findRelevantKnowledge(
  query: string,
  documents: Array<{ content: string; embedding: string }>
): Promise<string> {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    const similarities = documents.map(doc => {
      const docEmbedding = JSON.parse(doc.embedding);
      const similarity = calculateCosineSimilarity(queryEmbedding, docEmbedding);
      return { content: doc.content, similarity };
    });

    // Sort by similarity and take top 3 most relevant documents
    const relevantDocs = similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .filter(doc => doc.similarity > 0.3) // Only include documents with reasonable similarity
      .map(doc => doc.content);

    return relevantDocs.join("\n\n");
  } catch (error) {
    console.error("Error finding relevant knowledge:", error);
    return "";
  }
}
