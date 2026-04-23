import { VOICE_STATES, getVoiceStatusText, stripCitationMarkers } from './voiceHelpers.js';
import { derivePayloadObjects, formatRelativeTime, truncateSnippet } from './uiHelpers.js';

const DEFAULT_LIVE_SUMMARY = 'Policy context loaded. Ready for real-time analysis and citation retrieval.';

const dom = {
  attachButton: document.getElementById('attachButton'),
  chat: document.getElementById('chat'),
  citations: document.getElementById('citations'),
  composer: document.getElementById('composer'),
  liveInfo: document.getElementById('liveInfo'),
  message: document.getElementById('message'),
  newSessionButton: document.getElementById('newSessionButton'),
  payloadObjects: document.getElementById('payloadObjects'),
  pdf: document.getElementById('pdf'),
  personaButton: document.getElementById('personaButton'),
  resourceProgress: document.getElementById('resourceProgress'),
  sendButton: document.getElementById('sendButton'),
  sessionInfo: document.getElementById('sessionInfo'),
  uploadButton: document.getElementById('uploadButton'),
  uploadStatus: document.getElementById('uploadStatus'),
  voiceModeLabel: document.getElementById('voiceModeLabel'),
  voicePanel: document.getElementById('voicePanel'),
  voiceStatus: document.getElementById('voiceStatus'),
  voiceToggleButton: document.getElementById('voiceToggleButton'),
  voiceToggleIcon: document.getElementById('voiceToggleIcon')
};

const appState = {
  currentCitations: [],
  isSending: false,
  isUploading: false,
  lastUpload: null,
  sessionId: null,
  timestampRefreshId: null
};

const voiceAssistant = {
  active: false,
  state: VOICE_STATES.IDLE,
  recognition: null,
  heardSpeech: false,
  recognitionHandled: false,
  stopRequested: false
};

const VOICE_MODE_LABELS = {
  [VOICE_STATES.IDLE]: 'Standby',
  [VOICE_STATES.GREETING]: 'Initializing',
  [VOICE_STATES.LISTENING]: 'Listening',
  [VOICE_STATES.PROCESSING]: 'Analyzing',
  [VOICE_STATES.SPEAKING]: 'Responding',
  [VOICE_STATES.STOPPED]: 'Stopped'
};

function setSessionMetadata(sessionId) {
  appState.sessionId = sessionId || null;
  dom.sessionInfo.dataset.sessionId = sessionId || '';
  dom.sessionInfo.title = sessionId || '';
}

function createIcon(name) {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.textContent = name;
  return icon;
}

function setComposerBusy(isBusy) {
  appState.isSending = isBusy;
  dom.message.disabled = isBusy;
  dom.sendButton.disabled = isBusy;
  dom.composer.setAttribute('aria-busy', String(isBusy));
}

function setUploadUi({ width, message, busy }) {
  if (typeof width === 'string') {
    dom.resourceProgress.style.width = width;
  }

  if (typeof message === 'string') {
    dom.uploadStatus.textContent = message;
  }

  appState.isUploading = busy;
  dom.uploadButton.disabled = busy;
  dom.attachButton.disabled = busy;
}

function refreshMessageTimestamps() {
  dom.chat.querySelectorAll('[data-timestamp]').forEach((node) => {
    node.textContent = formatRelativeTime(node.dataset.timestamp);
  });
}

function ensureTimestampRefreshLoop() {
  if (appState.timestampRefreshId) return;
  appState.timestampRefreshId = window.setInterval(refreshMessageTimestamps, 30_000);
}

function createEmptyCard(title, body, badgeText = 'READY') {
  const card = document.createElement('div');
  card.className = 'empty-card';

  const badge = document.createElement('span');
  badge.className = 'citation-badge';
  badge.textContent = badgeText;

  const heading = document.createElement('h4');
  heading.textContent = title;

  const copy = document.createElement('p');
  copy.textContent = body;

  card.append(badge, heading, copy);
  return card;
}

function buildCitationMeta(citation) {
  const parts = [];

  if (citation.page != null) {
    parts.push(`Page ${citation.page}`);
  }

  if (citation.chunk != null) {
    parts.push(`Chunk ${citation.chunk}`);
  }

  if (typeof citation.score === 'number') {
    parts.push(`Score ${citation.score.toFixed(3)}`);
  }

  return parts;
}

