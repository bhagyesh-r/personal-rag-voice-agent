const sessions = new Map();

export function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], createdAt: new Date().toISOString() });
  }
  return sessions.get(sessionId);
}

export function addMessage(sessionId, role, text, citations = []) {
  const session = ensureSession(sessionId);
  const message = {
    role,
    text,
    citations,
    ts: new Date().toISOString()
  };
  session.messages.push(message);
  return message;
}

export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}
