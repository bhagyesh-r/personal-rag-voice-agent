import { VOICE_STATES, getVoiceStatusText, stripCitationMarkers } from './voiceHelpers.js';

let sessionId = null;

const dom = {
  chat: document.getElementById('chat'),
  liveInfo: document.getElementById('liveInfo'),
  message: document.getElementById('message'),
  newSessionButton: document.getElementById('newSessionButton'),
  pdf: document.getElementById('pdf'),
  sendButton: document.getElementById('sendButton'),
  sessionInfo: document.getElementById('sessionInfo'),
  uploadButton: document.getElementById('uploadButton'),
  uploadStatus: document.getElementById('uploadStatus'),
  voiceStatus: document.getElementById('voiceStatus'),
  voiceToggleButton: document.getElementById('voiceToggleButton')
};

const voiceAssistant = {
  active: false,
  state: VOICE_STATES.IDLE,
  recognition: null,
  heardSpeech: false,
  recognitionHandled: false,
  stopRequested: false
};

function appendMessage(role, text, citations = []) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  const cited = citations.length
    ? `\n\nSources:\n${citations.map((c) => `[${c.id}] page ${c.page ?? 'unknown'} (score: ${(c.score ?? 0).toFixed(3)})`).join('\n')}`
    : '';
  div.innerText = `${role.toUpperCase()}: ${text}${cited}`;
  dom.chat.appendChild(div);
  dom.chat.scrollTop = dom.chat.scrollHeight;
}

function syncVoiceControls() {
  dom.voiceToggleButton.innerText = voiceAssistant.active
    ? 'Stop Voice Assistant'
    : 'Start Voice Assistant';
}

function setVoiceState(state, detail = '') {
  voiceAssistant.state = state;
  dom.voiceStatus.innerText = getVoiceStatusText(state, detail);
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

function stopVoiceAssistant(detail = 'You can restart it whenever you are ready.') {
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
    setVoiceState(VOICE_STATES.LISTENING);
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
    setVoiceState(VOICE_STATES.PROCESSING);
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
      stopVoiceAssistant('Microphone permission was denied. Use text chat or allow microphone access.');
      return;
    }

    if (event.error === 'audio-capture') {
      stopVoiceAssistant('No microphone was detected. Connect a microphone or use text chat.');
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
        'Waiting for you to ask a policy question.'
      );
    }
  };

  voiceAssistant.recognition = recognition;
  return recognition;
}

async function newSession() {
  if (voiceAssistant.active) {
    stopVoiceAssistant('Starting a fresh session.');
  }

  try {
    const res = await fetch('/api/session', { method: 'POST' });
    const data = await res.json();
    sessionId = data.sessionId;
    dom.sessionInfo.innerText = `Session: ${sessionId}`;
    dom.chat.innerHTML = '';
    dom.message.value = '';
    setVoiceState(VOICE_STATES.IDLE, 'Ready to start the voice assistant.');
  } catch (error) {
    sessionId = null;
    dom.sessionInfo.innerText = 'Session unavailable';
    setVoiceState(VOICE_STATES.STOPPED, 'Could not create a session. Refresh and try again.');
  }
}

async function ensureSessionReady() {
  if (!sessionId) {
    await newSession();
  }
}

async function uploadPdf() {
  const file = dom.pdf.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  dom.uploadStatus.innerText = 'Indexing...';

  try {
    const res = await fetch('/api/upload-handbook', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      dom.uploadStatus.innerText = data.error || 'Upload failed';
      return;
    }

    dom.uploadStatus.innerText = `Done. Pages: ${data.pages}, chunks: ${data.chunks}`;
  } catch (error) {
    dom.uploadStatus.innerText = 'Upload failed';
  }
}

async function submitQuestion(message) {
  await ensureSessionReady();

  if (!sessionId) {
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

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message })
    });
    const data = await res.json();

    const answerText = res.ok ? data.text : data.error || 'Something went wrong';
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
  }
}

async function sendMessage() {
  const message = dom.message.value.trim();
  if (!message) return;
  await submitQuestion(message);
}

async function loadLiveInfo() {
  try {
    const res = await fetch('/api/live-config');
    const data = await res.json();
    dom.liveInfo.innerText = data.note || 'Browser voice mode is ready.';
  } catch (error) {
    dom.liveInfo.innerText = 'Voice setup info is unavailable right now, but text chat can still work.';
  }
}

function speakText(text, state = VOICE_STATES.SPEAKING, detail = '') {
  const spokenText = stripCitationMarkers(text);

  if (!spokenText) {
    return Promise.resolve();
  }

  if (!hasSpeechSynthesisSupport()) {
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
  setVoiceState(VOICE_STATES.LISTENING);

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
    setVoiceState(VOICE_STATES.LISTENING, `${detail} Speech playback is unavailable, so follow the chat and keep speaking.`);
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
      'Speech playback is unavailable, so the answer is shown in chat. Ask another policy question when ready.'
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
  if (!sessionId) {
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
      'Speech playback is unavailable, so I will listen and show answers in chat.'
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
  void uploadPdf();
});
dom.sendButton.addEventListener('click', () => {
  void sendMessage();
});
dom.voiceToggleButton.addEventListener('click', () => {
  void startVoiceAssistant();
});
dom.message.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    void sendMessage();
  }
});

setVoiceState(VOICE_STATES.IDLE, 'Loading session...');
void newSession();
void loadLiveInfo();
