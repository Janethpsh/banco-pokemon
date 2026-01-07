// backend/src/auth/controller.js
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";

import { pool } from "../db/pool.js";
import { ok, fail } from "../utils/response.js";

export async function register(req, res) {
  try {
    const { nombre_completo, correo, password } = req.body;

    if (!nombre_completo || !correo || !password) {
      return fail(res, "Faltan datos: nombre_completo, correo, password", 400);
    }

    // ¿Ya existe ese correo?
    const [exists] = await pool.query(
      "SELECT id FROM usuarios WHERE correo = ? LIMIT 1",
      [correo]
    );
    if (exists.length > 0) {
      return fail(res, "Ese correo ya está registrado", 409);
    }

    const id = randomUUID();
    const password_hash = await bcrypt.hash(password, 10);

    const numero_cuenta =
      "PK-" + Math.floor(1000000000 + Math.random() * 9000000000);

    await pool.query(
      `INSERT INTO usuarios (id, nombre_completo, correo, password_hash, numero_cuenta)
       VALUES (?, ?, ?, ?, ?)`,
      [id, nombre_completo, correo, password_hash, numero_cuenta]
    );

    await pool.query(
      `INSERT INTO cuentas (id, usuario_id, saldo)
       VALUES (?, ?, 0)`,
      [randomUUID(), id]
    );

    return ok(res, { id, correo, numero_cuenta }, "Registro OK");
  } catch (err) {
    return fail(res, "Error en registro", 500, err);
  }
}

export async function login(req, res) {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return fail(res, "Faltan datos: correo, password", 400);
    }

    const [rows] = await pool.query(
      `SELECT id, nombre_completo, correo, password_hash, numero_cuenta
       FROM usuarios
       WHERE correo = ?
       LIMIT 1`,
      [correo]
    );

    if (rows.length === 0) {
      return fail(res, "Credenciales inválidas", 401);
    }

    const user = rows[0];
    const okPass = await bcrypt.compare(password, user.password_hash);
    if (!okPass) return fail(res, "Credenciales inválidas", 401);

    // ✅ 10 minutos exactos
    const expiresIn = "10m";

    const token = jwt.sign(
      { userId: user.id, numero_cuenta: user.numero_cuenta },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    // Para que puedas comprobarlo fácil en Postman
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return ok(res, { token, expires_in: expiresIn, expires_at: expiresAt }, "Login OK");
  } catch (err) {
    return fail(res, "Error en login", 500, err);
  }
}
