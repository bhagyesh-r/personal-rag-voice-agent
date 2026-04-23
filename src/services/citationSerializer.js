import path from 'path';

export function getSourceName(metadata = {}) {
  if (metadata.sourceName) {
    return metadata.sourceName;
  }

  if (metadata.source) {
    return path.basename(metadata.source);
  }

  return 'Unknown document';
}

export function serializeCitation(match, index) {
  const metadata = match?.metadata || {};

  return {
    id: index + 1,
    page: metadata.page,
    chunk: metadata.chunk,
    score: match?.score,
    text: metadata.text,
    sourceName: getSourceName(metadata)
  };
}