function renderPayloadObjects() {
  dom.payloadObjects.replaceChildren();

  const items = derivePayloadObjects(appState.currentCitations, appState.lastUpload);

  if (!items.length) {
    dom.payloadObjects.appendChild(
      createEmptyCard(
        'No payload objects yet',
        'Upload a handbook and ask a question to surface indexed policy assets.',
        'IDLE'
      )
    );
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'payload-item';

    const icon = createIcon(item.icon);
    const copy = document.createElement('div');
    copy.className = 'payload-copy';

    const heading = document.createElement('h4');
    heading.textContent = item.label;

    const detail = document.createElement('p');
    detail.textContent = item.description;

    copy.append(heading, detail);
    row.append(icon, copy);
    dom.payloadObjects.appendChild(row);
  });
}

function renderCitations(citations = []) {
  appState.currentCitations = citations;
  dom.citations.replaceChildren();

  if (!citations.length) {
    dom.citations.appendChild(
      createEmptyCard(
        'No citations yet',
        'Verified handbook excerpts appear here after an assistant response.'
      )
    );
    renderPayloadObjects();
    return;
  }

  citations.forEach((citation) => {
    const card = document.createElement('div');
    card.className = 'citation-card';

    const header = document.createElement('div');
    header.className = 'citation-card-header';

    const badge = document.createElement('span');
    badge.className = 'citation-badge';
    badge.textContent = 'Verified';

    const action = createIcon('open_in_new');
    action.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h4');
    title.textContent = citation.sourceName || `Document excerpt ${citation.id}`;

    const excerpt = document.createElement('p');
    excerpt.textContent = truncateSnippet(
      citation.text || 'Context used for answer grounding.',
      180
    );

    const meta = document.createElement('div');
    meta.className = 'citation-meta';

    buildCitationMeta(citation).forEach((part) => {
      const chip = document.createElement('span');
      chip.textContent = part;
      meta.appendChild(chip);
    });

    header.append(badge, action);
    card.append(header, title, excerpt);

    if (meta.childElementCount) {
      card.appendChild(meta);
    }

    dom.citations.appendChild(card);
  });

  renderPayloadObjects();
}

function appendMessage(role, text, citations = [], { timestamp = new Date().toISOString() } = {}) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.appendChild(createIcon(role === 'assistant' ? 'hub' : 'person'));

  const stack = document.createElement('div');
  stack.className = 'message-stack';

  const meta = document.createElement('p');
  meta.className = 'message-meta';
  meta.textContent = role === 'assistant' ? 'Assistant' : 'You';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;

  const stamp = document.createElement('span');
  stamp.className = 'message-time';
  stamp.dataset.timestamp = timestamp;
  stamp.textContent = formatRelativeTime(timestamp);

  stack.append(meta, bubble, stamp);
  row.append(avatar, stack);
  dom.chat.appendChild(row);
  dom.chat.scrollTop = dom.chat.scrollHeight;

  if (role === 'assistant') {
    renderCitations(citations);
  }
}

function syncVoiceControls() {
  const isActive = voiceAssistant.active;
  dom.voiceToggleIcon.textContent = isActive ? 'stop_circle' : 'mic';
  dom.voiceToggleButton.classList.toggle('is-active', isActive);
  dom.personaButton.classList.toggle('is-active', isActive);
  dom.personaButton.setAttribute('aria-pressed', String(isActive));
  dom.voiceModeLabel.textContent = VOICE_MODE_LABELS[voiceAssistant.state] || 'Standby';
  dom.voicePanel.dataset.voiceState = voiceAssistant.state;
}

