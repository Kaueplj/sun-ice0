import { getStore } from "@netlify/blobs";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../shared/catalog.mjs";

const STORE_NAME = "sunice-live-v3";
const SETTINGS_KEY = "settings";
const ORDERS_KEY = "orders";

export function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function getSettings() {
  const data = await store().get(SETTINGS_KEY, { type: "json", consistency: "strong" });
  return normalizeSettings(data || DEFAULT_SETTINGS);
}

export async function getOrders() {
  const data = await store().get(ORDERS_KEY, { type: "json", consistency: "strong" });
  return Array.isArray(data) ? data : [];
}

export async function mutateJSON(key, fallback, mutator, maxAttempts = 8) {
  const blobStore = store();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const current = await blobStore.getWithMetadata(key, { type: "json", consistency: "strong" });
    const base = current?.data ?? structuredClone(fallback);
    const next = await mutator(structuredClone(base));
    const options = current?.etag ? { onlyIfMatch: current.etag } : { onlyIfNew: true };
    const result = await blobStore.setJSON(key, next, options);
    if (result.modified) return next;
    await new Promise((resolve) => setTimeout(resolve, 30 + attempt * 25));
  }
  throw new Error("Falha de concorrência ao salvar dados. Tente novamente.");
}

export async function saveSettings(mutator) {
  return mutateJSON(SETTINGS_KEY, DEFAULT_SETTINGS, (current) => normalizeSettings(mutator(normalizeSettings(current))));
}

export async function saveOrders(mutator) {
  return mutateJSON(ORDERS_KEY, [], (current) => {
    const orders = Array.isArray(current) ? current : [];
    return mutator(orders);
  });
}
