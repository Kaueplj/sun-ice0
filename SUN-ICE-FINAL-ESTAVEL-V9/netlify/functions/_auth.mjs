import crypto from "node:crypto";
import { json } from "./_http.mjs";

const COOKIE = "sunice_session";
const MAX_AGE = 12 * 60 * 60;

function b64url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function timingSafeEqualText(a, b) {
  const ah = crypto.createHash("sha256").update(String(a)).digest();
  const bh = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

export function authConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.SESSION_SECRET);
}

export function validateCredentials(user, password) {
  const expectedUser = process.env.ADMIN_USER || "equipe";
  return timingSafeEqualText(user, expectedUser) && timingSafeEqualText(password, process.env.ADMIN_PASSWORD || "");
}

export function createSessionCookie() {
  const secret = process.env.SESSION_SECRET;
  const payload = b64url(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000, v: 1 }));
  const token = `${payload}.${sign(payload, secret)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(req) {
  if (!authConfigured()) return false;
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!match) return false;
  const [payload, signature] = match[1].split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload, process.env.SESSION_SECRET);
  if (!timingSafeEqualText(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(parsed.exp) > Date.now();
  } catch {
    return false;
  }
}

export function requireAuth(req) {
  if (!authConfigured()) return json({ error: "Backend não configurado.", code: "NOT_CONFIGURED" }, 503);
  if (!isAuthenticated(req)) return json({ error: "Sessão expirada. Entre novamente.", code: "UNAUTHORIZED" }, 401);
  return null;
}
