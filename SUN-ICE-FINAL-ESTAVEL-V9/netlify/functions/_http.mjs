export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

export function methodNotAllowed() {
  return json({ error: "Método não permitido." }, 405, { Allow: "GET, POST, PATCH" });
}

export async function bodyJSON(req, maxBytes = 24_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error("Payload muito grande.");
  return text ? JSON.parse(text) : {};
}

export function cleanString(value, max = 100) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}
