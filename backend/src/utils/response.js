// backend/src/utils/response.js

export function ok(res, data = {}, message = "OK", status = 200) {
  return res.status(status).json({
    ok: true,
    message,
    data,
  });
}

export function fail(res, message = "Error", status = 500, debug = null) {
  const payload = {
    ok: false,
    message,
  };

  // Solo muestra debug si SHOW_DEBUG=true en el .env
  const showDebug = String(process.env.SHOW_DEBUG || "").toLowerCase() === "true";

  if (showDebug && debug) {
    payload.debug = {
      message: debug?.message ?? null,
      code: debug?.code ?? null,
      errno: debug?.errno ?? null,
      sqlState: debug?.sqlState ?? null,
      sqlMessage: debug?.sqlMessage ?? null,
    };
  }

  return res.status(status).json(payload);
}
