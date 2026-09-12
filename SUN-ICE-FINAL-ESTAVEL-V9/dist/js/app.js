import { PRODUCTS, PRODUCT_MAP, DEFAULT_SETTINGS, normalizeSettings, productPrice } from "../shared/catalog.mjs";

const CART_KEY = "sunice:cart:v5";
const LAST_ORDER_KEY = "sunice:last-order:v3";
const CUSTOMER_NAME_KEY = "sunice:customer-name:v1";
const SETTINGS_CACHE_KEY = "sunice:settings-cache:v3";
const SUCCESS_FLAG = "sunice:return-success:v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const $ = (selector, root = document) => root.querySelector(selector);

const state = {
  settings: normalizeSettings(DEFAULT_SETTINGS),
  cart: readJSON(CART_KEY, {}),
  filter: "Todos",
  backendOnline: true,
  selectedStand: null,
  submitting: false,
  lastOrder: readJSON(LAST_ORDER_KEY, null)
};

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  renderCart();
  renderCatalog();
}

function safeText(value, max = 80) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function formatMoney(value) {
  return money.format(Number(value) || 0);
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ product: PRODUCT_MAP[id], qty: Number(qty) || 0 }))
    .filter(({ product, qty }) => product && qty > 0);
}

function cartCount() {
  return cartEntries().reduce((sum, item) => sum + item.qty, 0);
}

function cartTotal() {
  return cartEntries().reduce((sum, { product, qty }) => sum + (productPrice(product, state.settings) || 0) * qty, 0);
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function openOverlay(selector) {
  const element = $(selector);
  if (!element) return;
  element.classList.remove("hidden");
  element.setAttribute("aria-hidden", "false");
  document.body.classList.add("locked");
}

function closeOverlay(selector) {
  const element = $(selector);
  if (!element) return;
  element.classList.add("hidden");
  element.setAttribute("aria-hidden", "true");
  if (!["#cart-overlay", "#checkout-overlay", "#success-overlay", "#how-sheet"].some((id) => !$(id)?.classList.contains("hidden"))) {
    document.body.classList.remove("locked");
  }
}

function setBackendStatus(online) {
  state.backendOnline = online;
  const pill = $("#connection-pill");
  if (!pill) return;
  pill.classList.toggle("offline", !online);
  $("span", pill).textContent = online ? "online" : "modo reserva";
  pill.title = online ? "Pedidos também estão sendo registrados no painel" : "O painel está indisponível, mas o WhatsApp continua funcionando";
}

async function fetchWithTimeout(url, options = {}, timeout = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadSettings() {
  try {
    const response = await fetchWithTimeout("/api/store", { headers: { Accept: "application/json" }, cache: "no-store" }, 3500);
    if (!response.ok) throw new Error("API indisponível");
    const data = await response.json();
    state.settings = normalizeSettings(data.settings || data);
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(state.settings));
    setBackendStatus(true);
  } catch {
    state.settings = normalizeSettings(readJSON(SETTINGS_CACHE_KEY, DEFAULT_SETTINGS));
    setBackendStatus(false);
  }
  applyStandFromURL();
  renderAll();
}

function applyStandFromURL() {
  const raw = Number(new URLSearchParams(location.search).get("b"));
  const valid = Number.isInteger(raw) && raw >= 1 && raw <= Number(state.settings.standCount || 3);
  state.selectedStand = valid ? raw : state.selectedStand;
  const badge = $("#stand-badge");
  badge.textContent = valid ? `QR da Barraca ${raw}` : "Retirada no evento";
}

function renderStoreState() {
  const liveLine = $(".live-line");
  const statusText = $("#store-status-text");
  if (state.settings.storeOpen) {
    liveLine.classList.remove("closed");
    statusText.textContent = "PEDIDOS ABERTOS";
  } else {
    liveLine.classList.add("closed");
    statusText.textContent = "PEDIDOS PAUSADOS";
  }
  $("#catalog-helper").textContent = state.settings.storeMessage || DEFAULT_SETTINGS.storeMessage;
  $("#pix-key").textContent = state.settings.pixKey;
  $("#pix-receiver").textContent = state.settings.receiver;
}

function renderTabs() {
  const categories = ["Todos", ...new Set(PRODUCTS.map((p) => p.category))];
  const root = $("#category-tabs");
  root.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.filter === category ? "active" : "";
    button.textContent = category;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(state.filter === category));
    button.addEventListener("click", () => {
      state.filter = category;
      renderTabs();
      renderCatalog();
    });
    root.append(button);
  });
}

