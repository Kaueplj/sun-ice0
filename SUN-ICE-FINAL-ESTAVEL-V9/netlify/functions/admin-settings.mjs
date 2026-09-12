import { PRODUCTS } from "../../shared/catalog.mjs";
import { requireAuth } from "./_auth.mjs";
import { saveSettings } from "./_data.mjs";
import { bodyJSON, cleanString, json } from "./_http.mjs";

const productIds = new Set(PRODUCTS.map((p) => p.id));

export default async function handler(req) {
  if (req.method !== "PATCH") return json({ error: "Método não permitido." }, 405);
  const denied = requireAuth(req); if (denied) return denied;

  try {
    const patch = await bodyJSON(req);
    const settings = await saveSettings((current) => {
      if (typeof patch.storeOpen === "boolean") current.storeOpen = patch.storeOpen;
      if (patch.storeMessage !== undefined) {
        current.storeMessage = cleanString(patch.storeMessage, 90) || current.storeMessage;
      }

      if (patch.productPrices && typeof patch.productPrices === "object") {
        current.productPrices ||= {};

        for (const [id, raw] of Object.entries(patch.productPrices)) {
          if (!productIds.has(id)) continue;

          if (raw === null || raw === "") {
            current.productPrices[id] = null;
            continue;
          }

          const value = Number(raw);
          if (Number.isFinite(value) && value > 0 && value <= 100) {
            current.productPrices[id] = Math.round(value * 100) / 100;
          }
        }
      }

      if (patch.availability && typeof patch.availability === "object") {
        for (const [id, value] of Object.entries(patch.availability)) {
          if (productIds.has(id) && typeof value === "boolean") {
            current.availability[id] = value;
          }
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
