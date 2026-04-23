const TRANSIENT_STATUS_CODES = new Set([429, 500, 503, 504]);
const TRANSIENT_PROVIDER_STATUSES = new Set([
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'UNAVAILABLE',
  'DEADLINE_EXCEEDED'
]);

function parseJson(value) {
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getGeminiErrorInfo(error) {
  const messagePayload = parseJson(error?.message);
  const providerError = error?.error || messagePayload?.error || messagePayload || null;

  return {
    statusCode: toNumber(error?.statusCode) ?? toNumber(error?.status) ?? toNumber(providerError?.code),
    providerStatus: providerError?.status || error?.details?.providerStatus || null,
    requestId: error?.request_id || error?.details?.requestId || null,
    type: error?.type || providerError?.type || error?.details?.type || 'internal_error',
    rawMessage: providerError?.message || error?.message || 'Gemini request failed.'
  };
}

export function isTransientGeminiError(error) {
  const info = getGeminiErrorInfo(error);
  return (
    TRANSIENT_STATUS_CODES.has(info.statusCode) ||
    TRANSIENT_PROVIDER_STATUSES.has(info.providerStatus)
  );
}

export function isGeminiApiError(error) {
  if (error?.details?.providerStatus) {
    return true;
  }

  const info = getGeminiErrorInfo(error);
  return Boolean(info.providerStatus) || /gemini/i.test(info.rawMessage);
}

function getFriendlyGeminiMessage(info, fallbackMessage) {
  if (info.statusCode === 429 || info.providerStatus === 'RESOURCE_EXHAUSTED') {
    return 'The language model is rate limited right now. Please retry in a moment.';
  }

  if (info.statusCode === 503 || info.providerStatus === 'UNAVAILABLE') {
    return 'The language model is temporarily overloaded. Please retry in a moment.';
  }

  if (info.statusCode === 500 || info.statusCode === 504) {
    return 'The language model is temporarily unavailable. Please retry in a moment.';
  }

  return info.rawMessage || fallbackMessage;
}

export function normalizeGeminiError(error, fallbackMessage = 'Gemini request failed.') {
  if (error?.statusCode && error?.message && error?.details) {
    return error;
  }

  const info = getGeminiErrorInfo(error);

  return {
    statusCode: info.statusCode || 500,
    message: getFriendlyGeminiMessage(info, fallbackMessage),
    details: {
      type: info.type,
      requestId: info.requestId,
      providerStatus: info.providerStatus
    }
  };
}

export function getRetryDelayMs(attempt, baseDelayMs, random = Math.random) {
  const jitter = Math.floor(random() * baseDelayMs);
  return baseDelayMs * (2 ** attempt) + jitter;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateContentWithRetry({
  baseDelayMs,
  contents,
  fallbackModel,
  generateContent,
  maxRetries,
  model,
  random = Math.random,
  sleep = wait
}) {
  const models = [model, fallbackModel].filter(Boolean);
  let lastError = null;

  for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
    const activeModel = models[modelIndex];

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await generateContent({
          model: activeModel,
          contents
        });
      } catch (error) {
        if (!isTransientGeminiError(error)) {
          throw normalizeGeminiError(error, 'Failed to answer from handbook context.');
        }

        lastError = error;

        if (attempt < maxRetries) {
          await sleep(getRetryDelayMs(attempt, baseDelayMs, random));
          continue;
        }

        break;
      }
    }
  }

  throw normalizeGeminiError(lastError, 'Failed to answer from handbook context.');
}
