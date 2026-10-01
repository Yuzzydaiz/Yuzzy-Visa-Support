export const CITE_TOKEN = /\[CITE:([a-zA-Z0-9_,;-]+)\]/g;

export class CitationTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CitationTokenError";
  }
}

export function parseCiteIds(tokenBody: string): string[] {
  return tokenBody
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function extractCiteTokens(text: string): string[][] {
  const found: string[][] = [];
  const pattern = new RegExp(CITE_TOKEN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    found.push(parseCiteIds(match[1] ?? ""));
  }
  return found;
}

export function collectCitedIds(text: string): string[] {
  const ids = new Set<string>();
  for (const group of extractCiteTokens(text)) {
    for (const id of group) {
      ids.add(id);
    }
  }
  return [...ids];
}

export function assertAllowedCiteIds(
  text: string,
  allowed: Set<string>,
): void {
  for (const id of collectCitedIds(text)) {
    if (!allowed.has(id)) {
      throw new CitationTokenError(`Unknown or disallowed citation id: ${id}`);
    }
  }
}

export function replaceCiteTokens(
  text: string,
  replace: (ids: string[]) => string,
): string {
  return text.replace(CITE_TOKEN, (_all, body: string) =>
    replace(parseCiteIds(body)),
  );
}
