# Handbook RAG Voice Agent (MVP)

Node.js containerized MVP for querying a company handbook PDF using RAG.

## What this includes

- Upload handbook PDF from UI and index into Pinecone.
- Text chat endpoint grounded on handbook chunks only.
- Citation-aware responses with page references.
- Session memory in memory (Supabase persistence can be added later).
- Starter voice UX (browser mic to text) and Gemini Live model config endpoint.

## Confirmed model choices

- Live conversation model: `gemini-3.1-flash-live-preview`
- Embeddings model: `text-embedding-3-small`
- Embedding dimensions: `1024` to match the current Pinecone index

## Prerequisites

- Docker + Docker Compose
- Pinecone index already created (dimension must match `EMBEDDING_DIMENSIONS`; this repo now defaults to `1024`)
- API keys for Gemini + embedding provider + Pinecone

## Environment

1. Copy env file:

```bash
cp .env.example .env
```

2. Fill required variables in `.env`:

- `GEMINI_API_KEY`
- `EMBEDDING_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`

For OpenAI's native API, use the raw embedding model ID in `.env`, for example:

```bash
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1024
```

Do not use provider-prefixed values like `openai/text-embedding-3-small` with `api.openai.com`.

## Run locally (Docker)

```bash
docker compose up --build
```

Then open: <http://localhost:3000>

## API surface

- `POST /api/upload-handbook` (multipart, field name `file`)
- `POST /api/session`
- `GET /api/session/:sessionId`
- `POST /api/chat` with `{ sessionId, message }`
- `GET /api/live-config`
- `GET /api/health`

## Notes

- MVP intentionally refuses to free-answer outside retrieved handbook context.
- Live full-duplex audio loop with Gemini Live WebSocket is the next layer to add; current UI supports mic-to-text for quick internal testing.
