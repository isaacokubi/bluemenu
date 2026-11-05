import jwt from "jsonwebtoken";
import { User, Organization } from "../models/index.js";

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) return res.status(401).json({ error: "Sign in to continue" });
    if (!process.env.JWT_SECRET) return res.status(503).json({ error: "Authentication is not configured" });

    const payload = jwt.verify(match[1], process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");
    if (!user || !user.active || (payload.ver ?? 0) !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: "Account or session is unavailable. Sign in again." });
    }

    const organization = await Organization.findById(user.organization).select("status");
    if (!organization || organization.status !== "active") {
      return res.status(403).json({ error: "This workspace is unavailable. Contact the organization owner." });
    }

    req.user = user;
    req.organization = organization;
    return next();
  } catch (error) {
    return res.status(401).json({
      error: error.name === "TokenExpiredError" ? "Session expired. Sign in again." : "Invalid authentication token"
    });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: "You do not have permission to perform this action" });
}
