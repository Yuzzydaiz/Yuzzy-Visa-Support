import "server-only";

import { lookup as defaultLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net, { type LookupFunction } from "node:net";

export class SsrfBlockedError extends Error {
  readonly code = "SSRF_BLOCKED" as const;

  constructor(message = "This URL cannot be fetched") {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

const METADATA_HOSTS = new Set(["169.254.169.254", "fd00:ec2::254"]);

export type DnsLookup = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string; family: number }>>;

export type SafeFetchResponse = {
  status: number;
  headers: { get(name: string): string | null };
  body: Buffer;
};

export type SafeTransport = (input: {
  url: URL;
  headers: Record<string, string>;
  timeoutMs: number;
  maxBytes: number;
  lookup: DnsLookup;
}) => Promise<SafeFetchResponse>;

export type SafeFetchOptions = {
  transport?: SafeTransport;
  lookup?: DnsLookup;
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  acceptedContentTypes?: readonly string[];
};

const DEFAULT_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "application/json",
  "text/plain",
  "application/xml",
  "text/xml",
];

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfBlockedError("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError("Only http and https URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || METADATA_HOSTS.has(host)) {
    throw new SsrfBlockedError("This host cannot be fetched");
  }
  if (net.isIP(host) && isBlockedIp(host)) {
    throw new SsrfBlockedError("This address cannot be fetched");
  }
  return url;
}

export function isBlockedIp(address: string): boolean {
  const ip = normalizeIp(address);
  if (!ip) {
    return true;
  }
  if (net.isIPv4(ip)) {
    return isBlockedV4(ip);
  }
  if (net.isIPv6(ip)) {
    return isBlockedV6(ip);
  }
  return true;
}

function normalizeIp(address: string): string {
  const trimmed = address.replace(/^\[|\]$/g, "");
  const mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) {
    return mapped[1];
  }
  return trimmed;
}

function isBlockedV4(ip: string): boolean {
  const [a, b] = ip.split(".").map((part) => Number.parseInt(part, 10));
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") {
    return true;
  }
  if (lower.startsWith("fe80:") || lower.startsWith("fec0:")) {
    return true;
  }
  const first = Number.parseInt(lower.split(":")[0] || "0", 16);
  if (first >= 0xfc00 && first <= 0xfdff) {
    return true;
  }
  if (METADATA_HOSTS.has(lower)) {
    return true;
  }
  return false;
}

async function assertResolvedPublic(
  url: URL,
  lookup: DnsLookup,
): Promise<void> {
  assertPublicHttpUrl(url.toString());
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new SsrfBlockedError("This address cannot be fetched");
    }
    return;
  }
  const records = await lookup(host, { all: true });
  if (!records.length) {
    throw new SsrfBlockedError("This host cannot be resolved");
  }
  for (const record of records) {
    if (isBlockedIp(record.address)) {
      throw new SsrfBlockedError("This host resolves to a private address");
    }
  }
}

export type NodeLookup = LookupFunction;

/**
 * A Node connection lookup that resolves the hostname and only ever hands the
 * socket a validated public address. Because the same lookup runs at connect
 * time, a DNS answer that changes between the pre-check and the connection
 * (DNS rebinding) is still rejected before the socket is opened.
 */
export function createPinnedLookup(lookup: DnsLookup): LookupFunction {
  return (hostname, _options, callback) => {
    lookup(hostname, { all: true })
      .then((records) => {
        const allowed = records.filter(
          (record) => !isBlockedIp(record.address),
        );
        if (!allowed.length) {
          callback(
            new SsrfBlockedError("This host resolves to a private address"),
            "",
            0,
          );
          return;
        }
        const first = allowed[0];
        callback(null, first.address, first.family);
      })
      .catch((error) =>
        callback(
          error instanceof Error ? error : new Error("DNS lookup failed"),
          "",
          0,
        ),
      );
  };
}

const defaultTransport: SafeTransport = (input) =>
  new Promise((resolve, reject) => {
    const transport = input.url.protocol === "https:" ? https : http;
    const request = transport.request(
      input.url,
      {
        method: "GET",
        headers: input.headers,
        lookup: createPinnedLookup(input.lookup),
        timeout: input.timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > input.maxBytes) {
            response.destroy();
            reject(new SsrfBlockedError("This URL body is too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: {
              get: (name: string) => {
                const value = response.headers[name.toLowerCase()];
                return Array.isArray(value) ? value.join(", ") : value ?? null;
              },
            },
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.on("timeout", () => {
      request.destroy();
      reject(new SsrfBlockedError("This URL could not be fetched"));
    });
    request.on("error", (error) => reject(error));
    request.end();
  });

export async function safeFetch(
  raw: string,
  options: SafeFetchOptions = {},
): Promise<{ url: string; contentType: string; body: string }> {
  const transport = options.transport ?? defaultTransport;
  const lookup = options.lookup ?? defaultLookup;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxRedirects = options.maxRedirects ?? 3;
  const maxBytes = options.maxBytes ?? 512_000;
  const accepted = options.acceptedContentTypes ?? DEFAULT_CONTENT_TYPES;

  let current = assertPublicHttpUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    await assertResolvedPublic(current, lookup);
    let response: SafeFetchResponse;
    try {
      response = await transport({
        url: current,
        headers: { Accept: accepted.join(", ") },
        timeoutMs,
        maxBytes,
        lookup,
      });
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        throw error;
      }
      throw new SsrfBlockedError("This URL could not be fetched");
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new SsrfBlockedError("Redirect is missing a location");
      }
      if (hop === maxRedirects) {
        throw new SsrfBlockedError("Too many redirects");
      }
      current = new URL(location, current);
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SsrfBlockedError("This URL returned an error");
    }

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      !accepted.some(
        (type) => contentType === type || contentType.startsWith(`${type}+`),
      )
    ) {
      throw new SsrfBlockedError("This URL did not return an allowed content type");
    }

    if (response.body.byteLength > maxBytes) {
      throw new SsrfBlockedError("This URL body is too large");
    }

    return {
      url: current.toString(),
      contentType,
      body: response.body.toString("utf8"),
    };
  }

  throw new SsrfBlockedError("Too many redirects");
}
