const API_BASE = "http://localhost:4000";

const $ = (id) => document.getElementById(id);
const setText = (el, txt = "", err = false) => {
  el.textContent = txt || "";
  el.style.color = err ? "#ffd54a" : "";
};
const money = (n) => (Number(n) || 0).toLocaleString("es-MX");

const el = {
  auth: $("screenAuth"),
  app: $("screenApp"),

  loginPanel: $("loginPanel"),
  registerPanel: $("registerPanel"),
  linkToRegister: $("linkToRegister"),
  linkToLogin: $("linkToLogin"),

  loginCorreo: $("loginCorreo"),
  loginPass: $("loginPass"),
  loginMsg: $("loginMsg"),
  regNombre: $("regNombre"),
  regCorreo: $("regCorreo"),
  regPass: $("regPass"),
  regMsg: $("regMsg"),

  timer: $("timer"),
  btnLogout: $("btnLogout"),

  numeroCuenta: $("numeroCuenta"),
  saldo: $("saldo"),

  // cash-in
  cashMonto: $("cashMonto"),
  cashMsg: $("cashMsg"),

  // transfer
  txDestino: $("txDestino"),
  txMonto: $("txMonto"),
  txGuardar: $("txGuardar"),
  txAlias: $("txAlias"),
  txConcepto: $("txConcepto"),
  txMsg: $("txMsg"),

  // favoritos
  benefList: $("benefList"),
  benefMsg: $("benefMsg"),

  // movimientos
  movList: $("movList"),
  movMsg: $("movMsg"),
  pageInfo: $("pageInfo"),

  // modal transfer
  modalOverlay: $("modalOverlay"),
  modalText: $("modalText"),
  btnModalCancel: $("btnModalCancel"),
  btnModalOk: $("btnModalOk"),
};

// estado
const state = {
  movPage: 1,
  movTotalPages: 1,
  movLimit: 8,
  timerInterval: null,
  pendingTransfer: null,
};

// token y expiración
const session = {
  get token() {
    return localStorage.getItem("token") || "";
  },
  set token(v) {
    if (!v) localStorage.removeItem("token");
    else localStorage.setItem("token", v);
  },
  get expiresAt() {
    const ms = Number(localStorage.getItem("session_expires_at") || 0);
    return Number.isFinite(ms) ? ms : 0;
  },
  set expiresAt(ms) {
    if (!ms) localStorage.removeItem("session_expires_at");
    else localStorage.setItem("session_expires_at", String(ms));
  },
};

// API helper
async function api(path, { method = "GET", body = null, auth = true } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  // Intentar leer JSON, si no hay, no truena
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  // Si expira sesión en endpoints protegidos
  if (res.status === 401 && auth) {
    logout(true);
    throw data;
  }

  if (!res.ok) throw data;
  return data;
}

// Reloj (timer) 10 min
function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  el.timer.textContent = "--:--";
}

function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    const exp = session.expiresAt;
    if (!exp) return (el.timer.textContent = "--:--");

    const diff = exp - Date.now();
    if (diff <= 0) {
      el.timer.textContent = "00:00";
      logout(true);
      return;
    }

    const sec = Math.floor(diff / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    el.timer.textContent = `${mm}:${ss}`;
  }, 250);
}

function setExpiryFromLoginResponse(r) {
  const expires_at = r?.data?.expires_at;
  if (expires_at) {
    const ms = Date.parse(expires_at);
    if (!Number.isNaN(ms)) return (session.expiresAt = ms);
  }
  session.expiresAt = Date.now() + 10 * 60 * 1000;
}

// Login/Registro
function showLoginPanel() {
  el.loginPanel.style.display = "block";
  el.registerPanel.style.display = "none";
  setText(el.regMsg, "");
}
function showRegisterPanel() {
  el.loginPanel.style.display = "none";
  el.registerPanel.style.display = "block";
  setText(el.loginMsg, "");
}

