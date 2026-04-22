import { Pinecone } from '@pinecone-database/pinecone';
import { config } from '../config.js';

const pc = new Pinecone({ apiKey: config.pineconeApiKey });
const index = pc.index(config.pineconeIndex);

export async function upsertVectors(vectors) {
  if (!vectors.length) return;
  await index.namespace(config.pineconeNamespace).upsert(vectors);
}

export async function queryVectors(vector, topK = config.maxContextChunks) {
  const result = await index.namespace(config.pineconeNamespace).query({
    vector,
    topK,
    includeMetadata: true
  });

  return result.matches || [];
}
