const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/i;

export function normalizeDoi(raw: string): string | undefined {
  const value = raw.trim();
  const stripped = value
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!DOI_PATTERN.test(stripped)) {
    return undefined;
  }
  return stripped.replace(/[.,;)\]]+$/, "");
}

export function extractDoiFromText(raw: string): string | undefined {
  const fromUrl = normalizeDoi(raw);
  if (fromUrl) {
    return fromUrl;
  }
  const match = raw.match(/10\.\d{4,9}\/\S+/i);
  return match ? normalizeDoi(match[0]) : undefined;
}
