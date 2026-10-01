import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createCrossrefClient } from "@/lib/research/references/crossref";
import { createOpenAlexClient } from "@/lib/research/references/openalex";
import { parseReferenceLookupConfig } from "@/lib/config/research";

const crossrefFixture = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "fixtures/crossref-work.json"),
    "utf8",
  ),
) as unknown;

const openalexFixture = JSON.parse(
  readFileSync(
    path.join(import.meta.dirname, "fixtures/openalex-work.json"),
    "utf8",
  ),
) as unknown;

describe("parseReferenceLookupConfig", () => {
  it("requires only the Crossref contact email", () => {
    expect(() => parseReferenceLookupConfig({})).toThrow(/CROSSREF_CONTACT_EMAIL/);
    expect(
      parseReferenceLookupConfig({
        CROSSREF_CONTACT_EMAIL: "ops@example.com",
      }).crossrefContactEmail,
    ).toBe("ops@example.com");
  });
});

describe("Crossref adapter", () => {
  it("maps a DOI lookup fixture to a canonical work", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(crossrefFixture)));
    const client = createCrossrefClient({
      email: "ops@example.com",
      fetchImpl,
    });
    const work = await client.lookupDoi("https://doi.org/10.1038/nature12373");
    expect(work?.title).toBe("A fake but stable climate meta analysis");
    expect(work?.authors).toEqual(["Ada Example"]);
    expect(work?.year).toBe(2020);
    expect(work?.doi).toBe("10.1038/nature12373");
    expect(work?.abstract).toBe("Verified abstract text.");
  });
});

describe("OpenAlex adapter", () => {
  it("maps a DOI lookup fixture to a canonical work", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(openalexFixture)));
    const client = createOpenAlexClient({
      email: "ops@example.com",
      fetchImpl,
    });
    const work = await client.lookupDoi("10.1038/nature12373");
    expect(work?.title).toBe("A fake but stable climate meta analysis");
    expect(work?.provider).toBe("openalex");
    expect(work?.doi).toBe("10.1038/nature12373");
  });
});
