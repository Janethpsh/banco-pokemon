import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { ok, fail } from "../utils/response.js";

const MAX_TRANSFER = 50000;

async function getCuentaByUserId(userId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.saldo, u.numero_cuenta, u.correo
     FROM cuentas c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.usuario_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows.length ? rows[0] : null;
}

async function getCuentaByNumeroCuenta(numeroCuenta) {
  const [rows] = await pool.query(
    `SELECT c.id, c.saldo, u.id AS usuario_id, u.numero_cuenta, u.correo
     FROM usuarios u
     JOIN cuentas c ON c.usuario_id = u.id
     WHERE u.numero_cuenta = ?
     LIMIT 1`,
    [numeroCuenta]
  );
  return rows.length ? rows[0] : null;
}

export async function transferir(req, res) {
  try {
    const destinoNumero = String(req.body?.destino_numero_cuenta || "").trim();
    const monto = Number(req.body?.monto);
    const guardar = Boolean(req.body?.guardar_beneficiario);
    const alias = String(req.body?.alias || "").trim();
    const conceptoRaw = String(req.body?.concepto || "").trim();
    const concepto = conceptoRaw.length ? conceptoRaw.slice(0, 120) : null;

    if (!destinoNumero) return fail(res, "Falta destino_numero_cuenta", 400);
    if (!Number.isFinite(monto) || monto <= 0) {
      return fail(res, "Monto inválido (debe ser > 0)", 400);
    }
    if (monto > MAX_TRANSFER) {
      return fail(res, `Monto excede el máximo por transferencia (${MAX_TRANSFER})`, 400);
    }

    // ORIGEN SIEMPRE desde el token
    const origen = await getCuentaByUserId(req.userId);
    if (!origen) return fail(res, "Cuenta origen no encontrada", 404);

    const destino = await getCuentaByNumeroCuenta(destinoNumero);
    if (!destino) return fail(res, "La cuenta destino no existe", 404);

    // No transferir a la misma cuenta
    if (destino.id === origen.id) {
      return fail(res, "No puedes transferirte a tu propia cuenta", 400);
    }

    // Saldo suficiente
    if (Number(origen.saldo) < monto) {
      return fail(res, "Saldo insuficiente", 400);
    }

    // Transacción DB
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1) Restar a origen
      await conn.query(`UPDATE cuentas SET saldo = saldo - ? WHERE id = ?`, [
        monto,
        origen.id,
      ]);

      // 2) Sumar a destino
      await conn.query(`UPDATE cuentas SET saldo = saldo + ? WHERE id = ?`, [
        monto,
        destino.id,
      ]);

      // 3) Registrar movimientos (dos filas) con concepto
      const idSalida = randomUUID();
      const idEntrada = randomUUID();

      await conn.query(
        `INSERT INTO transacciones
          (id, tipo, monto, cuenta_origen_id, cuenta_destino_id, concepto, fecha_creacion)
         VALUES (?, 'TRANSFERENCIA_SALIDA', ?, ?, ?, ?, NOW())`,
        [idSalida, monto, origen.id, destino.id, concepto]
      );

      await conn.query(
        `INSERT INTO transacciones
          (id, tipo, monto, cuenta_origen_id, cuenta_destino_id, concepto, fecha_creacion)
         VALUES (?, 'TRANSFERENCIA_ENTRADA', ?, ?, ?, ?, NOW())`,
        [idEntrada, monto, origen.id, destino.id, concepto]
      );

      // 4) Guardar beneficiario si lo piden
      let beneficiarioGuardado = false;

      if (guardar) {
        if (!alias) {
          await conn.rollback();
          return fail(res, "Falta alias para guardar como favorito", 400);
        }

        // Buscar usuario del destino
        const destinoUsuarioId = destino.usuario_id;

        // Insertar si no existe (por tu UNIQUE)
        const [exist] = await conn.query(
          `SELECT id FROM beneficiarios
           WHERE usuario_propietario_id = ? AND usuario_beneficiario_id = ?
           LIMIT 1`,
          [req.userId, destinoUsuarioId]
        );

        if (exist.length === 0) {
          await conn.query(
            `INSERT INTO beneficiarios
              (id, usuario_propietario_id, usuario_beneficiario_id, alias, fecha_creacion)
             VALUES (?, ?, ?, ?, NOW())`,
            [randomUUID(), req.userId, destinoUsuarioId, alias]
          );
          beneficiarioGuardado = true;
        }
      }

      await conn.commit();

      return ok(
        res,
        {
          desde: origen.numero_cuenta,
          destino: destino.numero_cuenta,
          monto,
          concepto,
          guardar_beneficiario: guardar,
          beneficiarioGuardado,
        },
        "Transferencia realizada"
      );
    } catch (e) {
      try { await conn.rollback(); } catch {}
      return fail(res, "Error al transferir", 500, e);
    } finally {
      conn.release();
    }
  } catch (err) {
    return fail(res, "Error inesperado en transferir", 500, err);
  }
}
