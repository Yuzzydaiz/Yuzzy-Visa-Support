import { expect, test, type Page, type Route } from "@playwright/test";

const TOKEN = "e2e-token";
const ACCESS_STORAGE_KEY = "yuzzy-research-access-v1";

const completedPaper = {
  requestId: "req_e2e",
  publicId: "pap_done",
  status: "completed",
  title: "Verified sources in visa-related research writing",
  editorVersion: 0,
  citationStyle: "apa",
  sections: [
    {
      sectionId: "abstract",
      type: "abstract",
      title: "Abstract",
      generationStatus: "complete",
      plainText: "Draft prose (Example, 2020).",
      citationHtml: "Draft prose (Example, 2020).",
      contentJson: {
        sectionId: "abstract",
        title: "Abstract",
        paragraphs: [{ text: "Draft prose [CITE:ref_01]." }],
        usedReferenceIds: ["ref_01"],
        wordCountEstimate: 4,
      },
    },
  ],
  references: [
    {
      refId: "ref_01",
      title: "Climate synthesis",
      authors: ["Ada Example"],
      year: 2020,
      verificationStatus: "verified",
      selectedByUser: true,
      contentStatus: "abstract",
    },
  ],
  bibliography: ["Example, A. (2020). Climate synthesis."],
  regeneration: { used: 0, limit: 3 },
  generation: { completedSteps: ["outline", "abstract"] },
  editorDocument: {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2, sectionId: "abstract" },
        content: [{ type: "text", text: "Abstract" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Draft prose " },
          { type: "citation", attrs: { refIds: ["ref_01"] } },
          { type: "text", text: "." },
        ],
      },
    ],
  },
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function visit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, token }) => {
      window.sessionStorage.setItem(key, JSON.stringify({ token }));
    },
    { key: ACCESS_STORAGE_KEY, token: TOKEN },
  );
});

