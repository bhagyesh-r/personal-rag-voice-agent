import OpenAI from 'openai';
import { config } from '../config.js';

const client = new OpenAI({
  apiKey: config.embeddingApiKey,
  baseURL: config.embeddingBaseUrl
});

export async function embedText(input) {
  const response = await client.embeddings.create({
    model: config.embeddingModel,
    input,
    dimensions: config.embeddingDimensions
  });

  return response.data[0]?.embedding;
}
