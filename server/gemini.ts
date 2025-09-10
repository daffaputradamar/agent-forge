import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

// Configurable model names via environment variables. Set these in your .env or
// via the environment when starting the server. Sensible defaults are provided.
export const GENAI_CHAT_MODEL =
  process.env.GENAI_CHAT_MODEL || "gemini-2.5-flash";
export const GENAI_SUMMARY_MODEL =
  process.env.GENAI_SUMMARY_MODEL || "gemini-2.5-pro";
export const GENAI_EMBED_MODEL =
  process.env.GENAI_EMBED_MODEL || "text-embedding-004";

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
    // Enforce strict instruction: model must ONLY use provided knowledge context
    // when present. If no relevant knowledge is provided, instruct the model to
    // reply with a clear fallback message and NOT hallucinate.
    let systemPromptBase = systemInstructions || "You are an assistant.";
    const strictInstruction = `\n\nImportant: Use the provided knowledge below as the sole source of factual information for answering the user's question. You are allowed and encouraged to summarize, explain, or rephrase the information in your own words to make it clearer, but do NOT add facts, make assumptions, or invent information that is not present in the provided knowledge. If the provided knowledge does not contain enough information to answer the user's question, reply the user with something similar like: \"I don't have enough information to answer that from the provided knowledge.\" `;

    const languageInstruction = `\n\nPlease reply in the same language as the user's messages. If the user switches languages, prefer the language used in the user's most recent message.`;

    const systemPrompt = knowledgeContext
      ? `${systemPromptBase}${strictInstruction}${languageInstruction}\n\nAdditional Knowledge Context:\n${knowledgeContext}`
      : `${systemPromptBase}${strictInstruction}${languageInstruction}`;

    // If there is no knowledge/context available, use a single LLM call to
    // classify the latest user message as either casual small-talk or an
    // information request, and produce the appropriate reply.
    if (!knowledgeContext || !knowledgeContext.trim()) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
      // Provide a short rolling window of prior conversation (excluding system) for context.
      const prior = messages.filter(m => m.role !== 'system').slice(-6, -1); // up to 5 previous before last
      const convoSnippet = prior.map(m => `${m.role}: ${m.content}`).join('\n');

      const classificationPrompt = `${systemPrompt}\n\nYou have NO domain knowledge/context available for answering factual questions right now.\nDecide if the user's latest message is CASUAL (greeting / thanks / pleasantry / small-talk) or INFO_REQUEST (asks for facts, explanations, instructions, details, problem-solving, or anything needing knowledge).\nThen produce an appropriate reply.\nRules:\n1. If CASUAL: respond warmly in 1-2 sentences. You may invite them to ask something about their agents or knowledge.\n2. If INFO_REQUEST: DO NOT invent facts. Respond in 1-3 short sentences saying you lack provided knowledge to answer and (optionally) request specific missing info or suggest uploading relevant documents.\n3. ALWAYS reply in the same language as the user's latest message.\n4. Output ONLY raw JSON with this exact shape (no markdown, no backticks): {"category":"casual"|"info_request","reply":"<your response>"}\n5. Do not add any other keys or text outside the JSON.\n
Conversation Context (recent, may be empty):\n${convoSnippet || '(none)'}\n\nLatest User Message: ${lastUserMessage}`;

      const clfResponse = await ai.models.generateContent({
        model: GENAI_CHAT_MODEL,
        contents: [{ role: 'user', parts: [{ text: classificationPrompt }] }]
      });

      const raw = clfResponse.text || '';

      const parseJson = (raw: string): { category: string; reply: string } | null => {
        const tryBlocks: string[] = [raw];
        // Strip code fences if any
        tryBlocks.push(raw.replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, '$1').trim());
        // Extract first JSON object
        const match = raw.match(/\{[\s\S]*?\}/);
        if (match) tryBlocks.push(match[0]);
        for (const candidate of tryBlocks) {
          try {
            const obj = JSON.parse(candidate);
            if (obj && typeof obj.reply === 'string' && typeof obj.category === 'string') {
              return obj as { category: string; reply: string };
            }
          } catch (_) {}
        }
        return null;
      };

      const parsed = parseJson(raw);
      let content: string;
      if (parsed) {
        if (parsed.category === 'casual') {
          content = parsed.reply.trim();
        } else {
          // info_request
            content = parsed.reply.trim() || `I don't have enough information to answer that from the provided knowledge.`;
        }
      } else {
        // Fallback if parsing failed: safe insufficient info message.
        content = `I don't have enough information to answer that from the provided knowledge. Could you share more details or upload relevant documents?`;
      }
      const responseTime = Date.now() - startTime;
      return { content, tokensUsed: 0, responseTime };
    }

    const response = await ai.models.generateContent({
      model: GENAI_CHAT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${systemPrompt}\n\nPlease respond to the following conversation using only the allowed knowledge/context above. 
    Continue the conversation appropriately.
    \n${messages.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
            },
          ],
        },
      ],
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
    throw new Error(
      `Failed to generate agent response: ${error?.message || error}`
    );
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ai.models.embedContent({
      model: GENAI_EMBED_MODEL,
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
    // To control token usage for extremely large documents, truncate content for summarization only (embedding still uses full content)
    const MAX_SUMMARY_CHARS = 50000; // ~safe bound
    const summaryInput =
      content.length > MAX_SUMMARY_CHARS
        ? content.slice(0, MAX_SUMMARY_CHARS)
        : content;

    // Generate summary with explicit instruction: raw JSON only, no fences
    const summaryResponse = await ai.models.generateContent({
      model: GENAI_SUMMARY_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are a document processing assistant. Create a concise summary of the provided document that captures the key information and context. Output ONLY raw JSON with this exact shape (no markdown, no code fences, no extra text): {"summary":"<your concise summary>"}\n\nDocument content begins below:\n${summaryInput}`,
            },
          ],
        },
      ],
    });

    const rawSummaryText = summaryResponse.text || "";

    const tryParseSummary = (raw: string): string | null => {
      // Direct attempt
      try {
        const data = JSON.parse(raw);
        if (data && typeof data.summary === "string") return data.summary;
      } catch (_) {}

      // Strip markdown fences like ```json ... ``` or ``` ... ```
      const fenceStripped = raw
        .replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, "$1")
        .trim();
      if (fenceStripped !== raw) {
        try {
          const data2 = JSON.parse(fenceStripped);
          if (data2 && typeof data2.summary === "string") return data2.summary;
        } catch (_) {}
      }

      // Extract first JSON object with a lazy match
      const match = fenceStripped.match(/\{[\s\S]*?\}/);
      if (match) {
        try {
          const data3 = JSON.parse(match[0]);
          if (data3 && typeof data3.summary === "string") return data3.summary;
        } catch (_) {}
      }
      return null;
    };

    let summary = tryParseSummary(rawSummaryText) || "";
    if (!summary) {
      console.warn(
        "processKnowledgeDocument: failed to parse summary JSON, falling back to heuristic summary"
      );
      // Heuristic: take first ~800 chars of cleaned text (without fences)
      const cleaned = rawSummaryText
        .replace(/```[a-zA-Z]*\n([\s\S]*?)```/g, "$1")
        .replace(/\s+/g, " ")
        .trim();
      summary = cleaned.slice(0, 800) || "No summary available";
    }

    // Generate embedding for the content
    const embedding = await generateEmbedding(content);
    console.info(`Generated embedding length=${embedding.length}`);

    return {
      summary,
      embedding,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to process knowledge document: ${error?.message || error}`
    );
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
    if (!documents || documents.length === 0) {
      console.debug("findRelevantKnowledge: no documents provided");
      return "";
    }

    const queryEmbedding = await generateEmbedding(query);

    const similarities = documents
      .map((doc) => {
        let docEmbedding: number[] = [];
        try {
          if (typeof doc.embedding === "string") {
            docEmbedding = JSON.parse(doc.embedding);
          } else {
            docEmbedding = doc.embedding as unknown as number[];
          }
        } catch (err) {
          console.warn(
            "findRelevantKnowledge: failed to parse doc.embedding, skipping document",
            err
          );
          return { content: doc.content, similarity: -1 };
        }

        if (!Array.isArray(docEmbedding) || docEmbedding.length === 0) {
          return { content: doc.content, similarity: -1 };
        }

        const similarity = calculateCosineSimilarity(
          queryEmbedding,
          docEmbedding
        );
        return { content: doc.content, similarity };
      })
      .filter((x) => x.similarity !== -1);

    if (similarities.length === 0) {
      console.debug(
        "findRelevantKnowledge: no valid embeddings found among documents"
      );
      return "";
    }

    // Sort by similarity and take top 3
    const sorted = similarities.sort((a, b) => b.similarity - a.similarity);
    const top = sorted.slice(0, 3);

    // Prefer documents with reasonable similarity (>0.3), but if none qualify,
    // fall back to returning the top 1 document to give the model some context.
    const relevantDocs = top
      .filter((doc) => doc.similarity > 0.3)
      .map((d) => d.content);
    if (relevantDocs.length > 0) {
      return relevantDocs.join("\n\n");
    }

    // fallback to best match even if below threshold
    console.debug(
      "findRelevantKnowledge: no docs passed threshold, falling back to top document with similarity",
      top[0].similarity
    );
    return top.map((d) => d.content).join("\n\n");
  } catch (error) {
    console.error("Error finding relevant knowledge:", error);
    return "";
  }
}
