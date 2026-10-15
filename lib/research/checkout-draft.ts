import {
  IDEMPOTENCY_STORAGE_KEY,
  type ResearchDraft,
} from "@/lib/research/draft";

type KeyStorage = Pick<Storage, "getItem" | "setItem">;

export function detailsPayload(draft: ResearchDraft) {
  return {
    title: draft.title,
    focus: draft.focus,
    paperType: draft.paperType,
    authors: draft.authors.map((author) => ({
      name: author.name,
      affiliation: author.affiliation,
      department: author.department,
      email: author.email,
      orcid: author.orcid,
    })),
    citationStyle: draft.citationStyle,
    requestedPages: draft.requestedPages,
    allowAdditionalSources: draft.allowAdditionalSources,
    researchNotes: draft.researchNotes || undefined,
    actualMethodology: draft.actualMethodology || undefined,
    actualFindings: draft.actualFindings || undefined,
    customerEmail: draft.customerEmail,
  };
}

export function orderBody(draft: ResearchDraft) {
  return {
    paper: {
      ...detailsPayload(draft),
      customerEmail: draft.customerEmail,
    },
    references: draft.references.map((reference) => ({
      id: reference.id,
      originalInput: reference.originalInput,
      userProvidedNotes: reference.userProvidedNotes || undefined,
      verificationStatus:
        reference.verificationStatus === "verified" ||
        reference.verificationStatus === "ambiguous" ||
        reference.verificationStatus === "unverified"
          ? reference.verificationStatus
          : "unverified",
      contentStatus: reference.contentStatus,
      isSystemAdded: reference.isSystemAdded,
      isUserKeyReference: reference.isUserKeyReference,
      selectedByUser: reference.selectedByUser,
      matched: reference.matched
        ? {
            title: reference.matched.title,
            authors: reference.matched.authors,
            year: reference.matched.year,
            journal: reference.matched.journal,
            doi: reference.matched.doi,
            url: reference.matched.url,
            abstract: reference.matched.abstract,
          }
        : undefined,
    })),
  };
}

export type StoredIdempotency = { key: string; fingerprint: string };

// The key is bound to the exact order payload. Editing the draft after a
// checkout was created produces a new key, so the server cannot hand back the
// earlier order (with its old pages, price, or sources) for a changed draft.
export function idempotencyKeyFor(
  fingerprint: string,
  storage: KeyStorage,
  newKey: () => string = () => crypto.randomUUID(),
): string {
  try {
    const raw = storage.getItem(IDEMPOTENCY_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<StoredIdempotency>) : null;
    if (stored?.key && stored.fingerprint === fingerprint) {
      return stored.key;
    }
  } catch {
    /* fall through to a fresh key */
  }
  const key = newKey();
  try {
    storage.setItem(
      IDEMPOTENCY_STORAGE_KEY,
      JSON.stringify({ key, fingerprint } satisfies StoredIdempotency),
    );
  } catch {
    /* storage unavailable: the key still works for this request */
  }
  return key;
}

