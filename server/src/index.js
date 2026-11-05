import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspace.js";

const app = express();
const port = Number(process.env.PORT || 5000);
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "BlueMenu API",
    version: "0.2.0",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});
app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/admin", adminRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});
app.use((req, res) => res.status(404).json({ error: "Route not found", path: req.path }));

async function start() {
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing. Copy server/.env.example to server/.env and configure MongoDB Atlas.");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log("BlueMenu connected to MongoDB.");
  app.listen(port, () => console.log(`BlueMenu API listening on ${port}`));
}
start().catch(error => {
  console.error("Unable to start BlueMenu:", error.message);
  process.exit(1);
});
