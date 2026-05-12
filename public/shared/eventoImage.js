function splitUrlParts(url) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return { base: '', suffix: '' };
  const hashIdx = trimmed.indexOf('#');
  const qIdx = trimmed.indexOf('?');
  let cutIdx = -1;
  if (qIdx >= 0 && hashIdx >= 0) cutIdx = Math.min(qIdx, hashIdx);
  else cutIdx = qIdx >= 0 ? qIdx : hashIdx;
  if (cutIdx < 0) return { base: trimmed, suffix: '' };
  return { base: trimmed.slice(0, cutIdx), suffix: trimmed.slice(cutIdx) };
}

export function toHorizontalEventImage(url) {
  const { base, suffix } = splitUrlParts(url);
  if (!base) return '';

  let normalized = base;
  normalized = normalized.replace(/\/(?:xs|s|m)_poster\.(?:jpg|jpeg|png|webp)$/i, '/m_banner.jpg');
  normalized = normalized.replace(/_poster\.(jpg|jpeg|png|webp)$/i, '_banner.jpg');
  return `${normalized}${suffix}`;
}

export function withVersion(url, versionKey) {
  const clean = String(url || '').trim();
  if (!clean) return '';
  if (!versionKey) return clean;
  return clean.includes('?') ? `${clean}&v=${versionKey}` : `${clean}?v=${versionKey}`;
}