function setVoiceState(state, detail = '') {
  voiceAssistant.state = state;
  dom.voiceStatus.textContent = getVoiceStatusText(state, detail);
  syncVoiceControls();
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function hasSpeechSynthesisSupport() {
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';
}

function cancelSpeechOutput() {
  if (hasSpeechSynthesisSupport()) {
    window.speechSynthesis.cancel();
  }
}

function stopRecognition() {
  if (!voiceAssistant.recognition) return;

  voiceAssistant.stopRequested = true;
  voiceAssistant.recognitionHandled = true;

  try {
    voiceAssistant.recognition.abort();
  } catch (error) {
    // Ignore invalid abort attempts when recognition is already idle.
  }
}

function stopVoiceAssistant(detail = 'Voice mode paused. You can restart it any time.') {
  voiceAssistant.active = false;
  stopRecognition();
  cancelSpeechOutput();
  setVoiceState(VOICE_STATES.STOPPED, detail);
}

function ensureRecognition() {
  if (voiceAssistant.recognition) return voiceAssistant.recognition;

  const SpeechRecognition = getSpeechRecognitionConstructor();
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    if (!voiceAssistant.active) return;
    setVoiceState(VOICE_STATES.LISTENING, 'Listening for your next handbook question.');
  };

  recognition.onresult = (event) => {
    if (!voiceAssistant.active || voiceAssistant.recognitionHandled) return;

    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim();

    if (!transcript) return;

    voiceAssistant.heardSpeech = true;
    voiceAssistant.recognitionHandled = true;
    setVoiceState(VOICE_STATES.PROCESSING, 'Checking the indexed handbook.');
    void handleRecognizedQuestion(transcript);
  };

  recognition.onerror = (event) => {
    if (!voiceAssistant.active || voiceAssistant.stopRequested || voiceAssistant.recognitionHandled) {
      return;
    }

    voiceAssistant.recognitionHandled = true;

    if (event.error === 'aborted') {
      return;
    }

    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopVoiceAssistant('Microphone permission was denied. Continue with text chat instead.');
      return;
    }

    if (event.error === 'audio-capture') {
      stopVoiceAssistant('No microphone was detected. Connect one or keep using text chat.');
      return;
    }

    void repromptForAnotherQuestion(
      "I didn't catch that. Please ask your company policy question again.",
      'Retrying after a microphone issue.'
    );
  };

  recognition.onend = () => {
    if (!voiceAssistant.active || voiceAssistant.stopRequested) {
      voiceAssistant.stopRequested = false;
      return;
    }

    if (voiceAssistant.state === VOICE_STATES.LISTENING && !voiceAssistant.recognitionHandled) {
      voiceAssistant.recognitionHandled = true;
      void repromptForAnotherQuestion(
        "I didn't hear anything. Please ask your company policy question again.",
        'Waiting for your next question.'
      );
    }
  };

  voiceAssistant.recognition = recognition;
  return recognition;
}

async function newSession() {
  if (voiceAssistant.active) {
    stopVoiceAssistant('Starting a fresh secure session.');
  }

  try {
    const res = await fetch('/api/session', { method: 'POST' });
    const data = await res.json();
    setSessionMetadata(data.sessionId);
    dom.chat.replaceChildren();
    dom.message.value = '';
    renderCitations([]);
    appendMessage(
      'assistant',
      'System initialized. I am ready to analyze your corporate policy queries. How can I assist you today?'
    );
    setVoiceState(VOICE_STATES.IDLE, 'Ready for voice or text questions.');
    dom.message.focus();
  } catch (error) {
    setSessionMetadata('');
    setVoiceState(VOICE_STATES.STOPPED, 'Could not create a session. Refresh and try again.');
  }
}

async function ensureSessionReady() {
  if (!appState.sessionId) {
    await newSession();
  }
}

async function uploadPdf() {
  const file = dom.pdf.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  setUploadUi({ width: '62%', message: 'Indexing policy document...', busy: true });

  try {
    const res = await fetch('/api/upload-handbook', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      setUploadUi({
        width: appState.lastUpload ? '100%' : '24%',
        message: data.error || 'Upload failed.',
        busy: false
      });
      return;
    }

    appState.lastUpload = {
      documentName: data.documentName || file.name,
      pages: data.pages,
      chunks: data.chunks
    };

    setUploadUi({
      width: '100%',
      message: `${appState.lastUpload.documentName} indexed · ${data.pages} pages · ${data.chunks} chunks`,
      busy: false
    });
    renderPayloadObjects();
  } catch (error) {
    setUploadUi({
      width: appState.lastUpload ? '100%' : '24%',
      message: 'Upload failed. Please try again.',
      busy: false
    });
  } finally {
    dom.pdf.value = '';
  }
}

async function submitQuestion(message) {
  await ensureSessionReady();

  if (!appState.sessionId) {
    const fallbackText = 'A session could not be created, so the handbook answer is unavailable right now.';
    appendMessage('assistant', fallbackText);
    return {
      ok: false,
      text: fallbackText,
      citations: []
    };
  }

  appendMessage('user', message);
  dom.message.value = '';
  setComposerBusy(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: appState.sessionId, message })
    });
    const data = await res.json();

    const answerText = res.ok ? data.text : data.error || 'Something went wrong.';
    const citations = res.ok ? data.citations || [] : [];
    appendMessage('assistant', answerText, citations);

    return {
      ok: res.ok,
      text: answerText,
      citations
    };
  } catch (error) {
    const fallbackText = 'Something went wrong while checking the handbook. Please try again.';
    appendMessage('assistant', fallbackText);
    return {
      ok: false,
      text: fallbackText,
      citations: []
    };
  } finally {
    setComposerBusy(false);
    dom.message.focus();
  }
}

async function sendMessage() {
  const message = dom.message.value.trim();
  if (!message || appState.isSending) return;
  await submitQuestion(message);
}

