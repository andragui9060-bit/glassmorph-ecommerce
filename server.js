const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
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
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
app.get("/api/products", (req, res) => {
  const products = readJson(PRODUCTS_FILE); const q = String(req.query.q || "").trim().toLowerCase(); const category = String(req.query.category || "").trim();
  res.json(products.filter(p => (!q || `${p.name} ${p.category}`.toLowerCase().includes(q)) && (!category || p.category === category)));
});
app.get("/api/categories", (req, res) => res.json([...new Set(readJson(PRODUCTS_FILE).map(p => p.category))]));
app.post("/api/orders", (req, res) => {
  const { customer, items } = req.body;
  if (!customer?.name || !customer?.email || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Datos de pedido incompletos." });
  const products = readJson(PRODUCTS_FILE); let total = 0; const normalizedItems = [];
  for (const item of items) { const product = products.find(p => p.id === Number(item.id)); const quantity = Math.max(1, Number(item.quantity) || 1); if (!product) return res.status(400).json({ error: "Producto no encontrado." }); if (quantity > product.stock) return res.status(400).json({ error: `Stock insuficiente para ${product.name}.` }); total += product.price * quantity; normalizedItems.push({ productId: product.id, name: product.name, price: product.price, quantity }); }
  for (const item of normalizedItems) products.find(p => p.id === item.productId).stock -= item.quantity;
  const orders = readJson(ORDERS_FILE); const order = { id: `ORD-${Date.now()}`, customer: { name: String(customer.name).trim(), email: String(customer.email).trim() }, items: normalizedItems, total: Number(total.toFixed(2)), status: "received", createdAt: new Date().toISOString() };
  orders.push(order); writeJson(PRODUCTS_FILE, products); writeJson(ORDERS_FILE, orders); res.status(201).json(order);
});
app.get("/api/orders", (req, res) => res.json(readJson(ORDERS_FILE)));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`Glassmorph E-commerce running at http://localhost:${PORT}`));
