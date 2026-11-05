import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import workspaceRoutes from "./routes/workspace.js";
import paymentRoutes from "./routes/payments.js";
import subscriptionRoutes from "./routes/subscriptions.js";
import aiRoutes from "./routes/ai.js";
import advancedRoutes from "./routes/advanced.js";
import publicBookingRoutes from "./routes/public-bookings.js";
import pushRoutes from "./routes/push.js";

const app = express();
const port = Number(process.env.PORT || 5000);
app.set("trust proxy", 1);
const allowedOrigins=(process.env.CLIENT_ORIGIN||"http://localhost:5173").split(",").map(value=>value.trim()).filter(Boolean);
app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.use(cors({origin:(origin,callback)=>{if(!origin||allowedOrigins.includes(origin))return callback(null,true);return callback(new Error("Origin is not allowed by CORS"));}}));
const authLimiter=rateLimit({windowMs:15*60*1000,limit:12,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many sign-in or recovery attempts. Try again later."}});
const publicLimiter=rateLimit({windowMs:15*60*1000,limit:120,standardHeaders:"draft-7",legacyHeaders:false,message:{error:"Too many requests. Please try again later."}});
app.use(express.json({ limit: "1mb" }));

const databaseReady = () => mongoose.connection.readyState === 1;

app.get("/api/health/live", (_req, res) => {
  res.json({ ok: true, service: "BlueMenu API", status: "alive", timestamp: new Date().toISOString() });
});

app.get("/api/health/ready", (_req, res) => {
  const ready = databaseReady();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "BlueMenu API",
    status: ready ? "ready" : "not_ready",
    database: ready ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/health", (_req, res) => {
  const ready = databaseReady();
  res.status(ready ? 200 : 503).json({
    ok: ready,
    service: "BlueMenu API",
    version: "0.2.0",
    status: ready ? "ready" : "not_ready",
    database: ready ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});
app.use("/api/public", publicLimiter, publicRoutes);
app.use("/api/public-bookings", publicLimiter, publicBookingRoutes);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/workspace", advancedRoutes);
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
  const server = app.listen(port, () => console.log(`BlueMenu API listening on ${port}`));
  const shutdown = signal => {
    console.log(`BlueMenu received ${signal}; closing server`);
    server.close(async error => {
      if (error) console.error("HTTP server shutdown error:", error);
      try { await mongoose.disconnect(); } catch (disconnectError) { console.error("MongoDB shutdown error:", disconnectError); }
      process.exit(error ? 1 : 0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
start().catch(error => {
  console.error("Unable to start BlueMenu:", error.message);
  process.exit(1);
});
