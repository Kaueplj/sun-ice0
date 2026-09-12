export const PRODUCTS = [
  { id: "agua-500", group: "water", category: "Bebidas", name: "Água Mineral", subtitle: "500 ml · gelada", visual: "water", accent: "#63b7ff", emoji: "💧", featured: true, defaultPrice: 3 },

  { id: "brownie-brigadeiro", group: "brownie", category: "Brownies", name: "Brownie de Brigadeiro", subtitle: "Brownie recheado · brigadeiro", visual: "brownie", accent: "#6f3c2c", emoji: "🍫", featured: true, defaultPrice: 12 },
  { id: "brownie-bem-casado", group: "brownie", category: "Brownies", name: "Brownie Bem-casado", subtitle: "Brownie recheado · bem-casado", visual: "brownie", accent: "#6f3c2c", emoji: "🍫", featured: true, defaultPrice: 12 },
  { id: "brownie-ninho", group: "brownie", category: "Brownies", name: "Brownie de Ninho", subtitle: "Brownie recheado · leite Ninho", visual: "brownie", accent: "#6f3c2c", emoji: "🍫", featured: true, defaultPrice: 12 },

  { id: "picole-sensacao-baunilha", group: "popsicle", category: "Picolés", name: "Sensação de Baunilha", subtitle: "Picolé cremoso", visual: "popsicle-white", accent: "#f8f0df", emoji: "🍦", defaultPrice: 10 },
  { id: "picole-sensacao-chocolate-branco", group: "popsicle", category: "Picolés", name: "Sensação de Chocolate Branco", subtitle: "Picolé cremoso", visual: "popsicle-white", accent: "#fffaf0", emoji: "🍦", defaultPrice: 10 },
  { id: "picole-sensacao-brigadeiro", group: "popsicle", category: "Picolés", name: "Sensação de Brigadeiro", subtitle: "Picolé cremoso", visual: "popsicle-brown", accent: "#6f3c2c", emoji: "🍦", defaultPrice: 10 },
  { id: "picole-caja", group: "popsicle", category: "Picolés", name: "Cajá", subtitle: "Picolé frutado", visual: "popsicle", accent: "#f4b833", emoji: "🥭", defaultPrice: 6 },
  { id: "picole-morango", group: "popsicle", category: "Picolés", name: "Morango", subtitle: "Picolé frutado", visual: "popsicle", accent: "#ef6d7a", emoji: "🍓", defaultPrice: 6 },
  { id: "picole-uva", group: "popsicle", category: "Picolés", name: "Uva", subtitle: "Picolé frutado", visual: "popsicle", accent: "#8e67c7", emoji: "🍇", defaultPrice: 6 },

  { id: "sacole-mousse-maracuja", group: "sacole", category: "Sacolé", name: "Mousse de Maracujá", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#f4c63e", emoji: "✨", defaultPrice: 8 },
  { id: "sacole-morango-nutella", group: "sacole", category: "Sacolé", name: "Morango com Nutella", subtitle: "Sacolé premium", visual: "sacole", accent: "#e96072", emoji: "🍓", defaultPrice: 9 },
  { id: "sacole-maracuja-nutella", group: "sacole", category: "Sacolé", name: "Maracujá com Nutella", subtitle: "Sacolé premium", visual: "sacole", accent: "#e1a830", emoji: "✨", defaultPrice: 9 },
  { id: "sacole-mousse-morango", group: "sacole", category: "Sacolé", name: "Mousse de Morango", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#ef7990", emoji: "🍓", defaultPrice: 7 },
  { id: "sacole-chocolate", group: "sacole", category: "Sacolé", name: "Sacolé de Chocolate", subtitle: "Sacolé cremoso", visual: "sacole", accent: "#71432f", emoji: "🍫", defaultPrice: 7 }
];

// Mantido por compatibilidade com versões antigas do painel.
export const PRICE_LABELS = {
  water: "Água 500 ml",
  brownie: "Brownies",
  popsicle: "Picolés",
  sacole: "Sacolés"
};

const DEFAULT_PRODUCT_PRICES = Object.fromEntries(
  PRODUCTS.map((product) => [product.id, product.defaultPrice ?? null])
);

export const DEFAULT_SETTINGS = {
  version: 5,
  storeOpen: true,
  storeMessage: "Pedidos abertos · retirada rápida no evento",
  whatsapp: "5581994976997",
  pixKey: "caaturma@gmail.com",
  receiver: "Ana Beatriz Nunes",
  standCount: 3,
  productPrices: DEFAULT_PRODUCT_PRICES,
  // Mantido para que dados antigos salvos no Netlify não quebrem.
  prices: {
    water: 3,
    brownie: null,
    popsicle: null,
    sacole: null
  },
  availability: Object.fromEntries(PRODUCTS.map((product) => [product.id, true]))
};

export const PRODUCT_MAP = Object.fromEntries(PRODUCTS.map((product) => [product.id, product]));

function normalizePrice(value) {
  if (value === null || value === "" || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > 100) return null;
  return Math.round(number * 100) / 100;
}

export function normalizeSettings(raw = {}) {
  const savedProductPrices = raw.productPrices && typeof raw.productPrices === "object"
    ? raw.productPrices
    : {};

  const productPrices = Object.fromEntries(
    PRODUCTS.map((product) => {
      const hasSavedPrice = Object.prototype.hasOwnProperty.call(savedProductPrices, product.id);
      const value = hasSavedPrice ? savedProductPrices[product.id] : product.defaultPrice;
      return [product.id, normalizePrice(value) ?? normalizePrice(product.defaultPrice)];
    })
  );

  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    version: 5,
    productPrices,
    prices: { ...DEFAULT_SETTINGS.prices, ...(raw.prices || {}) },
    availability: { ...DEFAULT_SETTINGS.availability, ...(raw.availability || {}) }
  };
}

export function productPrice(product, settings) {
  if (!product) return null;
  const saved = normalizePrice(settings?.productPrices?.[product.id]);
  return saved ?? normalizePrice(product.defaultPrice);
}