async function loadLiveInfo() {
  try {
    const res = await fetch('/api/live-config');
    const data = await res.json();
    dom.liveInfo.textContent = DEFAULT_LIVE_SUMMARY;
    dom.liveInfo.title = data.note || DEFAULT_LIVE_SUMMARY;
  } catch (error) {
    dom.liveInfo.textContent = 'Voice setup info is unavailable right now, but text chat still works.';
  }
}

function speakText(text, state = VOICE_STATES.SPEAKING, detail = '') {
  const spokenText = stripCitationMarkers(text);

  if (!spokenText || !hasSpeechSynthesisSupport()) {
    return Promise.resolve();
  }

  cancelSpeechOutput();

  return new Promise((resolve) => {
    const utterance = new window.SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'en-US';

    utterance.onstart = () => {
      if (voiceAssistant.active) {
        setVoiceState(state, detail);
      }
    };

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

function startListening() {
  if (!voiceAssistant.active) return;

  const recognition = ensureRecognition();
  if (!recognition) {
    stopVoiceAssistant('Speech recognition is not supported in this browser. Use text chat instead.');
    return;
  }

  voiceAssistant.heardSpeech = false;
  voiceAssistant.recognitionHandled = false;
  voiceAssistant.stopRequested = false;
  setVoiceState(VOICE_STATES.LISTENING, 'Listening for your next handbook question.');

  try {
    recognition.start();
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('already started')) {
      void repromptForAnotherQuestion(
        'The microphone is busy. Please ask your company policy question again.',
        'Retrying after a microphone issue.'
      );
    }
  }
}

async function repromptForAnotherQuestion(promptText, detail) {
  if (!voiceAssistant.active) return;

  if (hasSpeechSynthesisSupport()) {
    await speakText(promptText, VOICE_STATES.SPEAKING, detail);
  } else {
    setVoiceState(VOICE_STATES.LISTENING, `${detail} Speech playback is unavailable.`);
  }

  if (voiceAssistant.active) {
    startListening();
  }
}

async function handleRecognizedQuestion(transcript) {
  if (!voiceAssistant.active) return;

  dom.message.value = transcript;
  const result = await submitQuestion(transcript);
  if (!voiceAssistant.active) return;

  const spokenAnswer = stripCitationMarkers(result.text) || "I couldn't find that in the handbook.";

  if (hasSpeechSynthesisSupport()) {
    await speakText(spokenAnswer, VOICE_STATES.SPEAKING, 'Speaking the handbook answer.');
    if (!voiceAssistant.active) return;
    await speakText(
      'Do you have another company policy question?',
      VOICE_STATES.SPEAKING,
      'Prompting for another policy question.'
    );
  } else {
    setVoiceState(
      VOICE_STATES.LISTENING,
      'Speech playback is unavailable, so the answer is shown in chat.'
    );
  }

  if (voiceAssistant.active) {
    startListening();
  }
}

async function startVoiceAssistant() {
  if (voiceAssistant.active) {
    stopVoiceAssistant();
    return;
  }

  if (!getSpeechRecognitionConstructor()) {
    setVoiceState(VOICE_STATES.STOPPED, 'Speech recognition is not supported in this browser. Use text chat instead.');
    return;
  }

  await ensureSessionReady();
  if (!appState.sessionId) {
    setVoiceState(VOICE_STATES.STOPPED, 'Could not create a session for voice mode. Please try again.');
    return;
  }

  voiceAssistant.active = true;
  cancelSpeechOutput();

  if (hasSpeechSynthesisSupport()) {
    setVoiceState(VOICE_STATES.GREETING, 'Starting the guided policy assistant.');
    await speakText(
      'Hi, what doubt do you have regarding the company policy?',
      VOICE_STATES.GREETING,
      'Starting the guided policy assistant.'
    );
  } else {
    setVoiceState(
      VOICE_STATES.GREETING,
      'Speech playback is unavailable, so answers will stay in the transcript.'
    );
  }

  if (voiceAssistant.active) {
    startListening();
  }
}

dom.newSessionButton.addEventListener('click', () => {
  void newSession();
});

dom.uploadButton.addEventListener('click', () => {
  dom.pdf.click();
});

dom.attachButton.addEventListener('click', () => {
  dom.pdf.click();
});

dom.pdf.addEventListener('change', () => {
  void uploadPdf();
});

dom.composer.addEventListener('submit', (event) => {
  event.preventDefault();
  void sendMessage();
});

dom.voiceToggleButton.addEventListener('click', () => {
  void startVoiceAssistant();
});

dom.personaButton.addEventListener('click', () => {
  void startVoiceAssistant();
});

ensureTimestampRefreshLoop();
setUploadUi({ width: '24%', message: 'No handbook indexed yet.', busy: false });
setVoiceState(VOICE_STATES.IDLE, 'Loading session...');
void newSession();
void loadLiveInfo();
