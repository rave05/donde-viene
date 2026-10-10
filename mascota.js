/* Juego opcional y local: no solicita ubicación ni envía datos. */
(() => {
  "use strict";
  const panel = document.getElementById("mascotaBus");
  if (!panel) return;
  const KEY = "donde-viene-mascota-v1";
  const $ = (id) => document.getElementById(id);
  const colors = { amarillo: 0, celeste: 3, coral: 7 };
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  function day() {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  function ordinal(value) {
    if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value))
      return NaN;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
      ? Math.floor(date.getTime() / 86400000)
      : NaN;
  }
  const empty = () => ({
    v: 1,
    active: false,
    lastDay: null,
    streak: 0,
    best: 0,
    total: 0,
    color: "amarillo",
  });
  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || raw.length > 1024) return empty();
      const s = JSON.parse(raw);
      if (
        s.v !== 1 ||
        typeof s.active !== "boolean" ||
        !Object.hasOwn(colors, s.color) ||
        ![s.streak, s.best, s.total].every(
          (n) => Number.isSafeInteger(n) && n >= 0 && n <= 40000,
        ) ||
        s.streak > s.best ||
        s.best > s.total ||
        s.total < colors[s.color] ||
        (s.total === 0
          ? s.lastDay !== null || s.streak !== 0 || s.best !== 0
          : !Number.isFinite(ordinal(s.lastDay)) || s.streak < 1)
      )
        return empty();
      return {
        v: 1,
        active: s.active,
        lastDay: s.lastDay,
        streak: s.streak,
        best: s.best,
        total: s.total,
        color: s.color,
      };
    } catch {
      return empty();
    }
  }
  let state = read(),
    memoryOnly = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      memoryOnly = false;
    } catch {
      memoryOnly = true;
    }
  }
  function message(text) {
    $("mascotaMensaje").textContent =
      text +
      (memoryOnly
        ? " El navegador no pudo guardar el progreso; se conserva solo mientras esta página esté abierta."
        : "");
  }
  function render() {
    const gap = state.lastDay
      ? ordinal(day()) - ordinal(state.lastDay)
      : Infinity;
    const current = gap <= 1 ? state.streak : 0;
    $("mascotaResumen").textContent = state.active
      ? `Tu bus · ${current} ${current === 1 ? "día" : "días"} de racha`
      : "Tu bus · una racha para jugar";
    $("mascotaRacha").textContent = String(current);
    $("mascotaTotal").textContent = String(state.total);
    $("mascotaRecord").textContent = String(state.best);
    $("mascotaJugar").hidden = state.active;
    $("mascotaCuidar").hidden = !state.active;
    $("mascotaPausar").hidden = !state.active;
    $("mascotaCuidar").textContent =
      gap === 0 ? "Energía de hoy cargada ✓" : "Cargar energía de hoy";
    panel.dataset.color = state.color;
    for (const button of panel.querySelectorAll("[data-mascota-color]")) {
      const color = button.dataset.mascotaColor;
      button.disabled = state.total < colors[color];
      button.setAttribute("aria-pressed", String(state.color === color));
    }
    $("mascotaPremio").textContent =
      state.total < 3
        ? `Celeste: ${3 - state.total} ${3 - state.total === 1 ? "día más" : "días más"} de cuidado.`
        : state.total < 7
          ? `¡Celeste desbloqueado! Coral: ${7 - state.total} ${7 - state.total === 1 ? "día más" : "días más"}.`
          : "¡Desbloqueaste todos los colores! Tus premios se conservan aunque cortes la racha.";
  }
  function care() {
    if (!memoryOnly) state = read();
    const today = day(),
      gap = state.lastDay ? ordinal(today) - ordinal(state.lastDay) : Infinity;
    if (gap < 0) {
      render();
      message(
        "La fecha del dispositivo es anterior al último día guardado. Revisá el reloj para continuar.",
      );
      return;
    }
    state.active = true;
    if (gap === 0) {
      save();
      render();
      message(
        "Tu bus ya tiene la energía de hoy. Podés seguir usando la app cuando la necesites.",
      );
      return;
    }
    state.streak = gap === 1 ? state.streak + 1 : 1;
    state.best = Math.max(state.best, state.streak);
    state.total = Math.min(40000, state.total + 1);
    state.lastDay = today;
    save();
    render();
    message(
      gap > 1 && Number.isFinite(gap)
        ? "¡Bienvenido de vuelta! Empezaste una nueva racha y conservás tus colores."
        : "¡Energía cargada! Sumaste un día de cuidado.",
    );
  }
  $("mascotaJugar").addEventListener("click", care);
  $("mascotaCuidar").addEventListener("click", care);
  $("mascotaPausar").addEventListener("click", () => {
    if (!memoryOnly) state = read();
    state.active = false;
    save();
    render();
    panel.open = false;
    message(
      "Mascota pausada. Podés volver a jugar cuando quieras; tus colores se conservan.",
    );
  });
  for (const button of panel.querySelectorAll("[data-mascota-color]"))
    button.addEventListener("click", () => {
      if (!memoryOnly) state = read();
      const color = button.dataset.mascotaColor;
      if (state.total < colors[color]) return;
      state.color = color;
      save();
      render();
      message("Color de tu bus actualizado.");
    });
  $("mascotaBorrar").addEventListener("click", () => {
    $("mascotaConfirmarBorrar").hidden = false;
    $("mascotaCancelarBorrar").hidden = false;
    message("¿Borrar la racha y los colores de este navegador?");
  });
  $("mascotaCancelarBorrar").addEventListener("click", () => {
    hideDelete();
    message("Se conserva tu progreso.");
  });
  function hideDelete() {
    $("mascotaConfirmarBorrar").hidden = true;
    $("mascotaCancelarBorrar").hidden = true;
  }
  $("mascotaConfirmarBorrar").addEventListener("click", () => {
    state = empty();
    save();
    render();
    hideDelete();
    message("Progreso borrado. Podés empezar de nuevo cuando quieras.");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === KEY || event.key === null) {
      state = read();
      memoryOnly = false;
      render();
      message("Progreso actualizado desde otra pestaña.");
    }
  });
  window.addEventListener("focus", render);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });
  panel.addEventListener("toggle", render);
  render();
})();
