/* Estadísticas opcionales. Activar después de desactivar Medición mejorada en GA4. */
(() => {
  "use strict";
  const MEDICION_MEJORADA_DESACTIVADA = true;
  if (!MEDICION_MEJORADA_DESACTIVADA) return;
  const ID = "G-N6QV8RK6JC";
  const KEY = "donde-viene-estadisticas-v1";
  const disable = `ga-disable-${ID}`;
  const pages = {
    "index.html": "DondeViene",
    "ayuda.html": "Guía de uso · DondeViene",
    "acerca.html": "Acerca de DondeViene",
    "privacidad.html": "Privacidad · DondeViene",
  };
  const file = location.pathname.split("/").pop() || "index.html";
  const name = Object.hasOwn(pages, file) ? file : "index.html";
  const base = new URL("./", location.href);
  const cleanPage =
    base.origin + base.pathname + (name === "index.html" ? "" : name);
  let cleanReferrer = "";
  try {
    const u = new URL(document.referrer);
    if (["http:", "https:"].includes(u.protocol))
      cleanReferrer = u.origin + "/";
  } catch {}
  const context = {
    page_location: cleanPage,
    page_referrer: cleanReferrer,
    page_title: pages[name],
  };
  let choice = null,
    requested = false,
    loaded = false,
    pageSent = false,
    memoryOnly = false,
    script = null,
    opener = null;
  function read() {
    try {
      const v = localStorage.getItem(KEY);
      return v === "si" || v === "no" ? v : null;
    } catch {
      return null;
    }
  }
  choice = read();
  window[disable] = choice !== "si";
  const style = document.createElement("style");
  style.textContent =
    ".dv-stats-notice{position:fixed;z-index:1600;bottom:max(12px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:min(560px,calc(100% - 24px));box-sizing:border-box;padding:18px;border:1px solid #d3deec;border-radius:20px;background:#fff;color:#172b46;box-shadow:0 8px 40px #172b4630;font:14px/1.5 system-ui,sans-serif}.dv-stats-notice[hidden]{display:none}.dv-stats-notice p{margin:6px 0 12px}.dv-stats-actions{display:flex;flex-wrap:wrap;gap:10px}.dv-stats-actions button{flex:1;min-height:44px;padding:10px 14px;border:1px solid #b9cbe1;border-radius:12px;background:#fff;color:#172b46;font:inherit;cursor:pointer}.dv-stats-actions button:focus-visible,.dv-stats-preferences:focus-visible{outline:3px solid #1668c1;outline-offset:3px}.dv-stats-preferences{border:0;padding:8px;background:transparent;color:inherit;text-decoration:underline;font:inherit;cursor:pointer}.dv-stats-status{font-size:12px;margin-top:8px}";
  document.head.append(style);
  const notice = document.createElement("aside");
  notice.className = "dv-stats-notice";
  notice.id = "preferenciasEstadisticas";
  notice.setAttribute("aria-label", "Estadísticas opcionales");
  const title = document.createElement("strong");
  title.textContent = "Ayudanos a mejorar DondeViene";
  const explanation = document.createElement("p");
  explanation.textContent =
    "¿Permitís estadísticas de visitas y uso con Google Analytics? No incluimos direcciones ni coordenadas de tus viajes. Podés usar toda la app aunque rechaces.";
  const link = document.createElement("a");
  link.href = "./privacidad.html#estadisticas";
  link.textContent = "Cómo usamos estos datos";
  const actions = document.createElement("div");
  actions.className = "dv-stats-actions";
  const accept = document.createElement("button");
  accept.type = "button";
  accept.id = "aceptarEstadisticas";
  accept.textContent = "Permitir estadísticas";
  const reject = document.createElement("button");
  reject.type = "button";
  reject.id = "rechazarEstadisticas";
  reject.textContent = "Rechazar";
  const status = document.createElement("p");
  status.className = "dv-stats-status";
  status.setAttribute("role", "status");
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Cerrar este aviso";
  dismiss.hidden = true;
  dismiss.addEventListener("click", () => {
    notice.hidden = true;
  });
  actions.append(accept, reject);
  notice.append(title, explanation, link, actions, status, dismiss);
  const preferences = document.createElement("button");
  preferences.type = "button";
  preferences.id = "abrirEstadisticas";
  preferences.className = "dv-stats-preferences";
  preferences.textContent = "Preferencias de estadísticas";
  (
    document.querySelector("footer nav") ||
    document.querySelector("footer") ||
    document.body
  ).append(preferences);
  document.body.append(notice);
  notice.hidden = choice !== null;
  function gtag() {
    window.dataLayer.push(arguments);
  }
  function clearCookies() {
    for (const entry of document.cookie.split(";")) {
      const key = entry.trim().split("=")[0];
      if (/^dv_ga(?:_|$)/.test(key))
        document.cookie = `${key}=; Max-Age=0; Path=${base.pathname}; SameSite=Lax; Secure`;
    }
  }
  function send(event) {
    if (choice !== "si" || !loaded || window[disable]) return;
    gtag("event", event, { ...context, send_to: ID });
  }
  function pageView() {
    if (!pageSent && choice === "si" && loaded) {
      pageSent = true;
      send("page_view");
    }
  }
  function load() {
    window[disable] = false;
    if (requested) {
      if (window.dataLayer)
        gtag("consent", "update", { analytics_storage: "granted" });
      pageView();
      return;
    }
    requested = true;
    window.dataLayer = window.dataLayer || [];
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });
    gtag("set", {
      ...context,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ads_data_redaction: true,
      url_passthrough: false,
    });
    gtag("js", new Date());
    gtag("config", ID, {
      ...context,
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_prefix: "dv",
      cookie_domain: "none",
      cookie_path: base.pathname,
      cookie_expires: 7776000,
    });
    script = document.createElement("script");
    script.id = "etiquetaEstadisticas";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ID}`;
    script.addEventListener("load", () => {
      loaded = true;
      pageView();
    });
    script.addEventListener("error", () => {
      requested = false;
      loaded = false;
      script.remove();
    });
    document.head.append(script);
  }
  function apply() {
    window[disable] = choice !== "si";
    if (choice === "si") load();
    else {
      if (requested && window.dataLayer)
        gtag("consent", "update", { analytics_storage: "denied" });
      clearCookies();
    }
  }
  function choose(value) {
    choice = value;
    try {
      localStorage.setItem(KEY, value);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
    }
    apply();
    status.textContent = memoryOnly
      ? "No pudimos guardar tu elección. Se aplicará mientras esta página esté abierta."
      : "";
    notice.hidden = !memoryOnly;
    dismiss.hidden = !memoryOnly;
    if (notice.hidden) opener?.focus({ preventScroll: true });
  }
  accept.addEventListener("click", () => choose("si"));
  reject.addEventListener("click", () => choose("no"));
  preferences.addEventListener("click", () => {
    opener = preferences;
    notice.hidden = false;
    status.textContent =
      choice === "si"
        ? "Estadísticas permitidas. Podés retirarlas con Rechazar."
        : choice === "no"
          ? "Estadísticas rechazadas. Podés cambiar tu elección."
          : "";
    accept.focus({ preventScroll: true });
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) {
      choice = read();
      memoryOnly = false;
      apply();
      notice.hidden = choice !== null;
    }
  });
  for (const [source, event] of [
    ["donde-viene:busqueda-iniciada", "buscar_ruta"],
    ["donde-viene:viaje-iniciado", "iniciar_viaje"],
    ["donde-viene:mascota-cuidada", "cuidar_ruti"],
    ["donde-viene:mascota-abierta", "abrir_ruti"],
    ["donde-viene:app-compartida", "compartir_app"],
    ["donde-viene:enlace-app-copiado", "copiar_enlace_app"],
    ["donde-viene:app-instalada", "instalar_app"],
  ])
    window.addEventListener(source, () => send(event));
  if (choice === "si") load();
})();
