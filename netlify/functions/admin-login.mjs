import { authConfigured, createSessionCookie, validateCredentials } from "./_auth.mjs";
import { bodyJSON, cleanString, json } from "./_http.mjs";

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!authConfigured()) return json({ error: "Defina ADMIN_PASSWORD e SESSION_SECRET no Netlify.", code: "NOT_CONFIGURED" }, 503);
  try {
    const body = await bodyJSON(req, 4000);
    const user = cleanString(body.user, 80);
    const password = String(body.password || "").slice(0, 200);
    if (!validateCredentials(user, password)) return json({ error: "Usuário ou senha incorretos." }, 401);
    return json({ ok: true }, 200, { "Set-Cookie": createSessionCookie() });
  } catch {
    return json({ error: "Não foi possível autenticar." }, 400);
  }
}

export const config = { path: "/api/admin/login" };
