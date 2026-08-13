const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const requestLog = new Map();

fs.mkdirSync(DATA_DIR, { recursive: true });
const seedProducts = [
  { id: 1, name: "Aurora Headphones", category: "Audio", price: 129.99, stock: 18, image: "🎧", featured: true },
  { id: 2, name: "Nova Keyboard", category: "Accesorios", price: 89.99, stock: 25, image: "⌨️", featured: true },
  { id: 3, name: "Pulse Smartwatch", category: "Wearables", price: 159.99, stock: 12, image: "⌚", featured: false },
  { id: 4, name: "Halo Lamp", category: "Hogar", price: 74.99, stock: 30, image: "💡", featured: false },
  { id: 5, name: "Orbit Mouse", category: "Accesorios", price: 49.99, stock: 40, image: "🖱️", featured: true },
  { id: 6, name: "Echo Speaker", category: "Audio", price: 99.99, stock: 16, image: "🔊", featured: false }
];
if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(seedProducts, null, 2));
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});
app.use((req, res, next) => {
  const now = Date.now();
  const key = req.ip || "unknown";
  const entry = requestLog.get(key) || { start: now, count: 0 };
  if (now - entry.start >= WINDOW_MS) { entry.start = now; entry.count = 0; }
  entry.count += 1;
  requestLog.set(key, entry);
  if (entry.count > MAX_REQUESTS) return res.status(429).json({ error: "Demasiadas solicitudes. Intenta nuevamente." });
  next();
});
app.use(express.json({ limit: "16kb" }));
app.use(express.static(path.join(__dirname, "public")));

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
function normalizeText(value, max = 120) { return String(value ?? "").trim().slice(0, max); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ error: "Panel administrativo no configurado." });
  const authorization = req.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || !crypto.timingSafeEqual(Buffer.from(authorization.slice(7)), Buffer.from(ADMIN_TOKEN))) {
    return res.status(401).json({ error: "No autorizado." });
  }
  next();
}

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "glassmorph-ecommerce" }));
app.get("/api/products", (req, res) => {
  const products = readJson(PRODUCTS_FILE);
  const q = normalizeText(req.query.q, 80).toLowerCase();
  const category = normalizeText(req.query.category, 50);
  res.json(products.filter(p => (!q || `${p.name} ${p.category}`.toLowerCase().includes(q)) && (!category || p.category === category)));
});
app.get("/api/categories", (req, res) => res.json([...new Set(readJson(PRODUCTS_FILE).map(p => p.category))]));

app.post("/api/orders", (req, res) => {
  const customerName = normalizeText(req.body?.customer?.name, 80);
  const customerEmail = normalizeText(req.body?.customer?.email, 160).toLowerCase();
  const items = req.body?.items;
  if (!customerName || !validEmail(customerEmail) || !Array.isArray(items) || items.length < 1 || items.length > 20) {
    return res.status(400).json({ error: "Datos de pedido inválidos." });
  }

  const products = readJson(PRODUCTS_FILE);
  const normalizedItems = [];
  let total = 0;
  const requested = new Map();
  for (const item of items) {
    const id = Number(item?.id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: "Cantidad o producto inválido." });
    }
    requested.set(id, (requested.get(id) || 0) + quantity);
  }
  for (const [id, quantity] of requested) {
    const product = products.find(p => p.id === id);
    if (!product) return res.status(400).json({ error: "Producto no encontrado." });
    if (quantity > product.stock) return res.status(409).json({ error: `Stock insuficiente para ${product.name}.` });
    total += product.price * quantity;
    normalizedItems.push({ productId: product.id, name: product.name, price: product.price, quantity });
  }

  for (const item of normalizedItems) products.find(p => p.id === item.productId).stock -= item.quantity;
  const orders = readJson(ORDERS_FILE);
  const order = {
    id: `ORD-${crypto.randomUUID()}`,
    customer: { name: customerName, email: customerEmail },
    items: normalizedItems,
    total: Number(total.toFixed(2)),
    status: "received",
    payment: "sandbox-not-configured",
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeJson(PRODUCTS_FILE, products);
  writeJson(ORDERS_FILE, orders);
  res.status(201).json(order);
});

app.get("/api/admin/orders", requireAdmin, (req, res) => res.json(readJson(ORDERS_FILE)));
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const allowed = new Set(["received", "processing", "shipped", "completed", "cancelled"]);
  const status = normalizeText(req.body?.status, 30);
  if (!allowed.has(status)) return res.status(400).json({ error: "Estado inválido." });
  const orders = readJson(ORDERS_FILE);
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido no encontrado." });
  order.status = status;
  order.updatedAt = new Date().toISOString();
  writeJson(ORDERS_FILE, orders);
  res.json(order);
});

app.get("/api/orders", (req, res) => res.status(404).json({ error: "Endpoint no disponible públicamente." }));
app.get("/{*splat}", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => console.log(`Glassmorph E-commerce running at http://localhost:${PORT}`));
