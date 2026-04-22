import express from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { indexHandbookPdf } from '../services/ingest.js';
import { addMessage, ensureSession, getSession } from '../services/sessionStore.js';
import { answerFromHandbook } from '../services/chat.js';
import { config } from '../config.js';

const upload = multer({ dest: 'uploads/' });

export const apiRouter = express.Router();

function toApiError(error, fallbackMessage) {
  const status = error?.status || error?.statusCode || 500;
  const message = error?.error?.message || error?.message || fallbackMessage;

  return {
    statusCode: status,
    message,
    details: {
      type: error?.type || error?.error?.type || 'internal_error',
      requestId: error?.request_id || null
    }
  };
}

apiRouter.get('/health', (req, res) => {
  res.json({ ok: true, liveModel: config.liveModel });
});

apiRouter.post('/upload-handbook', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF as form field "file".' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported in this MVP.' });
    }

    const stats = await indexHandbookPdf(req.file.path);
    return res.json({ ok: true, ...stats });
  } catch (error) {
    return next(toApiError(error, 'Failed to index the uploaded PDF.'));
  }
});

apiRouter.post('/session', (req, res) => {
  const sessionId = uuidv4();
  ensureSession(sessionId);
  res.json({ sessionId });
});

apiRouter.get('/session/:sessionId', (req, res) => {
  const data = getSession(req.params.sessionId);
  if (!data) return res.status(404).json({ error: 'Session not found.' });
  return res.json(data);
});

apiRouter.post('/chat', async (req, res, next) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required.' });
    }

    const session = ensureSession(sessionId);
    addMessage(sessionId, 'user', message);

    const result = await answerFromHandbook({ message, history: session.messages });
    addMessage(sessionId, 'assistant', result.text, result.citations);

    return res.json(result);
  } catch (error) {
    return next(toApiError(error, 'Failed to answer from handbook context.'));
  }
});

apiRouter.get('/live-config', (req, res) => {
  res.json({
    model: config.liveModel,
    note:
      'Use this model from your client-side Gemini Live websocket flow. For MVP this repo ships text chat + mic-to-text UX. Full duplex live audio can be added next.'
  });
});
