/* Presentación flotante de la mascota; independiente del progreso del juego. */
(() => {
  "use strict";
  const panel = document.getElementById("mascotaBus");
  if (
    !panel ||
    typeof HTMLDialogElement === "undefined" ||
    typeof HTMLDialogElement.prototype.showModal !== "function"
  )
    return;
  const KEY = "donde-viene-mascota-posicion-v1";
  const button = document.createElement("button");
  button.id = "mascotaFlotante";
  button.className = "bus-pet-float";
  button.type = "button";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "mascotaPopup");
  button.title = "Tocá para cuidar a Ruti. Arrastrá para moverlo.";
  const art = panel.querySelector(".bus-pet-art").cloneNode(true);
  art.setAttribute("viewBox", "28 8 184 150");
  art.setAttribute("aria-hidden", "true");
  art.removeAttribute("aria-labelledby");
  art.removeAttribute("role");
  art.querySelector("title")?.remove();
  button.append(art);
  const popup = document.createElement("dialog");
  popup.id = "mascotaPopup";
  popup.className = "bus-pet-modal";
  popup.setAttribute("aria-labelledby", "mascotaResumen");
  const heading = document.createElement("div");
  heading.className = "bus-pet-modal-heading";
  const title = document.createElement("strong");
  title.textContent = "Ruti";
  const close = document.createElement("button");
  close.type = "button";
  close.id = "cerrarMascotaPopup";
  close.setAttribute("aria-label", "Cerrar mascota");
  close.textContent = "×";
  heading.append(title, close);
  popup.append(heading, panel);
  panel.open = true;
  document.body.append(button, popup);
  let position = { x: 1, y: 0.6 },
    drag = null,
    suppressClick = false,
    previousOverflow = "";
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw.length < 200) {
      const saved = JSON.parse(raw);
      if (
        saved &&
        [saved.x, saved.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
      )
        position = { x: saved.x, y: saved.y };
    }
  } catch {
    /* La mascota sigue funcionando sin almacenamiento. */
  }
  function bounds() {
    const viewport = window.visualViewport;
    const style = getComputedStyle(button);
    const left = (viewport?.offsetLeft || 0) + 12;
    const top =
      (viewport?.offsetTop || 0) +
      12 +
      (parseFloat(style.getPropertyValue("--pet-safe-top")) || 0);
    return {
      left,
      top,
      right: Math.max(
        left,
        (viewport?.offsetLeft || 0) +
          (viewport?.width || window.innerWidth) -
          (button.offsetWidth || 80) -
          12,
      ),
      bottom: Math.max(
        top,
        (viewport?.offsetTop || 0) +
          (viewport?.height || window.innerHeight) -
          (button.offsetHeight || 76) -
          12 -
          (parseFloat(style.getPropertyValue("--pet-safe-bottom")) || 0),
      ),
    };
  }
  function place(x, y) {
    const b = bounds();
    const left = Math.max(b.left, Math.min(b.right, x));
    const top = Math.max(b.top, Math.min(b.bottom, y));
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
    position = {
      x: b.right === b.left ? 0 : (left - b.left) / (b.right - b.left),
      y: b.bottom === b.top ? 0 : (top - b.top) / (b.bottom - b.top),
    };
  }
  function fit() {
    const b = bounds();
    place(
      b.left + position.x * (b.right - b.left),
      b.top + position.y * (b.bottom - b.top),
    );
  }
  function remember() {
    try {
      localStorage.setItem(KEY, JSON.stringify(position));
    } catch {}
  }
  function update() {
    button.dataset.color = panel.dataset.color;
    button.setAttribute(
      "aria-label",
      `${document.getElementById("mascotaResumen").textContent}. Abrir mascota`,
    );
  }
  function shut() {
    if (popup.open) popup.close();
  }
  button.addEventListener("click", (event) => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      return;
    }
    suppressClick = false;
    if (popup.open) return;
    panel.open = true;
    previousOverflow = document.documentElement.style.overflow;
    popup.showModal();
    window.dispatchEvent(new Event("donde-viene:mascota-abierta"));
    document.documentElement.style.overflow = "hidden";
    button.setAttribute("aria-expanded", "true");
    close.focus();
  });
  close.addEventListener("click", shut);
  popup.addEventListener("close", () => {
    document.documentElement.style.overflow = previousOverflow;
    button.setAttribute("aria-expanded", "false");
    button.focus({ preventScroll: true });
  });
  popup.addEventListener("click", (event) => {
    const r = popup.getBoundingClientRect();
    if (
      event.target === popup &&
      (event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom)
    )
      shut();
  });
  button.addEventListener("pointerdown", (event) => {
    if (
      event.isPrimary === false ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    suppressClick = false;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: parseFloat(button.style.left),
      top: parseFloat(button.style.top),
      moved: false,
    };
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
  });
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      button.classList.add("is-dragging");
      event.preventDefault();
      place(drag.left + dx, drag.top + dy);
    },
    { passive: false },
  );
  function end(event) {
    if (!drag || drag.id !== event.pointerId) return;
    suppressClick = drag.moved || event.type === "pointercancel";
    if (drag.moved) remember();
    try {
      button.releasePointerCapture(event.pointerId);
    } catch {}
    drag = null;
    button.classList.remove("is-dragging");
  }
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
  window.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("resize", fit);
  window.visualViewport?.addEventListener("scroll", fit);
  window.addEventListener("donde-viene:mascota-actualizada", update);
  window.addEventListener("donde-viene:mascota-pausa", shut);
  window.addEventListener("pagehide", () => {
    drag = null;
    button.classList.remove("is-dragging");
    shut();
  });
  update();
  fit();
})();
