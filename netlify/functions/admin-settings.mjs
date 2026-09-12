import { PRODUCTS, PRICE_LABELS } from "../../shared/catalog.mjs";
import { requireAuth } from "./_auth.mjs";
import { saveSettings } from "./_data.mjs";
import { bodyJSON, cleanString, json } from "./_http.mjs";

const groups = Object.keys(PRICE_LABELS);
const productIds = new Set(PRODUCTS.map((p) => p.id));

export default async function handler(req) {
  if (req.method !== "PATCH") return json({ error: "Método não permitido." }, 405);
  const denied = requireAuth(req); if (denied) return denied;
  try {
    const patch = await bodyJSON(req);
    const settings = await saveSettings((current) => {
      if (typeof patch.storeOpen === "boolean") current.storeOpen = patch.storeOpen;
      if (patch.storeMessage !== undefined) current.storeMessage = cleanString(patch.storeMessage, 90) || current.storeMessage;
      if (patch.prices && typeof patch.prices === "object") {
        for (const group of groups) {
          if (!(group in patch.prices)) continue;
          const raw = patch.prices[group];
          if (raw === null || raw === "") current.prices[group] = null;
          else {
            const value = Number(raw);
            if (Number.isFinite(value) && value > 0 && value <= 100) current.prices[group] = Math.round(value * 100) / 100;
          }
        }
      }
      if (patch.availability && typeof patch.availability === "object") {
        for (const [id, value] of Object.entries(patch.availability)) {
          if (productIds.has(id) && typeof value === "boolean") current.availability[id] = value;
        }
      }
      return current;
    });
    return json({ settings });
  } catch (error) {
    console.error("admin-settings", error);
    return json({ error: error.message || "Não foi possível salvar." }, 500);
  }
}
export const config = { path: "/api/admin/settings" };
