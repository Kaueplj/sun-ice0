import { requireAuth } from "./_auth.mjs";
import { getOrders, getSettings } from "./_data.mjs";
import { json } from "./_http.mjs";

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);
  const denied = requireAuth(req); if (denied) return denied;
  try {
    const [settings, orders] = await Promise.all([getSettings(), getOrders()]);
    return json({ settings, orders });
  } catch (error) {
    console.error("admin-state", error);
    return json({ error: "Não foi possível carregar o painel." }, 500);
  }
}
export const config = { path: "/api/admin/state" };
