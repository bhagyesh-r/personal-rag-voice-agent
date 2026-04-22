import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';
import { embedText } from './embedding.js';
import { queryVectors } from './pinecone.js';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

function buildPrompt({ message, contextChunks, history }) {
  const citationsBlock = contextChunks
    .map((match, idx) => {
      const md = match.metadata || {};
      return `[${idx + 1}] page=${md.page || 'unknown'}\n${md.text || ''}`;
    })
    .join('\n\n');

  const historyBlock = history
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join('\n');

  return `You are an internal handbook assistant.
Rules:
1) Answer ONLY from the provided handbook context.
2) If answer is not in context, say: "I couldn't find that in the handbook." 
3) Return concise answers with citations like [1], [2].

Conversation history:\n${historyBlock || 'No previous history.'}

Handbook context:\n${citationsBlock || 'No context available.'}

User question: ${message}`;
}

export async function answerFromHandbook({ message, history }) {
  const queryVector = await embedText(message);
  const matches = queryVector ? await queryVectors(queryVector) : [];

  const prompt = buildPrompt({ message, contextChunks: matches, history });

  const response = await ai.models.generateContent({
    model: config.chatModel,
    contents: prompt
  });

  const text = response.text || "I couldn't find that in the handbook.";
  const citations = matches.map((m, i) => ({
    id: i + 1,
    page: m.metadata?.page,
    score: m.score,
    text: m.metadata?.text
  }));

  return { text, citations };
}
