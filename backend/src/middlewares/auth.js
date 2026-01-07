// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        ok: false,
        message: "Falta Authorization: Bearer <token>",
      });
    }

    const token = header.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        ok: false,
        message: "Token vacío. Inicia sesión de nuevo.",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ lo que ya usas
    req.userId = payload.userId;

    // ✅ nombres consistentes con controllers
    req.userNumeroCuenta = payload.numero_cuenta;

    next();
  } catch (err) {
    return res.status(401).json({
      ok: false,
      message: "Sesión expirada o token inválido. Inicia sesión de nuevo.",
    });
  }
}
