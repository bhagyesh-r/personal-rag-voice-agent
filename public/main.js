let sessionId = null;

function timeAgoLabel() {
  return 'JUST NOW';
}

function renderCitations(citations = []) {
  const panel = document.getElementById('citations');
  panel.innerHTML = '';

  if (!citations.length) {
    const empty = document.createElement('div');
    empty.className = 'citation-card';
    empty.innerHTML = '<span class="tag">READY</span><h4>No citations yet</h4><p>Sources appear here after an assistant response.</p>';
    panel.appendChild(empty);
    return;
  }

  citations.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'citation-card';
    const title = c.id || 'Document excerpt';
    const page = c.page ?? 'unknown';
    const score = (c.score ?? 0).toFixed(3);

    card.innerHTML = `
      <span class="tag">VERIFIED</span>
      <h4>${title}</h4>
      <p>Context used for answer grounding.</p>
      <div class="meta">Page ${page} · Score ${score}</div>
    `;
    panel.appendChild(card);
  });
}

function appendMessage(role, text, citations = []) {
  const chat = document.getElementById('chat');
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;

  const bubbleWrap = document.createElement('div');

  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerText = text;

  const stamp = document.createElement('div');
  stamp.className = 'msg-time';
  stamp.textContent = timeAgoLabel();

  bubbleWrap.appendChild(div);
  bubbleWrap.appendChild(stamp);
  row.appendChild(bubbleWrap);

  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  if (role === 'assistant') {
    renderCitations(citations);
  }
}

async function newSession() {
  const res = await fetch('/api/session', { method: 'POST' });
  const data = await res.json();
  sessionId = data.sessionId;
  document.getElementById('chat').innerHTML = '';
  renderCitations([]);
  appendMessage('assistant', 'System initialized. I am ready to analyze your corporate policy queries. How can I assist you today?');
}

async function uploadPdf() {
  const file = document.getElementById('pdf').files[0];
  if (!file) return;

  const fd = new FormData();
  fd.append('file', file);
  document.getElementById('uploadStatus').innerText = 'Indexing policy document...';

  const res = await fetch('/api/upload-handbook', { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('uploadStatus').innerText = data.error || 'Upload failed';
    return;
  }

  document.getElementById('uploadStatus').innerText = `Loaded ${data.pages} pages / ${data.chunks} chunks`;
}

async function sendMessage() {
  if (!sessionId) await newSession();

  const messageEl = document.getElementById('message');
  const message = messageEl.value.trim();
  if (!message) return;

  appendMessage('user', message);
  messageEl.value = '';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message })
  });
  const data = await res.json();

  if (!res.ok) {
    appendMessage('assistant', data.error || 'Something went wrong while processing the request.');
    return;
  }

  appendMessage('assistant', data.text, data.citations || []);
}

async function loadLiveInfo() {
  const res = await fetch('/api/live-config');
  const data = await res.json();
  document.getElementById('liveInfo').innerText = `Policy context loaded. Ready for real-time analysis and citation retrieval. (${data.model})`;
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

document.getElementById('message').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

newSession();
loadLiveInfo();
window.sendMessage = sendMessage;
window.newSession = newSession;
window.uploadPdf = uploadPdf;
window.speakMode = speakMode;
