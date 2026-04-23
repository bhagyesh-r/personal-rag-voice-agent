function pluralize(value, singular, plural = `${singular}S`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function formatRelativeTime(timestamp, now = Date.now()) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) {
    return 'JUST NOW';
  }

  const diffMs = now - value;
  if (diffMs < 0) {
    return 'JUST NOW';
  }

  const seconds = Math.round(diffMs / 1000);
  if (seconds < 45) {
    return 'JUST NOW';
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${pluralize(minutes, 'MIN', 'MINS')} AGO`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${pluralize(hours, 'HR', 'HRS')} AGO`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return `${pluralize(days, 'DAY')} AGO`;
  }

  return new Date(value)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase();
}

export function truncateSnippet(text, maxLength = 180) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length <= maxLength) {
    return normalized || 'Context used for answer grounding.';
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildPayloadItem(label, description, icon) {
  return { label, description, icon };
}

function getDocumentIcon(label) {
  if (/\.pdf$/i.test(label)) return 'description';
  if (/\.(doc|docx)$/i.test(label)) return 'shield';
  return 'folder';
}

export function derivePayloadObjects(citations = [], uploadInfo = null) {
  const seen = new Set();
  const items = [];

  const addItem = (label, description, icon = getDocumentIcon(label)) => {
    const normalizedLabel = String(label || '').trim();
    if (!normalizedLabel) return;

    const key = normalizedLabel.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    items.push(buildPayloadItem(normalizedLabel, description, icon));
  };

  if (uploadInfo?.documentName) {
    const descriptionParts = ['Indexed handbook'];
    if (uploadInfo.pages != null) {
      descriptionParts.push(`${uploadInfo.pages} pages`);
    }
    if (uploadInfo.chunks != null) {
      descriptionParts.push(`${uploadInfo.chunks} chunks`);
    }

    addItem(uploadInfo.documentName, descriptionParts.join(' · '));
  }

  citations.forEach((citation) => {
    const label = citation?.sourceName;
    if (!label) return;

    const detailParts = ['Referenced in active answer'];
    if (citation.page != null) {
      detailParts.push(`Page ${citation.page}`);
    }
    if (citation.chunk != null) {
      detailParts.push(`Chunk ${citation.chunk}`);
    }

    addItem(label, detailParts.join(' · '));
  });

  return items;
}
