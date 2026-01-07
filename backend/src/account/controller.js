// backend/src/account/controller.js
import { randomUUID } from "crypto";
import { pool } from "../db/pool.js";
import { ok, fail } from "../utils/response.js";

/**
 * Reglas del proyecto:
 * - SALDO_MAXIMO (tope final): 120,000 pokemonedas
 * - CASH-IN (agregar dinero): si el usuario intenta meter más, se AJUSTA al faltante
 *   Ej: saldo=65k, pide=100k => ajustado=55k (para llegar a 120k)
 */
const SALDO_MAXIMO = 120000;

/**
 * Helper: trae la cuenta del usuario logueado
 */
async function getCuentaDelUsuario(userId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.usuario_id, c.saldo, u.correo, u.numero_cuenta, u.nombre_completo
     FROM cuentas c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.usuario_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows.length ? rows[0] : null;
}

/**
 * GET /account/me
 */
export async function me(req, res) {
  try {
    const cuenta = await getCuentaDelUsuario(req.userId);
    if (!cuenta) return fail(res, "Cuenta no encontrada", 404);

    return ok(
      res,
      {
        usuario: {
          id: cuenta.usuario_id,
          correo: cuenta.correo,
          numero_cuenta: cuenta.numero_cuenta,
          nombre_completo: cuenta.nombre_completo,
        },
        cuenta: {
          id: cuenta.id,
          saldo: Number(cuenta.saldo),
        },
      },
      "Datos de usuario obtenidos"
    );
  } catch (err) {
    return fail(res, "Error en /me", 500, err);
  }
}

/**
 * GET /account/saldo
 */
export async function saldo(req, res) {
  try {
    const cuenta = await getCuentaDelUsuario(req.userId);
    if (!cuenta) return fail(res, "Cuenta no encontrada", 404);

    return ok(res, { saldo: Number(cuenta.saldo) }, "Saldo obtenido");
  } catch (err) {
    return fail(res, "Error al obtener saldo", 500, err);
  }
}

/**
 * POST /account/agregar-dinero
 * Body: { "monto": number }
 */
export async function agregarDinero(req, res) {
  try {
    const monto = Number(req.body?.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      return fail(res, "Monto inválido (debe ser > 0)", 400);
    }

    const cuenta = await getCuentaDelUsuario(req.userId);
    if (!cuenta) return fail(res, "Cuenta no encontrada", 404);

    const saldoActual = Number(cuenta.saldo);
    const faltante = Math.max(0, SALDO_MAXIMO - saldoActual);

    if (faltante === 0) {
      return fail(
        res,
        `Ya alcanzaste el saldo máximo (${SALDO_MAXIMO} pokemonedas)`,
        400
      );
    }

    // Ajuste automático para no pasarse del saldo máximo
    const montoAjustado = Math.min(monto, faltante);

    await pool.query(`UPDATE cuentas SET saldo = saldo + ? WHERE id = ?`, [
      montoAjustado,
      cuenta.id,
    ]);

    // ✅ Registrar movimiento tipo DEPOSITO (cash-in) con concepto
    await pool.query(
      `INSERT INTO transacciones
        (id, tipo, monto, cuenta_origen_id, cuenta_destino_id, concepto, fecha_creacion)
       VALUES (?, 'DEPOSITO', ?, NULL, ?, ?, NOW())`,
      [randomUUID(), montoAjustado, cuenta.id, "Depósito (cash-in)"]
    );

    const [rowsFinal] = await pool.query(
      `SELECT saldo FROM cuentas WHERE id = ? LIMIT 1`,
      [cuenta.id]
    );

    const saldoFinal = rowsFinal.length ? Number(rowsFinal[0].saldo) : saldoActual;

    return ok(
      res,
      {
        saldo: saldoFinal,
        agregado: montoAjustado,
        monto_solicitado: monto,
        monto_ajustado: montoAjustado,
        saldo_maximo: SALDO_MAXIMO,
      },
      "Dinero agregado correctamente"
    );
  } catch (err) {
    return fail(res, "Error al agregar dinero", 500, err);
  }
}

/**
 * POST /account/depositar (opcional)
 */
