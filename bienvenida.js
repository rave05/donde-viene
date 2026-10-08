/* Ayuda inicial no modal. El usuario puede reabrirla sin reiniciar su viaje. */
(() => {
  const panel = document.getElementById("bienvenida");
  if (!panel) return;
  const clave = "donde-viene-bienvenida-v1";
  panel.open = !window.DV.leer(clave, false);
  panel.addEventListener("toggle", () => {
    if (!panel.open) window.DV.guardar(clave, true);
  });
  document.getElementById("cerrarBienvenida").addEventListener("click", () => {
    panel.open = false;
    window.DV.guardar(clave, true);
    panel.querySelector("summary").focus();
  });
})();
