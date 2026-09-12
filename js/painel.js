import { PRODUCTS, normalizeSettings } from "../shared/catalog.mjs";

const $ = (selector, root = document) => root.querySelector(selector);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let state = { settings: null, orders: [], filter: "active", refreshing: false };
let refreshTimer = null;

function formatMoney(value) { return money.format(Number(value) || 0); }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\'":"&#39;"}[char])); }
function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), 2300);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Erro de comunicação com o servidor.");
    error.code = data.code;
    error.status = response.status;
    throw error;
  }
  return data;
}

function showLogin() {
  clearInterval(refreshTimer);
  refreshTimer = null;
  $("#login-card").classList.remove("hidden");
  $("#dashboard").classList.add("hidden");
}

function showDashboard() {
  $("#login-card").classList.add("hidden");
  $("#backend-warning").classList.add("hidden");
  $("#dashboard").classList.remove("hidden");
}

function showBackendWarning() {
  $("#login-card").classList.add("hidden");
  $("#dashboard").classList.add("hidden");
  $("#backend-warning").classList.remove("hidden");
}

async function login(event) {
  event.preventDefault();
  const errorBox = $("#login-error");
  errorBox.classList.add("hidden");
  const button = $("#login-submit");
  button.disabled = true; button.textContent = "Entrando…";
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify({ user: $("#admin-user").value.trim(), password: $("#admin-password").value }) });
    $("#admin-password").value = "";
    await refreshDashboard();
    startAutoRefresh();
  } catch (error) {
    if (error.code === "NOT_CONFIGURED") return showBackendWarning();
    errorBox.textContent = error.message;
    errorBox.classList.remove("hidden");
  } finally {
    button.disabled = false; button.textContent = "Entrar no painel";
  }
}

async function logout() {
  try { await api("/api/admin/logout", { method: "POST" }); } catch {}
  clearInterval(refreshTimer);
  showLogin();
}

function confirmed(order) { return ["paid", "ready", "delivered"].includes(order.status); }
function statusLabel(status) {
  return ({ new: "Novo", paid: "Pago", ready: "Pronto", delivered: "Entregue", cancelled: "Cancelado" })[status] || status;
}

function renderMetrics() {
  const orders = state.orders;
  const confirmedOrders = orders.filter(confirmed);
  const revenue = confirmedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const items = confirmedOrders.reduce((sum, order) => sum + (order.items || []).reduce((q, item) => q + Number(item.qty || 0), 0), 0);
  const pending = orders.filter((o) => o.status === "new").length;
  const ready = orders.filter((o) => o.status === "ready").length;
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const ticket = confirmedOrders.length ? revenue / confirmedOrders.length : 0;
  $("#metric-revenue").textContent = formatMoney(revenue);
  $("#metric-orders").textContent = String(orders.length);
  $("#metric-pending").textContent = `${pending} aguardando`;
  $("#metric-items").textContent = String(items);
  $("#metric-ticket").textContent = `Ticket médio ${formatMoney(ticket)}`;
  $("#metric-delivered").textContent = String(delivered);
  $("#metric-ready").textContent = `${ready} prontos agora`;
}

function renderStoreControls() {
  const settings = state.settings;
  $("#store-open-toggle").checked = Boolean(settings.storeOpen);
  $("#store-open-label").textContent = settings.storeOpen ? "Aberta" : "Pausada";
  $("#store-message").value = settings.storeMessage || "";
}

function renderPriceEditor() {
  const form = $("#prices-form");
  form.innerHTML = "";

  PRODUCTS.forEach((product) => {
    const row = document.createElement("div");
    row.className = "price-row";
    const value = state.settings.productPrices?.[product.id];

    row.innerHTML = `
      <label for="price-${product.id}">
        ${escapeHTML(product.name)}
        <small>${escapeHTML(product.category)}</small>
      </label>
      <div class="price-input-wrap">
        <span>R$</span>
        <input
          id="price-${product.id}"
          data-price-id="${product.id}"
          inputmode="decimal"
          type="number"
          min="0.01"
          max="100"
          step="0.50"
          value="${value ?? ""}"
          placeholder="--"
        >
      </div>`;

    form.append(row);
  });
}

function renderStock() {
  const root = $("#stock-list"); root.innerHTML = "";
  const available = PRODUCTS.filter((p) => state.settings.availability?.[p.id]).length;
  $("#stock-count").textContent = `${available}/${PRODUCTS.length} ativos`;
  PRODUCTS.forEach((product) => {
    const row = document.createElement("div"); row.className = "stock-row";
    row.innerHTML = `<div><strong>${product.name}</strong><small>${product.category}</small></div><label class="mini-switch"><input type="checkbox" data-stock-id="${product.id}" ${state.settings.availability?.[product.id] ? "checked" : ""}><span></span></label>`;
    $("input", row).addEventListener("change", async (event) => {
      const checked = event.target.checked;
      try {
        const result = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ availability: { [product.id]: checked } }) });
        state.settings = normalizeSettings(result.settings);
        renderStock(); toast(`${product.name}: ${checked ? "disponível" : "esgotado"}`);
      } catch (error) { event.target.checked = !checked; toast(error.message); }
    });
    root.append(row);
  });
}

