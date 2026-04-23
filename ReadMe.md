# Handbook RAG Voice Agent (MVP)

Node.js containerized MVP for querying a company handbook PDF using RAG.

## What this includes

- Upload handbook PDF from UI and index into Pinecone.
- Text chat endpoint grounded on handbook chunks only.
- Citation-aware responses with page references.
- Session memory in memory (Supabase persistence can be added later).
- Browser voice assistant loop using speech recognition for mic input and speech synthesis for spoken handbook answers.
- Voice assistant status endpoint describing the current browser voice + RAG setup.

## Confirmed model choices

- Configured Gemini Live model for future experiments: `gemini-3.1-flash-live-preview`
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

Optional Gemini resiliency settings:

- `CHAT_MODEL_FALLBACK` to try a second Gemini model if the primary model stays overloaded
- `GEMINI_MAX_RETRIES` to control transient retry attempts for Gemini chat calls
- `GEMINI_RETRY_BASE_MS` to control the base exponential backoff delay in milliseconds

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
- Current UI uses browser speech recognition and browser speech synthesis with the existing `/api/chat` RAG flow.
- The current browser experience does not open a Gemini Live WebSocket session.
