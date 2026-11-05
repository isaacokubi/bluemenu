import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 5000);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : undefined }) : null;
app.get("/api/health", async (_req, res) => {
  let database = "not-configured";
  if (pool) { try { await pool.query("SELECT 1"); database = "connected"; } catch { database = "unavailable"; } }
  res.json({ ok: true, service: "BlueMenu API", version: "0.1.0", database, timestamp: new Date().toISOString() });
});
app.get("/api/demo", (_req, res) => res.json({
  organization: { name: "BlueMenu Demo", type: "restaurant" },
  menu: [{ category: "Popular", items: [{ name: "Grilled Chicken", description: "Herb-marinated chicken with seasonal sides", price: 850, currency: "KES" }, { name: "Fresh Juice", description: "Freshly squeezed seasonal fruit", price: 250, currency: "KES" }] }],
  agenda: [{ title: "School Staff Meeting", date: "2026-11-10", items: ["Opening prayer", "Review of previous minutes", "Academic performance", "Action points"] }]
}));
app.use((req, res) => res.status(404).json({ error: "Route not found", path: req.path }));
app.listen(port, () => console.log(`BlueMenu API listening on ${port}`));
