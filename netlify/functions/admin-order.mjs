import { requireAuth } from "./_auth.mjs";
import { saveOrders } from "./_data.mjs";
import { bodyJSON, cleanString, json } from "./_http.mjs";

const STATUS = new Set(["new", "paid", "ready", "delivered", "cancelled"]);
export default async function handler(req) {
  if (req.method !== "PATCH") return json({ error: "Método não permitido." }, 405);
  const denied = requireAuth(req); if (denied) return denied;
  try {
    const body = await bodyJSON(req);
    const id = cleanString(body.id, 32);
    const status = cleanString(body.status, 20);
    if (!id || !STATUS.has(status)) return json({ error: "Atualização inválida." }, 400);
    let updated = null;
    await saveOrders((orders) => orders.map((order) => {
      if (order.id !== id) return order;
      updated = { ...order, status, updatedAt: new Date().toISOString() };
      return updated;
    }));
    if (!updated) return json({ error: "Pedido não encontrado." }, 404);
    return json({ order: updated });
  } catch (error) {
    console.error("admin-order", error);
    return json({ error: "Não foi possível atualizar o pedido." }, 500);
  }
}
export const config = { path: "/api/admin/order" };
