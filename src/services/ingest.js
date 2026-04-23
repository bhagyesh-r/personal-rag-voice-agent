import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { chunkText } from './chunking.js';
import { embedText } from './embedding.js';
import { upsertVectors } from './pinecone.js';

export async function extractPdfPages(filePath) {
  const buffer = await fs.readFile(filePath);
  const pages = [];
  let pageNumber = 0;

  await pdf(buffer, {
    pagerender: async (pageData) => {
      pageNumber += 1;
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(' ');
      pages.push({ pageNumber, text });
      return text;
    }
  });

  return pages;
}

export async function indexHandbookPdf(filePath, { sourceName } = {}) {
  const pages = await extractPdfPages(filePath);
  const vectors = [];
  const documentName = sourceName || path.basename(filePath);

  for (const page of pages) {
    const chunks = chunkText(page.text);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const embedding = await embedText(chunk);
      if (!embedding) continue;

      vectors.push({
        id: uuidv4(),
        values: embedding,
        metadata: {
          text: chunk,
          page: page.pageNumber,
          chunk: i + 1,
          source: filePath,
          sourceName: documentName
        }
      });
    }
  }

  await upsertVectors(vectors);
  return { pages: pages.length, chunks: vectors.length, documentName };
}
