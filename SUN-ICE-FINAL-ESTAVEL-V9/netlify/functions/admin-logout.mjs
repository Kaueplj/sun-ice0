import { clearSessionCookie } from "./_auth.mjs";
import { json } from "./_http.mjs";
export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
export const config = { path: "/api/admin/logout" };