function filteredOrders() {
  if (state.filter === "all") return state.orders;
  if (state.filter === "delivered") return state.orders.filter((o) => o.status === "delivered");
  return state.orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
}

function renderOrders() {
  const root = $("#orders-list"); root.innerHTML = "";
  const orders = filteredOrders();
  if (!orders.length) { root.innerHTML = '<div class="empty-admin">Nenhum pedido nesta fila.</div>'; return; }
  orders.forEach((order) => {
    const card = document.createElement("article");
    card.className = `order-card status-${order.status}`;
    const when = new Date(order.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    card.innerHTML = `
      <div class="order-top"><div><strong class="order-code-admin">${order.id}</strong><div class="order-meta"><span>${escapeHTML(order.customerName)}</span><span>Barraca ${order.stand}</span><span>${when}</span><span>${statusLabel(order.status)}</span></div></div><strong class="order-total">${formatMoney(order.total)}</strong></div>
      <div class="order-items">${(order.items || []).map((item) => `<span><b>${item.qty}× ${item.name}</b><em>${formatMoney(item.subtotal)}</em></span>`).join("")}</div>
      <div class="order-actions">
        <button data-status="new" class="${order.status === "new" ? "current" : ""}">Novo</button>
        <button data-status="paid" class="${order.status === "paid" ? "current" : ""}">✓ Pago</button>
        <button data-status="ready" class="${order.status === "ready" ? "current" : ""}">Pronto</button>
        <button data-status="delivered" class="${order.status === "delivered" ? "current" : ""}">Entregue</button>
        <button data-status="cancelled" class="cancel ${order.status === "cancelled" ? "current" : ""}">Cancelar</button>
      </div>`;
    card.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => updateOrder(order.id, button.dataset.status)));
    root.append(card);
  });
}

function renderAll() {
  renderStoreControls(); renderMetrics(); renderPriceEditor(); renderStock(); renderOrders();
}

async function refreshDashboard(silent = false) {
  if (state.refreshing || document.hidden) return;
  state.refreshing = true;
  try {
    const data = await api("/api/admin/state");
    state.settings = normalizeSettings(data.settings || {});
    state.orders = Array.isArray(data.orders) ? data.orders : [];
    renderAll(); showDashboard();
    $("#last-refresh").textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
    if (!silent) toast("Painel atualizado ✓");
    return true;
  } catch (error) {
    if (error.code === "NOT_CONFIGURED") { showBackendWarning(); return false; }
    if (error.status === 401) { showLogin(); return false; }
    if (!silent) toast(error.message);
    return false;
  } finally { state.refreshing = false; }
}

async function updateOrder(id, status) {
  const index = state.orders.findIndex((o) => o.id === id);
  if (index < 0 || state.orders[index].status === status) return;
  const previous = state.orders[index];
  state.orders[index] = { ...previous, status }; renderOrders(); renderMetrics();
  try {
    const result = await api("/api/admin/order", { method: "PATCH", body: JSON.stringify({ id, status }) });
    state.orders[index] = result.order; renderOrders(); renderMetrics();
    toast(`${id}: ${statusLabel(status)}`);
  } catch (error) { state.orders[index] = previous; renderOrders(); renderMetrics(); toast(error.message); }
}

async function savePrices() {
  const productPrices = {};

  document.querySelectorAll("[data-price-id]").forEach((input) => {
    productPrices[input.dataset.priceId] = input.value === "" ? null : Number(input.value);
  });

  try {
    const result = await api("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ productPrices })
    });
    state.settings = normalizeSettings(result.settings);
    renderPriceEditor();
    toast("Preços publicados na loja ✓");
  } catch (error) {
    toast(error.message);
  }
}

async function saveStoreState() {
  const patch = { storeOpen: $("#store-open-toggle").checked, storeMessage: $("#store-message").value.trim() };
  try {
    const result = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
    state.settings = normalizeSettings(result.settings); renderStoreControls(); toast("Estado da loja atualizado ✓");
  } catch (error) { toast(error.message); }
}

function exportCSV() {
  const rows = [["Pedido","Cliente","Barraca","Status","Total","Data","Itens"]];
  state.orders.forEach((order) => rows.push([order.id, order.customerName, order.stand, statusLabel(order.status), Number(order.total || 0).toFixed(2), order.createdAt, (order.items || []).map((i) => `${i.qty}x ${i.name}`).join(" | ")]));
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"','""')}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `sun-ice-pedidos-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refreshDashboard(true), 10000);
}

function wire() {
  $("#login-form").addEventListener("submit", login);
  $("#logout").addEventListener("click", logout);
  $("#refresh-dashboard").addEventListener("click", () => refreshDashboard());
  $("#save-prices").addEventListener("click", savePrices);
  $("#save-store-state").addEventListener("click", saveStoreState);
  $("#store-open-toggle").addEventListener("change", () => { $("#store-open-label").textContent = $("#store-open-toggle").checked ? "Aberta" : "Pausada"; });
  $("#export-csv").addEventListener("click", exportCSV);
  $("#order-filters").addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]"); if (!button) return;
    state.filter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === button)); renderOrders();
  });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !$("#dashboard").classList.contains("hidden")) refreshDashboard(true); });
}

async function init() {
  wire();
  try { if (await refreshDashboard(true)) startAutoRefresh(); }
  catch { showLogin(); }
}
init();
