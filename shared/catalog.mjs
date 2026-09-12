export const PRODUCTS = [
  { id: "agua-500", group: "water", category: "Bebidas", name: "Água Mineral", subtitle: "500 ml · gelada", visual: "water", accent: "#63b7ff", emoji: "💧", featured: true },
  { id: "brownie", group: "brownie", category: "Doces", name: "Brownie", subtitle: "Macio por dentro, intenso por fora", visual: "brownie", accent: "#7a3f22", emoji: "🍫", featured: true },

  { id: "picole-sensacao-baunilha", group: "popsicle", category: "Picolés", name: "Sensação de Baunilha", subtitle: "Picolé cremoso", visual: "popsicle", accent: "#f6dd9e", emoji: "🍦" },
  { id: "picole-sensacao-chocolate-branco", group: "popsicle", category: "Picolés", name: "Sensação de Chocolate Branco", subtitle: "Picolé cremoso", visual: "popsicle", accent: "#f7ead3", emoji: "🍦" },
  { id: "picole-sensacao-brigadeiro", group: "popsicle", category: "Picolés", name: "Sensação de Brigadeiro", subtitle: "Picolé cremoso", visual: "popsicle", accent: "#6f3c2c", emoji: "🍦" },
  { id: "picole-caja", group: "popsicle", category: "Picolés", name: "Cajá", subtitle: "Picolé frutado", visual: "popsicle", accent: "#f4b833", emoji: "🥭" },
  { id: "picole-morango", group: "popsicle", category: "Picolés", name: "Morango", subtitle: "Picolé frutado", visual: "popsicle", accent: "#ef6d7a", emoji: "🍓" },
  { id: "picole-uva", group: "popsicle", category: "Picolés", name: "Uva", subtitle: "Picolé frutado", visual: "popsicle", accent: "#8e67c7", emoji: "🍇" },

  { id: "sacole-mousse-maracuja", group: "sacole", category: "Sacolé", name: "Mousse de Maracujá", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#f4c63e", emoji: "✨" },
  { id: "sacole-morango-nutella", group: "sacole", category: "Sacolé", name: "Morango com Nutella", subtitle: "Sacolé premium", visual: "sacole", accent: "#e96072", emoji: "🍓" },
  { id: "sacole-maracuja-nutella", group: "sacole", category: "Sacolé", name: "Maracujá com Nutella", subtitle: "Sacolé premium", visual: "sacole", accent: "#e1a830", emoji: "✨" },
  { id: "sacole-mousse-morango", group: "sacole", category: "Sacolé", name: "Mousse de Morango", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#ef7990", emoji: "🍓" },
  { id: "sacole-chocolate", group: "sacole", category: "Sacolé", name: "Chocolate", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#71432f", emoji: "🍫" },
  { id: "sacole-brigadeiro", group: "sacole", category: "Sacolé", name: "Brigadeiro", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#623728", emoji: "🍫" },
  { id: "sacole-bem-casado", group: "sacole", category: "Sacolé", name: "Bem-casado", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#d9aa68", emoji: "🤍" },
  { id: "sacole-ninho", group: "sacole", category: "Sacolé", name: "Ninho", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#e9dfcd", emoji: "🥛" }
];

export const DEFAULT_SETTINGS = {
  version: 2,
  storeOpen: true,
  storeMessage: "Pedidos abertos · retirada rápida no evento",
  whatsapp: "5581994976997",
  pixKey: "caaturma@gmail.com",
  receiver: "Ana Beatriz Nunes",
  standCount: 3,
  prices: {
    water: 3,
    brownie: null,
    popsicle: null,
    sacole: null
  },
  availability: Object.fromEntries(PRODUCTS.map((product) => [product.id, true]))
};

export const PRICE_LABELS = {
  water: "Água 500 ml",
  brownie: "Brownie",
  popsicle: "Picolés",
  sacole: "Sacolés"
};

export const PRODUCT_MAP = Object.fromEntries(PRODUCTS.map((product) => [product.id, product]));

export function normalizeSettings(raw = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    prices: { ...DEFAULT_SETTINGS.prices, ...(raw.prices || {}) },
    availability: { ...DEFAULT_SETTINGS.availability, ...(raw.availability || {}) }
  };
}

export function productPrice(product, settings) {
  const value = settings?.prices?.[product.group];
  return Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
}
