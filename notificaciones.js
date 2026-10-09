/* Suscripción explícita, reversible y sin GPS, destino ni historial de búsquedas. */
(() => {
  const DV = window.DV,
    panel = document.createElement("details");
  panel.className = "extras-block";
  panel.innerHTML =
    '<summary>🔔 Avisos y recordatorios</summary><p class="extras-note">Elegí líneas para avisos de servicio. El recordatorio solo te invita a consultar tu viaje; no confirma la llegada de un bus. No compartimos tu ubicación ni tus destinos.</p><div class="extras-row"><label for="lineasAvisos">Líneas (separadas por coma)</label><input id="lineasAvisos" maxlength="120" placeholder="127, 185"><label><input id="usarRecordatorio" type="checkbox"> Recordarme de lunes a viernes</label><label for="horaRecordatorio">Hora (Montevideo)</label><input id="horaRecordatorio" type="time" value="07:30"></div><div class="extras-row"><button id="activarAvisos" class="extras-button" type="button" disabled>Activar o actualizar avisos</button><button id="desactivarAvisos" class="extras-button" type="button" disabled>Desactivar avisos</button></div><p id="estadoAvisos" class="extras-status" role="status"></p>';
  document.querySelector(".trip-preference").after(panel);
  const activar = panel.querySelector("#activarAvisos"),
    desactivar = panel.querySelector("#desactivarAvisos"),
    estado = panel.querySelector("#estadoAvisos");
  const KEY = "dv-avisos-v1";
  let config,
    ocupado = false;
  function preferencias() {
    const s = DV.leer(KEY, null);
    return s &&
      /^[a-f0-9]{64}$/.test(s.token || "") &&
      Array.isArray(s.lineas) &&
      s.lineas.length <= 12
      ? s
      : null;
  }
  const compatible = () =>
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  async function preparar() {
    config = await DV.servicios.config();
    desactivar.disabled = !preferencias();
    activar.disabled = !config.push || !compatible();
    estado.textContent = !config.push
      ? "Los avisos en segundo plano todavía no están disponibles. Podés consultar los avisos dentro de la app."
      : !compatible()
        ? "En iPhone: agregá la app a la pantalla de inicio desde Compartir en Safari y abrila desde su icono. Requiere iOS 16.4 o posterior."
        : Notification.permission === "denied"
          ? "Los avisos están bloqueados. Podés cambiar el permiso en los ajustes del dispositivo."
          : "Solo pediremos permiso cuando toques Activar.";
  }
  panel.addEventListener("toggle", () => {
    if (panel.open) preparar();
  });
  function clave(s) {
    return Uint8Array.from(
      atob(s.replace(/-/g, "+").replace(/_/g, "/")),
      (ch) => ch.charCodeAt(0),
    );
  }
  async function registro() {
    if (!(await navigator.serviceWorker.getRegistration()))
      throw Error(
        "La app todavía se está preparando. Cerrala y volvé a abrirla con conexión.",
      );
    return await navigator.serviceWorker.ready;
  }
  async function enviar(path, body) {
    const control = new AbortController(),
      timer = setTimeout(() => control.abort(), 10000);
    try {
      const r = await fetch(config.url + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: control.signal,
      });
      if (!r.ok)
        throw Error("El servicio no pudo guardar el cambio. Reintentá.");
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }
  activar.addEventListener("click", async () => {
    if (ocupado || !config?.push || !compatible()) return;
    const lineas = panel
      .querySelector("#lineasAvisos")
      .value.split(",")
      .map((x) => x.trim().toUpperCase())
      .filter(Boolean);
    const recordar = panel.querySelector("#usarRecordatorio").checked,
      hora = panel.querySelector("#horaRecordatorio").value;
    if (
      lineas.length > 12 ||
      lineas.some((x) => !/^[A-Z]{0,2}\d{1,3}[A-Z]?$/.test(x)) ||
      (!lineas.length && !recordar) ||
      (recordar && !/^\d{2}:\d{2}$/.test(hora))
    ) {
      estado.textContent =
        "Elegí hasta 12 líneas válidas o un recordatorio con hora.";
      return;
    }
    ocupado = true;
    activar.disabled = true;
    let nueva = null;
    try {
      // Permiso iniciado directamente por el toque, especialmente en iOS.
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted")
        throw Error("No se activaron los avisos: falta permiso.");
      const reg = await registro();
      const previa = await reg.pushManager.getSubscription();
      const sub =
        previa ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: clave(config.vapidPublicKey),
        }));
      if (!previa) nueva = sub;
      const anterior = preferencias();
      const resultado = await enviar("/subscriptions", {
        subscription: sub.toJSON(),
        lineas,
        recordatorio: recordar ? { dias: [1, 2, 3, 4, 5], hora } : null,
        token: anterior?.token || null,
      });
      if (
        !DV.guardar(KEY, { token: resultado.token, lineas, recordar, hora })
      ) {
        await enviar("/unsubscribe", { token: resultado.token });
        await sub.unsubscribe();
        throw Error(
          "No pudimos guardar tus preferencias. No quedaron avisos activos.",
        );
      }
      estado.textContent =
        "Avisos activados. Los recordatorios pueden llegar con demora según conexión y ajustes del teléfono.";
      desactivar.disabled = false;
    } catch (e) {
      if (nueva) await nueva.unsubscribe().catch(() => {});
      estado.textContent = e.message || "No pudimos activar los avisos.";
    } finally {
      ocupado = false;
      activar.disabled = !config.push;
    }
  });
  desactivar.addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    desactivar.disabled = true;
    try {
      const saved = preferencias();
      if (!config?.url)
        throw Error(
          "No pudimos contactar al servicio. Podés bloquear las notificaciones desde los ajustes del dispositivo.",
        );
      await enviar("/unsubscribe", { token: saved?.token });
      const reg = await navigator.serviceWorker.getRegistration();
      await (await reg?.pushManager.getSubscription())?.unsubscribe();
      DV.guardar(KEY, null);
      estado.textContent = "Avisos desactivados.";
    } catch (e) {
      estado.textContent = e.message;
      desactivar.disabled = false;
    } finally {
      ocupado = false;
    }
  });
  const saved = preferencias();
  if (saved) {
    panel.querySelector("#lineasAvisos").value = saved.lineas.join(", ");
    panel.querySelector("#usarRecordatorio").checked = saved.recordar;
    panel.querySelector("#horaRecordatorio").value = saved.hora;
  }
})();
