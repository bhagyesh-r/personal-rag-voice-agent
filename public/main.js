let sessionId = null;

function appendMessage(role, text, citations = []) {
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const cited = citations.length
    ? `\n\nSources:\n${citations.map((c) => `[${c.id}] page ${c.page ?? 'unknown'} (score: ${(c.score ?? 0).toFixed(3)})`).join('\n')}`
    : '';
  div.innerText = `${role.toUpperCase()}: ${text}${cited}`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function newSession() {
  const res = await fetch('/api/session', { method: 'POST' });
  const data = await res.json();
  sessionId = data.sessionId;
  document.getElementById('sessionInfo').innerText = `Session: ${sessionId}`;
  document.getElementById('chat').innerHTML = '';
}

async function uploadPdf() {
  const file = document.getElementById('pdf').files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  document.getElementById('uploadStatus').innerText = 'Indexing...';

  const res = await fetch('/api/upload-handbook', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('uploadStatus').innerText = data.error || 'Upload failed';
    return;
  }

  document.getElementById('uploadStatus').innerText = `Done. Pages: ${data.pages}, chunks: ${data.chunks}`;
}

async function sendMessage() {
  if (!sessionId) await newSession();
  const message = document.getElementById('message').value.trim();
  if (!message) return;
  appendMessage('user', message);
  document.getElementById('message').value = '';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  });
  const data = await res.json();
  if (!res.ok) {
    appendMessage('assistant', data.error || 'Something went wrong');
    return;
  }

  appendMessage('assistant', data.text, data.citations || []);
}

async function loadLiveInfo() {
  const res = await fetch('/api/live-config');
  const data = await res.json();
  document.getElementById('liveInfo').innerText = `Model: ${data.model}. ${data.note}`;
}

function speakMode() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech Recognition not supported in this browser.');
    return;
  }

  const recog = new SpeechRecognition();
  recog.lang = 'en-US';
  recog.interimResults = false;
  recog.maxAlternatives = 1;

  recog.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('message').value = transcript;
  };

  recog.start();
}

newSession();
loadLiveInfo();
window.sendMessage = sendMessage;
window.newSession = newSession;
window.uploadPdf = uploadPdf;
window.speakMode = speakMode;