function productVisual(product) {
  if (product.id === "agua-500") {
    return `<img src="images/agua-mineral-small.webp" alt="Garrafa de água mineral" loading="lazy" width="118" height="136">`;
  }

  if (product.group === "brownie") {
    return `<img class="product-art brownie-art" src="images/brownie.svg" alt="Brownie de chocolate" loading="lazy" width="150" height="125">`;
  }

  if (product.visual === "popsicle-white") {
    return `<img class="product-art popsicle-art" src="images/popsicle-white.svg" alt="Picolé cremoso branco" loading="lazy" width="115" height="145">`;
  }

  if (product.visual === "popsicle-brown") {
    return `<img class="product-art popsicle-art" src="images/popsicle-brown.svg" alt="Picolé cremoso de brigadeiro" loading="lazy" width="115" height="145">`;
  }

  return `<span class="visual-emoji" aria-hidden="true">${product.emoji}</span>`;
}

function renderCatalog() {
  const root = $("#catalog-grid");
  const filtered = state.filter === "Todos" ? PRODUCTS : PRODUCTS.filter((p) => p.category === state.filter);
  root.innerHTML = "";

  if (!state.settings.storeOpen) {
    const note = document.createElement("div");
    note.className = "store-closed-note";
    note.textContent = state.settings.storeMessage || "Pedidos temporariamente pausados. Consulte a equipe na barraca.";
    root.append(note);
  }

  filtered.forEach((product) => {
    const available = Boolean(state.settings.availability?.[product.id]);
    const price = productPrice(product, state.settings);
    const canBuy = state.settings.storeOpen && available && price !== null;
    const qty = Number(state.cart[product.id] || 0);
    const article = document.createElement("article");
    article.className = `product-card${!available ? " sold-out" : ""}`;
    article.style.setProperty("--accent", product.accent);
    article.innerHTML = `
      <div class="product-visual">
        <span class="product-badge ${!available ? "sold" : ""}">${!available ? "ESGOTADO" : product.featured ? "DESTAQUE" : "DISPONÍVEL"}</span>
        ${productVisual(product)}
      </div>
      <div class="product-body">
        <div class="product-category"><span>${product.category}</span><span>${qty > 0 ? `${qty} na sacola` : available ? "● disponível" : "indisponível"}</span></div>
        <h3>${product.name}</h3>
        <p>${product.subtitle}</p>
        <div class="product-footer">
          <div class="product-price"><small>VALOR</small>${price !== null ? `<strong>${formatMoney(price)}</strong>` : `<strong class="price-pending">Preço em breve</strong>`}</div>
          <button class="add-button" type="button" ${canBuy ? "" : "disabled"}>${!state.settings.storeOpen ? "Pausado" : !available ? "Esgotado" : price === null ? "Aguardando preço" : qty ? "+ Adicionar" : "Adicionar"}</button>
        </div>
      </div>`;
    $(".add-button", article).addEventListener("click", () => addItem(product.id));
    root.append(article);
  });
}

function addItem(id) {
  const product = PRODUCT_MAP[id];
  if (!product) return;
  const price = productPrice(product, state.settings);
  if (!state.settings.storeOpen || !state.settings.availability[id] || price === null) return;
  state.cart[id] = Math.min(20, Number(state.cart[id] || 0) + 1);
  saveCart();
  showToast(`${product.name} adicionado ✓`);
}

function changeQty(id, delta) {
  const current = Number(state.cart[id] || 0);
  const next = Math.max(0, Math.min(20, current + delta));
  if (next === 0) delete state.cart[id]; else state.cart[id] = next;
  saveCart();
}

function renderCart() {
  const entries = cartEntries();
  const count = cartCount();
  const total = cartTotal();
  $("#cart-count").textContent = String(count);
  $("#experience-cart-count").textContent = String(count);
  $("#cart-total").textContent = formatMoney(total);
  $("#checkout-total").textContent = formatMoney(total);
  $("#mobile-cart-items").textContent = `${count} ${count === 1 ? "item" : "itens"}`;
  $("#mobile-cart-total").textContent = formatMoney(total);
  $("#mobile-cart-bar").classList.toggle("hidden", count === 0);
  $("#cart-empty").classList.toggle("hidden", count > 0);
  $("#cart-content").classList.toggle("hidden", count === 0);

  const list = $("#cart-list");
  list.innerHTML = "";
  entries.forEach(({ product, qty }) => {
    const price = productPrice(product, state.settings) || 0;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.innerHTML = `
      <div class="cart-thumb">${product.emoji}</div>
      <div class="cart-row-info"><strong>${product.name}</strong><small>${formatMoney(price)} cada · ${formatMoney(price * qty)}</small></div>
      <div class="qty-control"><button type="button" data-minus aria-label="Remover um">−</button><span>${qty}</span><button type="button" data-plus aria-label="Adicionar um">+</button></div>`;
    $("[data-minus]", row).addEventListener("click", () => changeQty(product.id, -1));
    $("[data-plus]", row).addEventListener("click", () => changeQty(product.id, 1));
    list.append(row);
  });
}