// UI navegación
function showAuth() {
  el.app.style.display = "none";
  el.auth.style.display = "block";
  el.btnLogout.style.display = "none";
  showLoginPanel();
}
function showApp() {
  el.auth.style.display = "none";
  el.app.style.display = "block";
  el.btnLogout.style.display = "inline-block";
}

function logout(expired = false) {
  session.token = "";
  session.expiresAt = 0;
  stopTimer();
  showAuth();
  if (expired) alert("Tu sesión expiró (10 minutos). Vuelve a iniciar sesión.");
}

// modal confirmación
function openTransferModal({ destino_numero_cuenta, monto, guardar_beneficiario, alias, concepto }) {
  state.pendingTransfer = { destino_numero_cuenta, monto, guardar_beneficiario, alias, concepto };

  const conceptoLine = concepto ? `\nConcepto: ${concepto}` : "";

  el.modalText.textContent =
    `¿Desea realizar la transferencia?\n\n` +
    `Destino: ${destino_numero_cuenta}\n` +
    `Monto: ${money(monto)}\n` +
    (guardar_beneficiario ? `Guardar favorito: Sí (${alias || ""})` : `Guardar favorito: No`) +
    conceptoLine;

  el.modalOverlay.style.display = "flex";
}

function closeTransferModal() {
  el.modalOverlay.style.display = "none";
  state.pendingTransfer = null;
}

// favoritos
async function borrarFavorito(id) {
  if (!id) return setText(el.benefMsg, "No llegó id del favorito", true);
  if (!confirm("¿Seguro que quieres borrar este favorito?")) return;

  setText(el.benefMsg, "");
  try {
    await api(`/beneficiaries/${id}`, { method: "DELETE" });
    setText(el.benefMsg, "Favorito eliminado");
    await loadBeneficiarios();
  } catch (e) {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.benefMsg, (e.message || "Error al borrar") + (extra ? " | " + extra : ""), true);
    console.error(e);
  }
}

function usarFavorito(b) {
  el.txDestino.value = b?.numero_cuenta || "";
  el.txAlias.value = b?.alias || "";
  el.txGuardar.checked = false;
  setText(el.txMsg, `Favorito seleccionado: ${b?.alias || "(sin alias)"} (${b?.numero_cuenta || ""})`);
}

window.usarFavorito = usarFavorito;
window.borrarFavorito = borrarFavorito;

