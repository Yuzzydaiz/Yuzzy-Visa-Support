"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PaperDetailsForm } from "@/components/research/paper-details-form";
import { ReferenceInputList } from "@/components/research/reference-input-list";
import { storeAccessToken } from "@/components/research/recovery-token";
import { OrderSummary } from "@/components/research/order-summary";
import { useResearchDraft } from "@/components/research/use-research-draft";
import { WizardStepper } from "@/components/research/wizard-stepper";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { parseResearchProductConfig } from "@/lib/config/research-product";
import {
  createReferenceListSchema,
  getResearchValidationSchemas,
} from "@/lib/validation/research";
import {
  detailsPayload,
  idempotencyKeyFor,
  orderBody,
} from "@/lib/research/checkout-draft";
import {
  emptyReference,
  referenceAllowsReview,
  referenceIncludedInOrder,
  type ActiveWizardStep,
  type ResearchDraft,
} from "@/lib/research/draft";

function issueMap(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (key && !out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}


export function ResearchWizard() {
  const { draft, update } = useResearchDraft();
  const config = useMemo(
    () =>
      parseResearchProductConfig({
        NEXT_PUBLIC_RESEARCH_WIZARD_STRICT:
          process.env.NEXT_PUBLIC_RESEARCH_WIZARD_STRICT,
      }),
    [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sourceError, setSourceError] = useState<string | undefined>();
  const [liveMessage, setLiveMessage] = useState("");
  const [matching, setMatching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [paying, setPaying] = useState(false);
  const [accessToken, setAccessToken] = useState<string | undefined>();
  const [checkout, setCheckout] = useState<
    { url: string; fingerprint: string } | undefined
  >();
  const currentFingerprint = useMemo(
    () => JSON.stringify(orderBody(draft)),
    [draft],
  );
  // A checkout belongs to the payload it was created for. Once the draft
  // changes, offer a fresh checkout instead of the stale Bachs link.
  const checkoutUrl =
    checkout?.fingerprint === currentFingerprint ? checkout.url : undefined;

  function go(step: ActiveWizardStep) {
    update({ step });
    setLiveMessage("");
  }

  function continueFromDetails() {
    if (config.wizardStrict) {
      const parsed = getResearchValidationSchemas(config).paperDetailsStrict.safeParse(
        detailsPayload(draft),
      );
      if (!parsed.success) {
        const next = issueMap(parsed.error);
        setErrors(next);
        setLiveMessage("Please fix the highlighted fields.");
        const firstKey = Object.keys(next)[0];
        if (firstKey) {
          const field = document.getElementById(
            firstKey === "customerEmail"
              ? "research-email"
              : firstKey === "title"
                ? "research-title"
                : firstKey === "requestedPages"
                  ? "research-pages"
                  : "",
          );
          field?.focus();
        }
        return;
      }
    }
    setErrors({});
    go("sources");
  }

  async function matchSources() {
    setMatching(true);
    setSourceError(undefined);
    try {
      const response = await fetch("/api/research/references/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          references: draft.references.map((reference) => ({
            id: reference.id,
            originalInput: reference.originalInput,
            userProvidedNotes: reference.userProvidedNotes || undefined,
          })),
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        results?: Array<{
          id?: string;
          originalInput: string;
          verificationStatus: "verified" | "ambiguous" | "unverified";
          contentStatus?: ResearchDraft["references"][number]["contentStatus"];
          matched?: NonNullable<ResearchDraft["references"][number]["matched"]>;
          candidates?: NonNullable<ResearchDraft["references"][number]["candidates"]>;
        }>;
      };
      if (!response.ok || !payload.results) {
        setSourceError(payload.message ?? "Matching failed. Try again.");
        setLiveMessage("Matching failed.");
        return;
      }
      const nextRefs = draft.references.map((reference) => {
          const result =
            payload.results?.find((item) => item.id === reference.id) ??
            payload.results?.find(
              (item) => item.originalInput === reference.originalInput.trim(),
            );
          if (!result) {
            return reference;
          }
          return {
            ...reference,
            verificationStatus: result.verificationStatus,
            contentStatus: result.contentStatus,
            matched: result.matched
              ? { ...result.matched, provider: "crossref" as const }
              : undefined,
            candidates: result.candidates ?? [],
          };
        });
      update({ references: nextRefs });
      setLiveMessage("Matching finished.");
      if (draft.allowAdditionalSources) {
        await discoverExtras(nextRefs);
      }
    } catch {
      setSourceError("Matching failed. Try again.");
    } finally {
      setMatching(false);
    }
  }

  async function discoverExtras(current = draft.references) {
    setDiscovering(true);
    setSourceError(undefined);
    try {
      const userRefs = current.filter((item) => !item.isSystemAdded);
      const response = await fetch("/api/research/references/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowAdditionalSources: draft.allowAdditionalSources,
          title: draft.title || "Untitled research paper draft",
          focus: draft.focus || undefined,
          references: userRefs.map((reference) => ({
            originalInput: reference.originalInput || "pending source",
            title: reference.matched?.title,
            doi: reference.matched?.doi,
            year: reference.matched?.year,
            authors: reference.matched?.authors,
          })),
        }),
      });
      const payload = (await response.json()) as {
        message?: string;
        results?: Array<{
          originalInput: string;
          verificationStatus: "verified";
          contentStatus?: ResearchDraft["references"][number]["contentStatus"];
          matched?: NonNullable<ResearchDraft["references"][number]["matched"]>;
        }>;
      };
      if (!response.ok) {
        setSourceError(payload.message ?? "Extra source search failed.");
        return;
      }
      const extras = (payload.results ?? []).map((item) => ({
        id: crypto.randomUUID(),
        originalInput: item.originalInput,
        userProvidedNotes: "",
        verificationStatus: item.verificationStatus,
        contentStatus: item.contentStatus,
        matched: item.matched
          ? { ...item.matched, provider: "openalex" as const }
          : undefined,
        isSystemAdded: true as const,
        isUserKeyReference: false as const,
        selectedByUser: true,
      }));
      update({
        references: [
          ...current.filter((item) => !item.isSystemAdded),
          ...extras,
        ],
      });
      setLiveMessage("Extra sources updated.");
    } catch {
      setSourceError("Extra source search failed.");
    } finally {
      setDiscovering(false);
    }
  }

  async function startCheckout() {
    if (!draft.customerEmail.trim()) {
      setSourceError("Add an email for this order before payment.");
      setLiveMessage("Email is required to pay.");
      return;
    }
    if (!draft.references.filter((item) => !item.isSystemAdded || item.selectedByUser !== false).every(referenceAllowsReview)) {
      setSourceError("Every selected source must be verified before payment.");
      return;
    }
    setPaying(true);
    setSourceError(undefined);
    try {
      const body = orderBody(draft);
      const fingerprint = JSON.stringify(body);
      const idempotencyKey = idempotencyKeyFor(fingerprint, sessionStorage);
      const response = await fetch("/api/research/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey, ...body }),
      });
      const payload = (await response.json()) as {
        message?: string;
        checkoutUrl?: string;
        accessToken?: string;
        paperPublicId?: string;
        orderPublicId?: string;
      };
      if (!response.ok || !payload.checkoutUrl) {
        setSourceError(payload.message ?? "Checkout failed. Try again.");
        return;
      }
      if (payload.accessToken && payload.paperPublicId && payload.orderPublicId) {
        storeAccessToken({
          token: payload.accessToken,
          paperPublicId: payload.paperPublicId,
          orderPublicId: payload.orderPublicId,
        });
        setAccessToken(payload.accessToken);
      }
      setCheckout({ url: payload.checkoutUrl, fingerprint });
      setLiveMessage("Checkout created. Save your recovery token.");
    } catch {
      setSourceError("Checkout failed. Try again.");
    } finally {
      setPaying(false);
    }
  }

  function continueFromSources() {
    if (config.wizardStrict) {
      const userRefs = draft.references.filter((reference) => !reference.isSystemAdded);
      const parsed = createReferenceListSchema(config).safeParse(
        userRefs.map((reference) => ({
          originalInput: reference.originalInput,
          userProvidedNotes: reference.userProvidedNotes || undefined,
        })),
      );
      if (!parsed.success) {
        setSourceError("Add at least one complete source (DOI, URL, or citation).");
        setLiveMessage("Add at least one complete source.");
        return;
      }
      if (
        draft.references.some(
          (reference) =>
            referenceIncludedInOrder(reference) &&
            (!reference.verificationStatus ||
              reference.verificationStatus === "pending"),
        )
      ) {
        setSourceError("Match sources before continuing to review.");
        setLiveMessage("Match sources first.");
        return;
      }
      if (!draft.references.every(referenceAllowsReview)) {
        setSourceError(
          "Every source must be verified. Pick a match or remove unmatched rows.",
        );
        setLiveMessage("Unverified sources block review.");
        return;
      }
    }
    setSourceError(undefined);
    go("review");
  }

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-8">
      <WizardStepper
        current={draft.step}
        onSelect={go}
        allowUpcoming={!config.wizardStrict}
      />
      <div>
        {!config.wizardStrict ? (
          <p className="mb-4 text-xs text-muted-foreground">
            {copy.research.wizard.exploreNotice}
          </p>
        ) : null}
        {draft.step === "details" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              continueFromDetails();
            }}
            className="space-y-6"
          >
            <h2 className="sr-only">Paper details</h2>
            <PaperDetailsForm draft={draft} errors={errors} onChange={update} />
            <Button type="submit" className="h-11 px-5">
              Continue to references
            </Button>
          </form>
        ) : null}

        {draft.step === "sources" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              continueFromSources();
            }}
            className="space-y-6"
          >
            <header>
              <h2 className="font-heading text-xl font-semibold">Key references</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add DOIs, URLs, or full citations. You can add as many as you need,
                up to {config.maxReferences}.
              </p>
            </header>
            <ReferenceInputList
              draft={draft}
              maxReferences={config.maxReferences}
              error={sourceError}
              onChange={update}
            />
            <div className="grid w-fit max-w-full grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full px-5"
                disabled={draft.references.length >= config.maxReferences}
                onClick={() =>
                  update({
                    references: [...draft.references, emptyReference()],
                  })
                }
              >
                {draft.references.length >= config.maxReferences
                  ? `Maximum ${config.maxReferences} sources`
                  : "Add source"}
              </Button>
              <Button
                type="button"
                className="h-11 w-full px-5"
                onClick={() => {
                  void matchSources();
                }}
                disabled={matching}
              >
                {matching ? "Matching…" : "Match sources"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full px-5"
                onClick={() => go("details")}
              >
                Back
              </Button>
              <Button type="submit" className="h-11 w-full px-5">
                Continue to review
              </Button>
            </div>
          </form>
        ) : null}

        {draft.step === "review" ? (
          <div className="space-y-6">
            <header>
              <h2 className="font-heading text-xl font-semibold">Review</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Check length, sources, and the price estimate.
              </p>
            </header>
            <OrderSummary draft={draft} config={config} onChange={update} />
            {sourceError && draft.step === "review" ? (
              <p className="text-sm text-destructive" role="alert">
                {sourceError}
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {copy.research.wizard.paymentSoon}{" "}
              <Link href="/research/privacy" className="underline underline-offset-2">
                {copy.research.wizard.privacyLink}
              </Link>
              . {copy.research.privacy.pricing} {copy.research.privacy.refunds}
            </p>
            {accessToken ? (
              <div className="rounded-[16px] border border-brand-navy/15 bg-brand-white p-4 text-sm">
                <p className="font-medium">Save this recovery token now.</p>
                <p className="mt-2 break-all font-mono text-xs">{accessToken}</p>
                <p className="mt-2 text-muted-foreground">
                  It is shown once. You need it if this browser loses the draft.
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 px-5"
                onClick={() => go("sources")}
              >
                Back
              </Button>
              {draft.allowAdditionalSources ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 px-5"
                  disabled={discovering}
                  onClick={() => {
                    void discoverExtras();
                  }}
                >
                  {discovering ? "Finding…" : "Find extra sources"}
                </Button>
              ) : null}
              {checkoutUrl ? (
                <Button
                  type="button"
                  className="h-11 px-5"
                  onClick={() => {
                    window.location.assign(checkoutUrl);
                  }}
                >
                  Continue to Bachs
                </Button>
              ) : (
                <Button
                  type="button"
                  className="h-11 px-5"
                  disabled={paying}
                  onClick={() => {
                    void startCheckout();
                  }}
                >
                  {paying ? "Starting checkout…" : "Continue to payment"}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
      </div>
    </div>
  );
}
