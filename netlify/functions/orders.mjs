import crypto from "node:crypto";
import { PRODUCT_MAP, productPrice } from "../../shared/catalog.mjs";
import { getSettings, saveOrders } from "./_data.mjs";
import { bodyJSON, cleanString, json } from "./_http.mjs";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function orderId() {
  const bytes = crypto.randomBytes(6);
  return `SUN-${Array.from(bytes, (n) => CHARS[n % CHARS.length]).join("")}`;
}

export default async function handler(req) {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  try {
    const input = await bodyJSON(req);
    const settings = await getSettings();
    if (!settings.storeOpen) return json({ error: "Os pedidos estão pausados neste momento." }, 409);

    const customerName = cleanString(input.customerName, 40);
    const stand = Number(input.stand);
    if (customerName.length < 2) return json({ error: "Nome inválido." }, 400);
    if (!Number.isInteger(stand) || stand < 1 || stand > Number(settings.standCount || 3)) return json({ error: "Barraca inválida." }, 400);
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 25) return json({ error: "Pedido vazio ou inválido." }, 400);

    const items = [];
    let total = 0;
    let totalQty = 0;
    for (const raw of input.items) {
      const product = PRODUCT_MAP[cleanString(raw.id, 80)];
      const qty = Number(raw.qty);
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 20) return json({ error: "Há um item inválido no pedido." }, 400);
      if (!settings.availability?.[product.id]) return json({ error: `${product.name} está esgotado.` }, 409);
      const unitPrice = productPrice(product, settings);
      if (unitPrice === null) return json({ error: `O preço de ${product.name} ainda não foi definido.` }, 409);
      const subtotal = Math.round(unitPrice * qty * 100) / 100;
      total += subtotal;
      totalQty += qty;
      items.push({ id: product.id, name: product.name, category: product.category, qty, unitPrice, subtotal });
    }
    if (totalQty > 50 || total <= 0 || total > 1500) return json({ error: "Pedido fora dos limites permitidos." }, 400);
    total = Math.round(total * 100) / 100;

    const order = {
      id: orderId(),
      customerName,
      stand,
      items,
      total,
      status: "new",
      createdAt: new Date().toISOString(),
      clientCreatedAt: cleanString(input.clientCreatedAt, 40) || null
    };

    await saveOrders((orders) => {
      const next = [order, ...orders.filter((item) => item?.id !== order.id)];
      return next.slice(0, 2500);
    });
    return json({ order }, 201);
  } catch (error) {
    console.error("orders", error);
    return json({ error: "Não foi possível registrar o pedido. O WhatsApp ainda pode ser usado." }, 500);
  }
}

export const config = { path: "/api/orders" };