function renderBeneficiarios(list = []) {
  if (!list.length) {
    el.benefList.innerHTML = `<div class="item"><span class="muted">No hay favoritos</span></div>`;
    return;
  }

  el.benefList.innerHTML = list
    .map((b) => {
      const alias = b.alias || "(sin alias)";
      const correo = b.correo || "";
      const cuenta = b.numero_cuenta || "";
      const id = b.id || "";

      return `
        <div class="item">
          <div class="row" style="justify-content:space-between; gap:12px; align-items:center;">
            <div style="min-width:0;">
              <div class="strong">${alias} <span class="badge">${cuenta}</span></div>
              <div class="muted">${correo}</div>
            </div>

            <div class="row" style="gap:8px; flex-shrink:0;">
              <button class="btn small" type="button"
                onclick='usarFavorito(${JSON.stringify({
                  id,
                  alias: b.alias || "",
                  correo,
                  numero_cuenta: cuenta,
                })})'>Usar</button>

              <button class="btn small danger" type="button"
                onclick="borrarFavorito('${id}')">Borrar</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderMovimientos(list = []) {
  if (!list.length) {
    el.movList.innerHTML = `<div class="item"><span class="muted">Sin movimientos</span></div>`;
    return;
  }

  el.movList.innerHTML = list
    .map((m) => {
      const sign = (m.monto_signed ?? 0) >= 0 ? "+" : "-";
      const fecha = new Date(m.fecha).toLocaleString("es-MX");
      const cp = m.contraparte || {};
      const cpLine =
        m.tipo === "DEPOSITO"
          ? "Efectivo"
          : `${cp.alias ? cp.alias + " · " : ""}${cp.numero_cuenta || ""}${cp.correo ? " · " + cp.correo : ""}`;

      return `
      <div class="item">
        <div class="row" style="justify-content:space-between;">
          <div class="strong">${m.concepto || m.tipo} <span class="badge">${m.direccion || ""}</span></div>
          <div class="strong">${sign}${money(Math.abs(m.monto_signed || 0))}</div>
        </div>
        <div class="muted">${fecha}</div>
        <div class="muted">${cpLine}</div>
      </div>`;
    })
    .join("");
}

// loaders
async function loadMe() {
  const r = await api("/account/me");
  el.numeroCuenta.textContent = r?.data?.usuario?.numero_cuenta || "---";
  el.saldo.textContent = String(r?.data?.cuenta?.saldo ?? 0);
  return r;
}

async function loadBeneficiarios() {
  setText(el.benefMsg, "");
  el.benefList.innerHTML = "";
  const r = await api("/beneficiaries");
  renderBeneficiarios(r?.data?.beneficiarios || []);
}

async function loadMovimientos() {
  setText(el.movMsg, "");
  el.movList.innerHTML = "";

  const r = await api(`/account/movimientos?page=${state.movPage}&limit=${state.movLimit}`);
  state.movTotalPages = r?.data?.totalPages || 1;
  el.pageInfo.textContent = `${state.movPage} / ${state.movTotalPages}`;
  renderMovimientos(r?.data?.movimientos || []);
}

async function enterApp() {
  await loadMe();
  showApp();
  state.movPage = 1;
  await Promise.all([loadMovimientos(), loadBeneficiarios()]);
}

// acciones
async function doLogin() {
  setText(el.loginMsg, "");
  const correo = el.loginCorreo.value.trim();
  const password = el.loginPass.value.trim();
  if (!correo || !password) return setText(el.loginMsg, "Falta correo o password", true);

  const r = await api("/auth/login", {
    method: "POST",
    body: { correo, password },
    auth: false,
  });

  const token = r?.data?.token;
  if (!token) throw { message: "No llegó token en la respuesta del backend", ...r };

  session.token = token;
  setExpiryFromLoginResponse(r);
  startTimer();
  await enterApp();
}

async function doRegister() {
  setText(el.regMsg, "");
  const nombre_completo = el.regNombre.value.trim();
  const correo = el.regCorreo.value.trim();
  const password = el.regPass.value.trim();
  if (!nombre_completo || !correo || !password) return setText(el.regMsg, "Faltan datos", true);

  const r = await api("/auth/register", {
    method: "POST",
    body: { nombre_completo, correo, password },
    auth: false,
  });

  setText(el.regMsg, r.message || "Registro OK");
  showLoginPanel();
  setText(el.loginMsg, "Cuenta creada. Ahora inicia sesión.");
}

async function doCashIn() {
  setText(el.cashMsg, "");
  const monto = Number(el.cashMonto.value);
  if (!Number.isFinite(monto) || monto <= 0) return setText(el.cashMsg, "Monto inválido", true);

  const r = await api("/account/agregar-dinero", { method: "POST", body: { monto } });

  setText(
    el.cashMsg,
    `OK. Solicitado: ${money(r.data.monto_solicitado)} | Ajustado: ${money(r.data.monto_ajustado)} | Saldo: ${money(
      r.data.saldo
    )}`
  );

  await Promise.all([loadMe(), loadMovimientos()]);
}

async function performTransfer(body) {
  const r = await api("/transfers", { method: "POST", body });

  setText(
    el.txMsg,
    `OK. ${r.data.desde} → ${r.data.destino} | Monto: ${money(r.data.monto)} | Guardado: ${r.data.beneficiarioGuardado}`
  );

  await Promise.all([loadMe(), loadMovimientos(), loadBeneficiarios()]);
}

async function doTransferAskConfirm() {
  setText(el.txMsg, "");

  const destino_numero_cuenta = el.txDestino.value.trim();
  const monto = Number(el.txMonto.value);
  const guardar_beneficiario = !!el.txGuardar.checked;
  const alias = el.txAlias.value.trim();
  const concepto = el.txConcepto.value.trim();

  if (!destino_numero_cuenta) return setText(el.txMsg, "Falta cuenta destino", true);
  if (!Number.isFinite(monto) || monto <= 0) return setText(el.txMsg, "Monto inválido", true);
  if (guardar_beneficiario && !alias) return setText(el.txMsg, "Si guardas favorito, pon alias", true);

  openTransferModal({ destino_numero_cuenta, monto, guardar_beneficiario, alias, concepto });
}

// eventos
$("btnLogin").addEventListener("click", () =>
  doLogin().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.loginMsg, (e.message || "Error login") + (extra ? " | " + extra : ""), true);
    console.error("LOGIN ERROR FULL:", e);
  })
);

$("btnRegister").addEventListener("click", () =>
  doRegister().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.regMsg, (e.message || "Error registro") + (extra ? " | " + extra : ""), true);
    console.error("REGISTER ERROR FULL:", e);
  })
);

el.btnLogout.addEventListener("click", () => logout(false));

$("btnCash").addEventListener("click", () =>
  doCashIn().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.cashMsg, (e.message || "Error cash-in") + (extra ? " | " + extra : ""), true);
    console.error(e);
  })
);

$("btnTransfer").addEventListener("click", () =>
  doTransferAskConfirm().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.txMsg, (e.message || "Error transferencia") + (extra ? " | " + extra : ""), true);
    console.error(e);
  })
);

// modal buttons
el.btnModalCancel.addEventListener("click", () => closeTransferModal());
el.btnModalOk.addEventListener("click", async () => {
  const p = state.pendingTransfer;
  if (!p) return closeTransferModal();

  const body = {
    destino_numero_cuenta: p.destino_numero_cuenta,
    monto: p.monto,
    guardar_beneficiario: p.guardar_beneficiario,
  };
  if (p.guardar_beneficiario) body.alias = p.alias;
  if (p.concepto) body.concepto = p.concepto;

  closeTransferModal();

  await performTransfer(body).catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.txMsg, (e.message || "Error transferencia") + (extra ? " | " + extra : ""), true);
    console.error(e);
  });
});

// links del login y register
el.linkToRegister.addEventListener("click", (ev) => {
  ev.preventDefault();
  showRegisterPanel();
});
el.linkToLogin.addEventListener("click", (ev) => {
  ev.preventDefault();
  showLoginPanel();
});

$("btnLoadBenef").addEventListener("click", () =>
  loadBeneficiarios().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.benefMsg, (e.message || "Error favoritos") + (extra ? " | " + extra : ""), true);
    console.error(e);
  })
);

$("btnLoadMov").addEventListener("click", () =>
  loadMovimientos().catch((e) => {
    const extra = e?.debug?.sqlMessage || e?.debug?.message || e?.debug?.code || "";
    setText(el.movMsg, (e.message || "Error movimientos") + (extra ? " | " + extra : ""), true);
    console.error(e);
  })
);

$("btnPrev").addEventListener("click", async () => {
  if (state.movPage <= 1) return;
  state.movPage--;
  await loadMovimientos();
});

$("btnNext").addEventListener("click", async () => {
  if (state.movPage >= state.movTotalPages) return;
  state.movPage++;
  await loadMovimientos();
});

// boot
(function boot() {
  const hasToken = !!session.token;
  const expOk = session.expiresAt && session.expiresAt > Date.now();

  if (hasToken && expOk) {
    startTimer();
    enterApp().catch(() => logout(false));
  } else {
    logout(false);
  }
})();
