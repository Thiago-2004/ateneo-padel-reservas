import jwt from "jsonwebtoken";

export function requireAuth(secret) {
  return (req, res, next) => {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No autorizado" });

    try {
      req.user = jwt.verify(token, secret);
      next();
    } catch {
      return res.status(401).json({ error: "Token inválido" });
    }
  };
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Solo admin" });
  next();
}
