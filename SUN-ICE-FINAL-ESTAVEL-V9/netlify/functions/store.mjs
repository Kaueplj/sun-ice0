import { getSettings } from "./_data.mjs";
import { json } from "./_http.mjs";

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "Método não permitido." }, 405);
  try {
    const settings = await getSettings();
    return json({ settings });
  } catch (error) {
    console.error("store", error);
    return json({ error: "Não foi possível carregar a loja." }, 500);
  }
}

export const config = { path: "/api/store" };
