export const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  GREETING: 'greeting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  STOPPED: 'stopped'
});

const STATUS_LABELS = {
  [VOICE_STATES.IDLE]: 'Voice assistant is off.',
  [VOICE_STATES.GREETING]: 'Greeting...',
  [VOICE_STATES.LISTENING]: 'Listening for your policy question...',
  [VOICE_STATES.PROCESSING]: 'Checking the handbook...',
  [VOICE_STATES.SPEAKING]: 'Speaking the answer...',
  [VOICE_STATES.STOPPED]: 'Voice assistant stopped.'
};

export function stripCitationMarkers(text) {
  return String(text || '')
    .replace(/\[(?:\d+(?:\s*,\s*\d+)*)\]/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getVoiceStatusText(state, detail = '') {
  const base = STATUS_LABELS[state] || 'Voice assistant status unavailable.';
  return detail ? `${base} ${detail}` : base;
}
