import "server-only";

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "into",
  "using",
  "about",
  "among",
  "between",
  "review",
  "study",
  "paper",
  "research",
]);

export function deterministicConcepts(input: {
  title: string;
  focus?: string;
  confirmedTitles: string[];
  max?: number;
}): string[] {
  const max = input.max ?? 5;
  const blob = [input.title, input.focus ?? "", ...input.confirmedTitles].join(" ");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of blob.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOP.has(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
    if (out.length >= max) {
      break;
    }
  }
  return out.length ? out : [input.title.trim()].filter(Boolean).slice(0, 1);
}

export async function extractConceptsWithLuna(input: {
  title: string;
  focus?: string;
  confirmedTitles: string[];
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  max?: number;
}): Promise<string[]> {
  const max = input.max ?? 5;
  const fallback = deterministicConcepts(input);
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        model: input.model,
        temperature: 0,
        max_completion_tokens: 180,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Return JSON {"concepts": string[]} with 3 to 5 short academic search phrases. No prose.',
          },
          {
            role: "user",
            content: JSON.stringify({
              title: input.title,
              focus: input.focus ?? "",
              confirmedTitles: input.confirmedTitles.slice(0, 8),
              max,
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      return fallback;
    }
    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return fallback;
    }
    const parsed = JSON.parse(content) as { concepts?: unknown };
    const concepts = Array.isArray(parsed.concepts)
      ? parsed.concepts
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter((item) => item.length >= 3)
          .slice(0, max)
      : [];
    return concepts.length ? concepts : fallback;
  } catch {
    return fallback;
  }
}
