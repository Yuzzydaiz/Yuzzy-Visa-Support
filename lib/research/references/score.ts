import type { CanonicalWork } from "@/lib/research/references/types";

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstAuthorKey(authors: string[]): string {
  const first = authors[0]?.toLowerCase() ?? "";
  const parts = first.split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter((token) => token.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) {
    return 0;
  }
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap / new Set([...a, ...b]).size;
}

// Share of the candidate's title words that appear in the input.
function containment(input: Set<string>, title: Set<string>): number {
  if (!title.size) {
    return 0;
  }
  let found = 0;
  for (const token of title) {
    if (input.has(token)) {
      found += 1;
    }
  }
  return found / title.size;
}

// A full citation ("Bender, E. M. ... (2021). On the dangers of stochastic
// parrots ... Proceedings of ...") contains the title plus authors, venue,
// and year, so plain overlap scores the right paper low (0.18 for that
// example). Containment measures whether the title appears in the citation.
// It is weighted so it verifies only with the author or year also agreeing:
// a proceedings volume whose title is also contained, but which has no
// authors, then ranks clearly below the paper. Short titles ("Deep
// learning") appear inside too many citations to count this way.
const CONTAINMENT_WEIGHT = 0.7;
const CONTAINMENT_MIN_TITLE_TOKENS = 4;

function titleSimilarity(input: Set<string>, title: Set<string>): number {
  const overlap = jaccard(input, title);
  if (title.size < CONTAINMENT_MIN_TITLE_TOKENS) {
    return overlap;
  }
  return Math.max(overlap, containment(input, title) * CONTAINMENT_WEIGHT);
}

export function scoreCandidate(
  input: { titleHint?: string; yearHint?: number; authorHint?: string; doi?: string },
  candidate: CanonicalWork,
): number {
  if (input.doi && candidate.doi && input.doi.toLowerCase() === candidate.doi.toLowerCase()) {
    return 1;
  }

  const titleScore = input.titleHint
    ? titleSimilarity(tokenSet(input.titleHint), tokenSet(candidate.title))
    : 0;
  const yearConflict =
    input.yearHint &&
    candidate.year &&
    Math.abs(input.yearHint - candidate.year) > 1;
  const authorConflict =
    Boolean(input.authorHint) &&
    Boolean(candidate.authors.length) &&
    firstAuthorKey([input.authorHint ?? ""]) !== firstAuthorKey(candidate.authors);

  if (titleScore >= 0.6 && (yearConflict || authorConflict)) {
    return 0.45;
  }

  let score = titleScore;
  if (input.yearHint && candidate.year && input.yearHint === candidate.year) {
    score += 0.15;
  }
  if (
    input.authorHint &&
    firstAuthorKey([input.authorHint]) === firstAuthorKey(candidate.authors)
  ) {
    score += 0.15;
  }
  return Math.min(score, 0.99);
}

export function classifyCandidates(
  input: { titleHint?: string; yearHint?: number; authorHint?: string; doi?: string },
  candidates: CanonicalWork[],
): { status: "verified" | "ambiguous" | "unverified"; ranked: CanonicalWork[] } {
  const unique = dedupeWorks(candidates);
  const ranked = unique
    .map((candidate) => ({ candidate, score: scoreCandidate(input, candidate) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 0.72) {
    return { status: "unverified", ranked: ranked.map((item) => item.candidate) };
  }
  if (top.score === 1 || (top.score >= 0.85 && (!second || top.score - second.score >= 0.15))) {
    return { status: "verified", ranked: ranked.map((item) => item.candidate) };
  }
  if (second && second.score >= 0.72 && top.score - second.score < 0.12) {
    return { status: "ambiguous", ranked: ranked.map((item) => item.candidate).slice(0, 5) };
  }
  return { status: "verified", ranked: ranked.map((item) => item.candidate) };
}

export function dedupeWorks(works: CanonicalWork[]): CanonicalWork[] {
  const seen = new Set<string>();
  const out: CanonicalWork[] = [];
  for (const work of works) {
    const key = work.doi
      ? `doi:${work.doi.toLowerCase()}`
      : `tya:${normalizeTitle(work.title)}|${work.year ?? ""}|${firstAuthorKey(work.authors)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(work);
  }
  return out;
}
