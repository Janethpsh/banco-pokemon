import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { ok, fail } from "../utils/response.js";

export async function listar(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         b.id,
         b.alias,
         u.correo,
         u.numero_cuenta
       FROM beneficiarios b
       JOIN usuarios u ON u.id = b.usuario_beneficiario_id
       WHERE b.usuario_propietario_id = ?
       ORDER BY b.fecha_creacion DESC`,
      [req.userId]
    );

    return ok(res, { beneficiarios: rows }, "Beneficiarios obtenidos");
  } catch (err) {
    return fail(res, "Error al obtener beneficiarios", 500, err);
  }
}

export async function crear(req, res) {
  try {
    const alias = String(req.body?.alias || "").trim();
    const numeroCuenta = String(req.body?.numero_cuenta || "").trim();

    if (!alias) return fail(res, "Falta alias", 400);
    if (!numeroCuenta) return fail(res, "Falta numero_cuenta", 400);

    // Buscar usuario destino
    const [urows] = await pool.query(
      `SELECT id, correo, numero_cuenta
       FROM usuarios
       WHERE numero_cuenta = ?
       LIMIT 1`,
      [numeroCuenta]
    );
    if (urows.length === 0) return fail(res, "La cuenta destino no existe", 404);

    const destinoUserId = urows[0].id;

    // No guardarte a ti mismo
    if (destinoUserId === req.userId) {
      return fail(res, "No puedes guardarte a ti mismo como favorito", 400);
    }

    const [exist] = await pool.query(
      `SELECT b.id, b.alias
       FROM beneficiarios b
       WHERE b.usuario_propietario_id = ? AND b.usuario_beneficiario_id = ?
       LIMIT 1`,
      [req.userId, destinoUserId]
    );

    if (exist.length) {
      return ok(
        res,
        {
          id: exist[0].id,
          alias: exist[0].alias,
          correo: urows[0].correo,
          numero_cuenta: urows[0].numero_cuenta,
        },
        "Ese beneficiario ya estaba registrado"
      );
    }

    const id = randomUUID();
    await pool.query(
      `INSERT INTO beneficiarios
        (id, usuario_propietario_id, usuario_beneficiario_id, alias, fecha_creacion)
       VALUES (?, ?, ?, ?, NOW())`,
      [id, req.userId, destinoUserId, alias]
    );

    return ok(
      res,
      {
        id,
        alias,
        correo: urows[0].correo,
        numero_cuenta: urows[0].numero_cuenta,
      },
      "Beneficiario creado"
    );
  } catch (err) {
    return fail(res, "Error al crear beneficiario", 500, err);
  }
}

export async function eliminar(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return fail(res, "Falta id", 400);

    const [r] = await pool.query(
      `DELETE FROM beneficiarios
       WHERE id = ? AND usuario_propietario_id = ?`,
      [id, req.userId]
    );

    if (r.affectedRows === 0) {
      return fail(res, "Favorito no encontrado", 404);
    }

    return ok(res, { id }, "Favorito eliminado");
  } catch (err) {
    return fail(res, "Error al eliminar favorito", 500, err);
  }
}