function renderStandOptions() {
  const root = $("#stand-options");
  root.innerHTML = "";
  const count = Number(state.settings.standCount || 3);
  for (let i = 1; i <= count; i += 1) {
    const label = document.createElement("label");
    label.className = "stand-option";
    label.innerHTML = `<input type="radio" name="stand" value="${i}" ${state.selectedStand === i ? "checked" : ""} required><span>Barraca ${i}</span>`;
    $("input", label).addEventListener("change", () => { state.selectedStand = i; });
    root.append(label);
  }
}

function renderAll() {
  renderStoreState();
  renderTabs();
  renderCatalog();
  renderCart();
  renderStandOptions();
}

function openCheckout() {
  if (!cartCount()) return;
  if (!state.settings.storeOpen) return showToast("Os pedidos estão pausados agora.");
  const invalid = cartEntries().some(({ product }) => !state.settings.availability[product.id] || productPrice(product, state.settings) === null);
  if (invalid) {
    showToast("Sua sacola tem um item indisponível. Revise o pedido.");
    renderCart();
    return;
  }
  $("#customer-name").value = localStorage.getItem(CUSTOMER_NAME_KEY) || "";
  renderStandOptions();
  closeOverlay("#cart-overlay");
  openOverlay("#checkout-overlay");
  setTimeout(() => $("#customer-name")?.focus(), 100);
}

function createLocalOrderId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `SUN-${Array.from(bytes, (n) => chars[n % chars.length]).join("")}`;
}

function buildOrderMessage(order) {
  const lines = [
    "🍧 *SUN & ICE — NOVO PEDIDO*",
    "",
    `*Pedido:* ${order.id}`,
    `*Cliente:* ${order.customerName}`,
    `*Retirada:* Barraca ${order.stand}`,
    "",
    "*ITENS:*"
  ];
  order.items.forEach((item) => lines.push(`• ${item.qty}× ${item.name} — ${formatMoney(item.subtotal)}`));
  lines.push(
    "",
    `*TOTAL: ${formatMoney(order.total)}*`,
    "",
    `Pix: ${state.settings.pixKey}`,
    `Recebedor: ${state.settings.receiver}`,
    "",
    "✅ Já fiz o Pix. Vou anexar o comprovante nesta conversa.",
    "",
    `📍 Código para retirada: *${order.id}*`
  );
  if (!order.registered) lines.push("", "⚠️ Painel temporariamente indisponível — valide este pedido pelo comprovante no WhatsApp.");
  return lines.join("\n");
}

async function createOrderOnBackend(payload) {
  const response = await fetchWithTimeout("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload)
  }, 5500);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Não foi possível registrar o pedido.");
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data.order;
}

async function handleCheckout(event) {
  event.preventDefault();
  if (state.submitting) return;
  const error = $("#checkout-error");
  error.classList.add("hidden");

  const name = safeText($("#customer-name").value, 40);
  const checkedStand = $("input[name='stand']:checked");
  const paymentChecked = $("#payment-confirmation").checked;
  if (name.length < 2) return showFormError("Digite seu primeiro nome.");
  if (!checkedStand) return showFormError("Escolha a barraca de retirada.");
  if (!paymentChecked) return showFormError("Marque a confirmação depois de fazer o Pix.");
  if (!cartCount()) return showFormError("Sua sacola está vazia.");

  state.selectedStand = Number(checkedStand.value);
  localStorage.setItem(CUSTOMER_NAME_KEY, name);
  const payload = {
    customerName: name,
    stand: state.selectedStand,
    items: cartEntries().map(({ product, qty }) => ({ id: product.id, qty })),
    clientCreatedAt: new Date().toISOString()
  };

  state.submitting = true;
  const submit = $("#submit-order");
  submit.disabled = true;
  submit.textContent = "Preparando pedido…";

  let order;
  try {
    order = await createOrderOnBackend(payload);
    order.registered = true;
    setBackendStatus(true);
  } catch (backendError) {
    if (backendError.status && backendError.status < 500) {
      showFormError(backendError.message);
      submit.disabled = false;
      submit.textContent = "Abrir pedido no WhatsApp →";
      state.submitting = false;
      await loadSettings();
      return;
    }
    console.warn("Sun & Ice fallback:", backendError);
    setBackendStatus(false);
    const items = payload.items.map(({ id, qty }) => {
      const product = PRODUCT_MAP[id];
      const price = productPrice(product, state.settings) || 0;
      return { id, qty, name: product.name, unitPrice: price, subtotal: price * qty };
    });
    order = {
      id: createLocalOrderId(), customerName: name, stand: state.selectedStand, items,
      total: items.reduce((sum, item) => sum + item.subtotal, 0),
      status: "new", createdAt: new Date().toISOString(), registered: false
    };
  }

  const message = buildOrderMessage(order);
  const whatsappUrl = `https://wa.me/${state.settings.whatsapp}?text=${encodeURIComponent(message)}`;
  const last = { ...order, whatsappUrl, message, savedAt: Date.now() };
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(last));
  sessionStorage.setItem(SUCCESS_FLAG, "1");
  state.lastOrder = last;
  state.cart = {};
  localStorage.removeItem(CART_KEY);
  renderCart();
  renderCatalog();
  closeOverlay("#checkout-overlay");
  showSuccess(last);

  submit.disabled = false;
  submit.textContent = "Abrir pedido no WhatsApp →";
  state.submitting = false;

  setTimeout(() => { window.location.href = whatsappUrl; }, 320);
}

