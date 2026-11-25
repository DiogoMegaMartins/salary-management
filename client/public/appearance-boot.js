/* Aplica a cor e o modo guardados no aparelho antes do primeiro desenho, para a app não piscar.
   Ficheiro à parte porque a política de segurança não permite scripts dentro do HTML.
   A mesma lógica está em shared/appearance.ts (readAppearanceCache). */
(function () {
  var P = ["ceu", "salvia", "pessego", "lavanda", "mare"], M = ["auto", "claro", "escuro"];
  var palette = "ceu", mode = "auto";
  try {
    var raw = localStorage.getItem("sm.appearance");
    if (raw) {
      var v = JSON.parse(raw);
      if (v && P.indexOf(v.palette) >= 0) palette = v.palette;
      if (v && M.indexOf(v.mode) >= 0) mode = v.mode;
    } else {
      var t = localStorage.getItem("sm.theme");
      if (t === "dark") mode = "escuro"; else if (t === "light") mode = "claro";
    }
  } catch (e) { /* sem armazenamento ou cache estragada: usa os defeitos */ }
  var dark = mode === "auto" ? !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) : mode === "escuro";
  var el = document.documentElement;
  el.setAttribute("data-palette", palette);
  if (dark) el.classList.add("dark"); else el.classList.remove("dark");
})();
