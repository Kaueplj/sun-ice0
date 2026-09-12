/* Sun & Ice — Painel v9
   Arquivo autocontido: não depende de import ES Module.
   Aceita API retornando tanto `orders` quanto `pedidos`.
*/
(() => {
  "use strict";

  const PRODUCTS = [
    { id: "agua-500", category: "Bebidas", name: "Água Mineral", defaultPrice: 3 },
    { id: "brownie-brigadeiro", category: "Brownies", name: "Brownie de Brigadeiro", defaultPrice: 12 },
    { id: "brownie-bem-casado", category: "Brownies", name: "Brownie Bem-casado", defaultPrice: 12 },
    { id: "brownie-ninho", category: "Brownies", name: "Brownie de Ninho", defaultPrice: 12 },
    { id: "picole-sensacao-baunilha", category: "Picolés", name: "Sensação de Baunilha", defaultPrice: 10 },
    { id: "picole-sensacao-chocolate-branco", category: "Picolés", name: "Sensação de Chocolate Branco", defaultPrice: 10 },
    { id: "picole-sensacao-brigadeiro", category: "Picolés", name: "Sensação de Brigadeiro", defaultPrice: 10 },
    { id: "picole-caja", category: "Picolés", name: "Cajá", defaultPrice: 6 },
    { id: "picole-morango", category: "Picolés", name: "Morango", defaultPrice: 6 },
    { id: "picole-uva", category: "Picolés", name: "Uva", defaultPrice: 6 },
    { id: "sacole-mousse-maracuja", category: "Sacolé", name: "Mousse de Maracujá", defaultPrice: 8 },
    { id: "sacole-morango-nutella", category: "Sacolé", name: "Morango com Nutella", defaultPrice: 9 },
    { id: "sacole-maracuja-nutella", category: "Sacolé", name: "Maracujá com Nutella", defaultPrice: 9 },
    { id: "sacole-mousse-morango", category: "Sacolé", name: "Mousse de Morango", defaultPrice: 7 },
    { id: "sacole-chocolate", category: "Sacolé", name: "Sacolé de Chocolate", defaultPrice: 7 }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const state = { settings: null, orders: [], filter: "active", refreshing: false };
  let refreshTimer = null;

  function formatMoney(value) { return money.format(Number(value) || 0); }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message || "";
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function normalizeSettings(raw = {}) {
    const savedPrices = raw.productPrices && typeof raw.productPrices === "object" ? raw.productPrices : {};
    const productPrices = {};
    const availability = {};

    for (const product of PRODUCTS) {
      const rawPrice = Object.prototype.hasOwnProperty.call(savedPrices, product.id)
        ? savedPrices[product.id]
        : product.defaultPrice;
      const n = Number(rawPrice);
      productPrices[product.id] = rawPrice === null || rawPrice === "" || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100) / 100;
      availability[product.id] = raw.availability?.[product.id] !== false;
    }

    return {
      storeOpen: raw.storeOpen !== false,
      storeMessage: raw.storeMessage || "Pedidos abertos · retirada rápida no evento",
      whatsapp: raw.whatsapp || "5581994976997",
      pixKey: raw.pixKey || "caaturma@gmail.com",
      receiver: raw.receiver || "Ana Beatriz Nunes",
      standCount: Number(raw.standCount || 3),
      productPrices,
      availability
    };
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Erro ${response.status} ao falar com o servidor.`);
      error.code = data.code;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function showLogin() {
    clearInterval(refreshTimer);
    refreshTimer = null;
    $("#login-card")?.classList.remove("hidden");
    $("#dashboard")?.classList.add("hidden");
    $("#backend-warning")?.classList.add("hidden");
  }

  function showDashboard() {
    $("#login-card")?.classList.add("hidden");
    $("#backend-warning")?.classList.add("hidden");
    $("#dashboard")?.classList.remove("hidden");
  }

  function showBackendWarning() {
    $("#login-card")?.classList.add("hidden");
    $("#dashboard")?.classList.add("hidden");
    $("#backend-warning")?.classList.remove("hidden");
  }

  function getOrdersFromPayload(data) {
    if (Array.isArray(data?.orders)) return data.orders;
    if (Array.isArray(data?.pedidos)) return data.pedidos;
    return [];
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
    if (!form) return;
    form.innerHTML = "";
    for (const product of PRODUCTS) {
      const row = document.createElement("div");
      row.className = "price-row";
      const value = state.settings.productPrices?.[product.id];
      row.innerHTML = `
        <label for="price-${product.id}">${escapeHTML(product.name)}<small>${escapeHTML(product.category)}</small></label>
        <div class="price-input-wrap"><span>R$</span><input id="price-${product.id}" data-price-id="${product.id}" inputmode="decimal" type="number" min="0.01" max="100" step="0.50" value="${value ?? ""}" placeholder="--"></div>`;
      form.append(row);
    }
  }

  function renderStock() {
    const root = $("#stock-list");
    if (!root) return;
    root.innerHTML = "";
    const available = PRODUCTS.filter((p) => state.settings.availability?.[p.id]).length;
    $("#stock-count").textContent = `${available}/${PRODUCTS.length} ativos`;

    for (const product of PRODUCTS) {
      const row = document.createElement("div");
      row.className = "stock-row";
      row.innerHTML = `<div><strong>${escapeHTML(product.name)}</strong><small>${escapeHTML(product.category)}</small></div><label class="mini-switch"><input type="checkbox" data-stock-id="${product.id}" ${state.settings.availability?.[product.id] ? "checked" : ""}><span></span></label>`;
      const input = $("input", row);
      input.addEventListener("change", async (event) => {
        const checked = event.target.checked;
        try {
          const result = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ availability: { [product.id]: checked } }) });
          state.settings = normalizeSettings(result.settings || state.settings);
          renderStock();
          toast(`${product.name}: ${checked ? "disponível" : "esgotado"}`);
        } catch (error) {
          event.target.checked = !checked;
          toast(error.message);
        }
      });
      root.append(row);
    }
  }

  function filteredOrders() {
    if (state.filter === "all") return state.orders;
    if (state.filter === "delivered") return state.orders.filter((o) => o.status === "delivered");
    return state.orders.filter((o) => !["delivered", "cancelled"].includes(o.status));
  }

  function renderOrders() {
    const root = $("#orders-list");
    if (!root) return;
    root.innerHTML = "";
    const orders = filteredOrders();
    if (!orders.length) {
      root.innerHTML = '<div class="empty-admin">Nenhum pedido nesta fila.</div>';
      return;
    }
    for (const order of orders) {
      const card = document.createElement("article");
      card.className = `order-card status-${order.status}`;
      const date = new Date(order.createdAt);
      const when = Number.isNaN(date.getTime()) ? "--:--" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      card.innerHTML = `
        <div class="order-top"><div><strong class="order-code-admin">${escapeHTML(order.id)}</strong><div class="order-meta"><span>${escapeHTML(order.customerName)}</span><span>Barraca ${escapeHTML(order.stand)}</span><span>${when}</span><span>${statusLabel(order.status)}</span></div></div><strong class="order-total">${formatMoney(order.total)}</strong></div>
        <div class="order-items">${(order.items || []).map((item) => `<span><b>${Number(item.qty || 0)}× ${escapeHTML(item.name)}</b><em>${formatMoney(item.subtotal)}</em></span>`).join("")}</div>
        <div class="order-actions"><button data-status="new" class="${order.status === "new" ? "current" : ""}">Novo</button><button data-status="paid" class="${order.status === "paid" ? "current" : ""}">✓ Pago</button><button data-status="ready" class="${order.status === "ready" ? "current" : ""}">Pronto</button><button data-status="delivered" class="${order.status === "delivered" ? "current" : ""}">Entregue</button><button data-status="cancelled" class="cancel ${order.status === "cancelled" ? "current" : ""}">Cancelar</button></div>`;
      card.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => updateOrder(order.id, button.dataset.status)));
      root.append(card);
    }
  }

  function renderAll() {
    renderStoreControls();
    renderMetrics();
    renderPriceEditor();
    renderStock();
    renderOrders();
  }

  async function refreshDashboard(silent = false) {
    if (state.refreshing || document.hidden) return false;
    state.refreshing = true;
    try {
      const data = await api("/api/admin/state");
      state.settings = normalizeSettings(data.settings || {});
      state.orders = getOrdersFromPayload(data);

      // Mostra a área da equipe ANTES de renderizar qualquer widget.
      showDashboard();

      try {
        renderAll();
      } catch (renderError) {
        console.error("SUNICE_RENDER_ERROR", renderError);
        toast("Login aceito. Houve erro em um bloco do painel; veja o Console.");
      }

      const stamp = $("#last-refresh");
      if (stamp) stamp.textContent = `Atualizado às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
      if (!silent) toast("Painel atualizado ✓");
      return true;
    } catch (error) {
      console.error("SUNICE_REFRESH_ERROR", error);
      if (error.code === "NOT_CONFIGURED") { showBackendWarning(); return false; }
      if (error.status === 401) { showLogin(); return false; }
      if (!silent) toast(error.message);
      return false;
    } finally {
      state.refreshing = false;
    }
  }

  async function login(event) {
    event.preventDefault();
    event.stopPropagation();
    const errorBox = $("#login-error");
    errorBox?.classList.add("hidden");
    const button = $("#login-submit");
    if (button) { button.disabled = true; button.textContent = "Entrando…"; }

    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ user: $("#admin-user").value.trim(), password: $("#admin-password").value })
      });
      $("#admin-password").value = "";

      // Login confirmado: a tela muda imediatamente.
      showDashboard();
      toast("Acesso autorizado ✓");
      await refreshDashboard(true);
      startAutoRefresh();
    } catch (error) {
      console.error("SUNICE_LOGIN_ERROR", error);
      if (error.code === "NOT_CONFIGURED") {
        showBackendWarning();
      } else if (errorBox) {
        errorBox.textContent = error.message || "Não foi possível entrar.";
        errorBox.classList.remove("hidden");
      }
    } finally {
      if (button) { button.disabled = false; button.textContent = "Entrar no painel"; }
    }
  }

  async function logout() {
    try { await api("/api/admin/logout", { method: "POST" }); } catch {}
    showLogin();
  }

  async function updateOrder(id, status) {
    const index = state.orders.findIndex((o) => o.id === id);
    if (index < 0 || state.orders[index].status === status) return;
    const previous = state.orders[index];
    state.orders[index] = { ...previous, status };
    renderOrders(); renderMetrics();
    try {
      const result = await api("/api/admin/order", { method: "PATCH", body: JSON.stringify({ id, status }) });
      state.orders[index] = result.order || state.orders[index];
      renderOrders(); renderMetrics();
      toast(`${id}: ${statusLabel(status)}`);
    } catch (error) {
      state.orders[index] = previous;
      renderOrders(); renderMetrics();
      toast(error.message);
    }
  }

  async function savePrices() {
    const productPrices = {};
    document.querySelectorAll("[data-price-id]").forEach((input) => {
      productPrices[input.dataset.priceId] = input.value === "" ? null : Number(input.value);
    });
    try {
      const result = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify({ productPrices }) });
      state.settings = normalizeSettings(result.settings || state.settings);
      renderPriceEditor();
      toast("Preços publicados na loja ✓");
    } catch (error) { toast(error.message); }
  }

  async function saveStoreState() {
    const patch = { storeOpen: $("#store-open-toggle").checked, storeMessage: $("#store-message").value.trim() };
    try {
      const result = await api("/api/admin/settings", { method: "PATCH", body: JSON.stringify(patch) });
      state.settings = normalizeSettings(result.settings || state.settings);
      renderStoreControls();
      toast("Estado da loja atualizado ✓");
    } catch (error) { toast(error.message); }
  }

  function exportCSV() {
    const rows = [["Pedido", "Cliente", "Barraca", "Status", "Total", "Data", "Itens"]];
    state.orders.forEach((order) => rows.push([
      order.id, order.customerName, order.stand, statusLabel(order.status), Number(order.total || 0).toFixed(2), order.createdAt,
      (order.items || []).map((i) => `${i.qty}x ${i.name}`).join(" | ")
    ]));
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sun-ice-pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startAutoRefresh() {
    clearInterval(refreshTimer);
    refreshTimer = setInterval(() => refreshDashboard(true), 8000);
  }

  function wire() {
    const loginForm = $("#login-form");
    if (!loginForm) throw new Error("Formulário de login não encontrado.");
    loginForm.addEventListener("submit", login);
    $("#logout")?.addEventListener("click", logout);
    $("#refresh-dashboard")?.addEventListener("click", () => refreshDashboard(false));
    $("#save-prices")?.addEventListener("click", savePrices);
    $("#save-store-state")?.addEventListener("click", saveStoreState);
    $("#store-open-toggle")?.addEventListener("change", () => {
      $("#store-open-label").textContent = $("#store-open-toggle").checked ? "Aberta" : "Pausada";
    });
    $("#export-csv")?.addEventListener("click", exportCSV);
    $("#order-filters")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-filter]");
      if (!button) return;
      state.filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((b) => b.classList.toggle("active", b === button));
      renderOrders();
    });
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !$("#dashboard")?.classList.contains("hidden")) refreshDashboard(true);
    });
  }

  async function init() {
    try {
      wire();
      const ok = await refreshDashboard(true);
      if (ok) startAutoRefresh();
    } catch (error) {
      console.error("SUNICE_INIT_ERROR", error);
      showLogin();
      const box = $("#login-error");
      if (box) {
        box.textContent = "Erro ao iniciar o painel. Atualize a página com Ctrl+F5.";
        box.classList.remove("hidden");
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
