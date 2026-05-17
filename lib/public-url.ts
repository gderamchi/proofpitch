import { lookup } from "node:dns/promises";
import net from "node:net";

function normalizedHostname(url: URL) {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPrivateIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpv4(normalized.replace("::ffff:", ""));
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8")
  );
}

function isPublicIpAddress(address: string) {
  const family = net.isIP(address);

  if (family === 4) {
    return !isPrivateIpv4(address);
  }

  if (family === 6) {
    return !isPrivateIpv6(address);
  }

  return false;
}

export function parseHttpUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https product URLs are supported.");
  }

  return url;
}

export async function assertPublicHttpUrl(value: string) {
  const url = parseHttpUrl(value);
  const hostname = normalizedHostname(url);

  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("Product URL must resolve to a public HTTP(S) host.");
  }

  if (net.isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Product URL must resolve to a public HTTP(S) host.");
    }

    return url;
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });

  if (!addresses.length || addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new Error("Product URL must resolve to a public HTTP(S) host.");
  }

  return url;
}