test("home keeps the Book CTA and research entry", async ({ page }) => {
  await visit(page, "/");
  await expect(
    page.getByRole("button", { name: "Generate your research in minutes" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Book a Free Consultation" }).first(),
  ).toBeVisible();
});

test("research page shows the AI-draft disclosure", async ({ page }) => {
  await visit(page, "/research");
  await expect(
    page.getByText("This is an AI-assisted draft", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Book a Free Consultation" }).first(),
  ).toBeVisible();
});

test("ambiguous resolve requires a candidate pick", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("yuzzy-research-draft-v1");
  });
  await page.route("**/api/research/references/resolve", (route) =>
    json(route, {
      results: [
        {
          originalInput: "Smith climate 2020",
          verificationStatus: "ambiguous",
          candidates: [
            {
              title: "Climate paper one",
              authors: ["Ada Example"],
              year: 2020,
              doi: "10.1000/one",
            },
            {
              title: "Climate paper two",
              authors: ["Bea Second"],
              year: 2019,
              doi: "10.1000/two",
            },
          ],
        },
      ],
    }),
  );

  await visit(page, "/research");
  await expect(page.getByText("Explore mode is on", { exact: false })).toBeVisible();
  // visit() returns at DOMContentLoaded, before React hydrates; a click on the
  // server-rendered step button can land before its handler is attached.
  // Retry the click until the step actually changes.
  await expect(async () => {
    await page
      .getByRole("navigation", { name: "Draft steps" })
      .getByRole("button", { name: "References", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Key references" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass({ timeout: 15_000 });
  await page.getByLabel("DOI, URL, or citation").fill("Smith climate 2020");
  await page.getByRole("button", { name: "Match sources" }).click();
  await expect(page.getByRole("button", { name: /Climate paper one/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Climate paper two/ })).toBeVisible();
});

test("generate-next before pay is denied", async ({ page }) => {
  await page.route("**/api/research/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("generate-next") && method === "POST") {
      await json(
        route,
        {
          code: "PAYMENT_REQUIRED",
          message: "Payment is required before generation can start.",
        },
        422,
      );
      return;
    }
    await json(route, {
      requestId: "req_unpaid",
      publicId: "pap_unpaid",
      status: "ready",
      title: "Unpaid draft",
      sections: [],
      bibliography: [],
      generation: { completedSteps: [] },
    });
  });

  await visit(page, "/research/paper/pap_unpaid");
  await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(
    page.getByText("Payment is required before generation can start."),
  ).toBeVisible();
});

test("completed paper shows editor chrome and reload after a 409 save", async ({
  page,
}) => {
  await page.route("**/api/research/**", async (route) => {
    if (route.request().method() === "PATCH") {
      await json(
        route,
        {
          code: "VERSION_CONFLICT",
          message: "This draft was saved from another tab. Reload to continue.",
        },
        409,
      );
      return;
    }
    await json(route, completedPaper);
  });

  await visit(page, "/research/paper/pap_done");
  await expect(page.getByRole("button", { name: "Download DOCX" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
  await expect(page.getByText("Regenerate section", { exact: false })).toBeVisible();
  await page.locator("[contenteditable='true']").first().click();
  await page.keyboard.type(" extra");
  await expect(page.getByRole("button", { name: "Reload" })).toBeVisible({
    timeout: 10_000,
  });
});

test("regeneration renders the updated canonical document", async ({ page }) => {
  await page.route("**/api/research/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/regenerate")) {
      await json(route, {
        ...completedPaper,
        editorVersion: 2,
        regeneration: { used: 1, limit: 3 },
        editorDocument: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2, sectionId: "abstract" },
              content: [{ type: "text", text: "Abstract" }],
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "Regenerated body." }],
            },
          ],
        },
      });
      return;
    }
    await json(route, completedPaper);
  });

  await visit(page, "/research/paper/pap_done");
  await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[contenteditable='true']").first()).toContainText("Draft prose");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();
  await expect(page.locator("[contenteditable='true']").first()).toContainText(
    "Regenerated body",
  );
  await expect(page.locator("[contenteditable='true']").first()).not.toContainText(
    "Draft prose",
  );
});

test("privacy notice is readable and research Book CTA stays", async ({ page }) => {
  await visit(page, "/research/privacy");
  await expect(
    page.getByRole("heading", { name: "Research draft privacy" }),
  ).toBeVisible();
  await expect(page.getByText("We do not store card numbers", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Book a Free Consultation" }).first(),
  ).toBeVisible();
});

test("order email is visible and required without opening optional details", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("yuzzy-research-draft-v1");
  });
  await visit(page, "/research");
  const email = page.getByLabel("Email for this order");
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("required", "");
  // The field must not be hidden inside the collapsed optional-details section.
  await expect(page.locator("details[open]")).toHaveCount(0);
  await expect(page.getByText("Optional details")).toBeVisible();
});

test("pending autosave flushes before regeneration and clears stale edits", async ({
  page,
}) => {
  const order: string[] = [];
  await page.route("**/api/research/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/regenerate")) {
      order.push("regenerate");
      await json(route, {
        ...completedPaper,
        editorVersion: 2,
        regeneration: { used: 1, limit: 3 },
      });
      return;
    }
    if (method === "PATCH") {
      order.push("patch");
      await json(route, { ...completedPaper, editorVersion: 1 });
      return;
    }
    await json(route, completedPaper);
  });

  await visit(page, "/research/paper/pap_done");
  await expect(page.getByRole("button", { name: "Regenerate", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.locator("[contenteditable='true']").first().click();
  await page.keyboard.type(" stale-edit");
  await page.getByRole("button", { name: "Regenerate", exact: true }).click();

  await expect.poll(() => order.includes("regenerate")).toBe(true);
  expect(order).toContain("patch");
  expect(order.indexOf("patch")).toBeLessThan(order.indexOf("regenerate"));
  await expect(page.locator("[contenteditable='true']").first()).not.toContainText(
    "stale-edit",
  );
});