function showFormError(message) {
  const error = $("#checkout-error");
  error.textContent = message;
  error.classList.remove("hidden");
  error.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showSuccess(order) {
  if (!order) return;
  $("#success-order-code").textContent = order.id;
  $("#success-text").textContent = order.registered === false
    ? "O painel estava indisponível, mas seu pedido continua válido pelo WhatsApp. Envie a mensagem e o comprovante."
    : "Seu pedido foi registrado. Envie a mensagem no WhatsApp e o comprovante do Pix.";
  openOverlay("#success-overlay");
}

function newOrder() {
  localStorage.removeItem(LAST_ORDER_KEY);
  sessionStorage.removeItem(SUCCESS_FLAG);
  state.lastOrder = null;
  closeOverlay("#success-overlay");
  document.querySelector("#cardapio")?.scrollIntoView({ behavior: "smooth" });
}

function wireEvents() {
  $("#open-cart").addEventListener("click", () => openOverlay("#cart-overlay"));
  $("#mobile-cart-open").addEventListener("click", () => openOverlay("#cart-overlay"));
  document.querySelectorAll("[data-close-cart]").forEach((button) => button.addEventListener("click", () => closeOverlay("#cart-overlay")));
  $("#checkout").addEventListener("click", openCheckout);
  $("[data-close-checkout]").addEventListener("click", () => closeOverlay("#checkout-overlay"));
  $("#checkout-form").addEventListener("submit", handleCheckout);
  $("#copy-pix").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.settings.pixKey);
      $("#copy-pix").textContent = "✓ Chave Pix copiada";
      showToast("Chave Pix copiada ✓");
      setTimeout(() => { $("#copy-pix").textContent = "⧉ Copiar chave Pix"; }, 2200);
    } catch {
      showToast(`Pix: ${state.settings.pixKey}`);
    }
  });
  $("#resend-whatsapp").addEventListener("click", () => { if (state.lastOrder?.whatsappUrl) window.location.href = state.lastOrder.whatsappUrl; });
  $("#new-order").addEventListener("click", newOrder);
  $("[data-close-success]").addEventListener("click", () => closeOverlay("#success-overlay"));
  $("#how-trigger").addEventListener("click", () => openOverlay("#how-sheet"));
  document.querySelectorAll("[data-close-how]").forEach((button) => button.addEventListener("click", () => closeOverlay("#how-sheet")));

  ["#cart-overlay", "#checkout-overlay"].forEach((selector) => {
    $(selector).addEventListener("click", (event) => { if (event.target === $(selector)) closeOverlay(selector); });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    ["#cart-overlay", "#checkout-overlay", "#success-overlay", "#how-sheet"].forEach(closeOverlay);
  });

  window.addEventListener("online", () => loadSettings());
  window.addEventListener("offline", () => setBackendStatus(false));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && navigator.onLine) loadSettings(); });
  window.addEventListener("pageshow", () => {
    const flag = sessionStorage.getItem(SUCCESS_FLAG);
    const recent = state.lastOrder && Date.now() - Number(state.lastOrder.savedAt || 0) < 30 * 60 * 1000;
    if (flag && recent) showSuccess(state.lastOrder);
  });
}

async function init() {
  wireEvents();
  renderAll();
  await loadSettings();
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

init();
