import test from 'node:test';
import assert from 'node:assert/strict';
import { VOICE_STATES, getVoiceStatusText, stripCitationMarkers } from '../public/voiceHelpers.js';

test('stripCitationMarkers removes inline citation markers for speech playback', () => {
  assert.equal(
    stripCitationMarkers('Office hours are 9 to 5 [1], Monday to Friday [2].'),
    'Office hours are 9 to 5, Monday to Friday.'
  );
});

test('stripCitationMarkers collapses extra whitespace after removing citations', () => {
  assert.equal(
    stripCitationMarkers('See [1]   the office hours policy [2] for details.'),
    'See the office hours policy for details.'
  );
});

test('getVoiceStatusText returns readable state text', () => {
  assert.equal(
    getVoiceStatusText(VOICE_STATES.PROCESSING, 'Searching the handbook now.'),
    'Checking the handbook... Searching the handbook now.'
  );
});
