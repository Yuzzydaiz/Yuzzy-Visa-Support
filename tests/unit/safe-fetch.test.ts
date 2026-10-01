import { describe, expect, it, vi } from "vitest";

import {
  assertPublicHttpUrl,
  createPinnedLookup,
  isBlockedIp,
  safeFetch,
  SsrfBlockedError,
  type DnsLookup,
  type SafeFetchResponse,
} from "@/lib/research/security/safe-fetch";

function response(input: {
  status: number;
  contentType?: string;
  location?: string;
  body?: string;
}): SafeFetchResponse {
  const headers = new Map<string, string>();
  if (input.contentType) headers.set("content-type", input.contentType);
  if (input.location) headers.set("location", input.location);
  return {
    status: input.status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    body: Buffer.from(input.body ?? ""),
  };
}

describe("assertPublicHttpUrl", () => {
  it("rejects loopback, localhost, file, and metadata hosts", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/")).toThrow(SsrfBlockedError);
    expect(() => assertPublicHttpUrl("http://localhost/")).toThrow(SsrfBlockedError);
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(SsrfBlockedError);
    expect(() => assertPublicHttpUrl("http://169.254.169.254/latest")).toThrow(
      SsrfBlockedError,
    );
  });

  it("accepts a public https URL shape", () => {
    const url = assertPublicHttpUrl("https://doi.org/10.1038/nature12373");
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("doi.org");
  });
});

describe("isBlockedIp", () => {
  it("blocks private and link-local ranges", () => {
    expect(isBlockedIp("10.0.0.1")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("172.16.0.2")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});

describe("createPinnedLookup", () => {
  it("rejects a DNS rebind where the connect-time lookup returns a private IP", async () => {
    let calls = 0;
    const lookup: DnsLookup = async () => {
      calls += 1;
      return calls === 1
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }];
    };
    const pinned = createPinnedLookup(lookup);
    const first = await new Promise<unknown[]>((resolve) =>
      pinned("rebind.example", {}, (...args) => resolve(args)),
    );
    expect(first[0]).toBeNull();
    expect(first[1]).toBe("93.184.216.34");
    const second = await new Promise<unknown[]>((resolve) =>
      pinned("rebind.example", {}, (...args) => resolve(args)),
    );
    expect(second[0]).toBeInstanceOf(SsrfBlockedError);
  });
});

describe("safeFetch", () => {
  it("re-checks DNS after a redirect to a private IP", async () => {
    const lookup = vi.fn(async (hostname: string) => {
      if (hostname === "example.com") {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      if (hostname === "evil.internal") {
        return [{ address: "127.0.0.1", family: 4 }];
      }
      return [{ address: "1.1.1.1", family: 4 }];
    });
    const transport = vi.fn(async () =>
      response({ status: 302, location: "http://evil.internal/secret" }),
    );

    await expect(
      safeFetch("https://example.com/paper", { transport, lookup }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("returns the body for a public mocked response", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const transport = vi.fn(async () =>
      response({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<html><title>ok</title></html>",
      }),
    );
    const result = await safeFetch("https://example.com/paper", {
      transport,
      lookup,
    });
    expect(result.body).toContain("ok");
    expect(result.contentType).toBe("text/html");
  });

  it("rejects a body larger than maxBytes", async () => {
    const lookup = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
    const transport = vi.fn(async () =>
      response({ status: 200, contentType: "text/html", body: "x".repeat(200) }),
    );
    await expect(
      safeFetch("https://example.com/paper", {
        transport,
        lookup,
        maxBytes: 100,
      }),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });
});