export async function depositar(req, res) {
  try {
    const monto = Number(req.body?.monto);

    if (!Number.isFinite(monto) || monto <= 0) {
      return fail(res, "Monto inválido (debe ser > 0)", 400);
    }

    const cuenta = await getCuentaDelUsuario(req.userId);
    if (!cuenta) return fail(res, "Cuenta no encontrada", 404);

    if (Number(cuenta.saldo) + monto > SALDO_MAXIMO) {
      return fail(
        res,
        `No puedes exceder el saldo máximo (${SALDO_MAXIMO} pokemonedas)`,
        400
      );
    }

    await pool.query(`UPDATE cuentas SET saldo = saldo + ? WHERE id = ?`, [
      monto,
      cuenta.id,
    ]);

    // Registrar movimiento tipo DEPOSITO con concepto
    await pool.query(
      `INSERT INTO transacciones
        (id, tipo, monto, cuenta_origen_id, cuenta_destino_id, concepto, fecha_creacion)
       VALUES (?, 'DEPOSITO', ?, NULL, ?, ?, NOW())`,
      [randomUUID(), monto, cuenta.id, "Depósito"]
    );

    const [rowsFinal] = await pool.query(
      `SELECT saldo FROM cuentas WHERE id = ? LIMIT 1`,
      [cuenta.id]
    );

    return ok(res, { saldo: Number(rowsFinal[0].saldo) }, "Depósito realizado");
  } catch (err) {
    return fail(res, "Error al realizar el depósito", 500, err);
  }
}

/**
 * GET /account/movimientos?page=1&limit=5
 */
export async function movimientos(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10)));
    const offset = (page - 1) * limit;

    const cuenta = await getCuentaDelUsuario(req.userId);
    if (!cuenta) return fail(res, "Cuenta no encontrada", 404);

    const [totalRows] = await pool.query(
      `SELECT COUNT(*) as total
       FROM transacciones t
       WHERE t.cuenta_origen_id = ? OR t.cuenta_destino_id = ?`,
      [cuenta.id, cuenta.id]
    );

    const total = Number(totalRows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // ✅ NUEVO: traer t.concepto
    const [rows] = await pool.query(
      `SELECT
         t.id,
         t.tipo,
         t.monto,
         t.cuenta_origen_id,
         t.cuenta_destino_id,
         t.concepto,
         t.fecha_creacion
       FROM transacciones t
       WHERE t.cuenta_origen_id = ? OR t.cuenta_destino_id = ?
       ORDER BY t.fecha_creacion DESC
       LIMIT ? OFFSET ?`,
      [cuenta.id, cuenta.id, limit, offset]
    );

    const movimientos = [];

    for (const r of rows) {
      const esEntrada =
        r.tipo === "DEPOSITO"
          ? true
          : String(r.tipo).includes("ENTRADA")
          ? true
          : false;

      const direccion = esEntrada ? "ENTRADA" : "SALIDA";
      const monto = Number(r.monto);
      const monto_signed = esEntrada ? monto : -monto;

      let contraparte = { alias: null, correo: null, numero_cuenta: null };
      let cuenta_contraparte_id = null;

      if (r.tipo === "DEPOSITO") {
        contraparte = { alias: "Efectivo", correo: null, numero_cuenta: null };
      } else {
        // Si es salida, contraparte es destino; si es entrada, contraparte es origen
        cuenta_contraparte_id = esEntrada ? r.cuenta_origen_id : r.cuenta_destino_id;

        if (cuenta_contraparte_id) {
          const [cp] = await pool.query(
            `SELECT u.correo, u.numero_cuenta
             FROM cuentas c
             JOIN usuarios u ON u.id = c.usuario_id
             WHERE c.id = ?
             LIMIT 1`,
            [cuenta_contraparte_id]
          );

          const [aliasRows] = await pool.query(
            `SELECT b.alias
             FROM beneficiarios b
             WHERE b.usuario_propietario_id = ?
               AND b.usuario_beneficiario_id = (
                 SELECT c2.usuario_id FROM cuentas c2 WHERE c2.id = ? LIMIT 1
               )
             LIMIT 1`,
            [req.userId, cuenta_contraparte_id]
          );

          contraparte = {
            alias: aliasRows.length ? aliasRows[0].alias : null,
            correo: cp.length ? cp[0].correo : null,
            numero_cuenta: cp.length ? cp[0].numero_cuenta : null,
          };
        }
      }

      // ✅ Concepto REAL (si existe en DB). Si viene null/vacío, usa default.
      const conceptoDB = (r.concepto ?? "").toString().trim();
      const conceptoFallback =
        r.tipo === "DEPOSITO"
          ? "Depósito"
          : r.tipo === "TRANSFERENCIA_SALIDA"
          ? "Transferencia enviada"
          : r.tipo === "TRANSFERENCIA_ENTRADA"
          ? "Transferencia recibida"
          : "Movimiento";

      movimientos.push({
        id: r.id,
        fecha: r.fecha_creacion,
        tipo: r.tipo,
        concepto: conceptoDB || conceptoFallback,
        direccion,
        monto,
        monto_signed,
        contraparte,
        meta: {
          cuenta_origen_id: r.cuenta_origen_id,
          cuenta_destino_id: r.cuenta_destino_id,
          cuenta_contraparte_id,
        },
      });
    }

    return ok(res, { page, limit, total, totalPages, movimientos }, "Movimientos obtenidos");
  } catch (err) {
    return fail(res, "Error al obtener movimientos", 500, err);
  }
}
