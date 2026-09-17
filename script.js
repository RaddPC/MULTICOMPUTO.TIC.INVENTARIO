/* ================================================================
   CONFIGURACIÓN GENERAL — EDITA AQUÍ
================================================================= */
const SITE_TITLE = "TIC - MULTICOMPUTO";

/* Tu endpoint de SheetDB. Ejemplo: "https://sheetdb.io/api/v1/abc123xyz"
   Si lo dejas vacío, la página funciona solo con el arreglo INVENTARIO de abajo. */
const SHEETDB_URL = "https://sheetdb.io/api/v1/TU_ID_AQUI";

/* Si tu hoja tiene varias pestañas, escribe el nombre de la pestaña. Si no, deja "". */
const SHEETDB_HOJA = "";

/* Token de SheetDB solo si activaste autorización en tu cuenta. Si no, deja "". */
const SHEETDB_TOKEN = "";

/* Nombre EXACTO de la columna de dañados en tu hoja, tal como está escrito en
   la fila 1 (con tilde o sin tilde). Si algún día cambias el encabezado a
   "danado", cambia también este valor. */
const COL_DANADO = "dañado";

const REPORTE_CONFIG = {
  correoJefe: "juangt1022@gmail.com",
  telefonoWhatsapp: "573015122607",
  nombreResponsable: "TIC - Juan Tobon"
};

/* Sedes y categorías que aparecen en los filtros y en el formulario.
   Si llegan otras desde la hoja, se agregan solas. */
const SEDES = ["Multicomputo", "Multitech"];

const CATEGORIAS = [
 "Otro"
];

/* ================================================================
   INVENTARIO LOCAL — EDITA AQUÍ LAS FILAS A MANO
   ================================================================
   Un equipo por fila. Columnas iguales a las de tu Excel:
     sede, id, categoria, nombre, bodega, prestamo, danado
   El TOTAL no se escribe: se calcula (bodega + prestamo + danado).

   Para agregar un equipo, copia una línea y cambia los valores.
   Si SHEETDB_URL está configurado, la hoja manda y estas filas solo
   se usan cuando no hay conexión.
================================================================= */
const INVENTARIO = [
  { sede: "Bucaramanga", id: "PC-001",  categoria: "Portátiles",  nombre: "Lenovo ThinkPad E14", bodega: 3, prestamo: 1, danado: 0 },
  { sede: "Bucaramanga", id: "VB-001",  categoria: "Videobeams",  nombre: "Epson X05",           bodega: 2, prestamo: 0, danado: 1 },
  { sede: "Cúcuta",      id: "BAF-001", categoria: "Bafles",      nombre: "JBL EON 615",         bodega: 1, prestamo: 1, danado: 0 }
  // , { sede: "Valledupar", id: "MIC-001", categoria: "Microfonos", nombre: "Shure SM58", bodega: 4, prestamo: 0, danado: 0 }
];

/* ================================================================
   LÓGICA — normalmente no necesitas editar debajo
================================================================= */
const COLUMNAS = ["sede", "id", "categoria", "nombre", "bodega", "prestamo", "dañado", "total"];

let equipos = [];
let modoSheet = false;                 // true si los datos vienen de SheetDB
let editandoId = null;                 // id del equipo que se está editando
let filters = { sede: "", categoria: "", estado: "", texto: "" };

const $ = id => document.getElementById(id);
const num = v => { const n = parseInt(v, 10); return isNaN(n) ? 0 : n; };
const totalDe = e => num(e.bodega) + num(e.prestamo) + num(e.danado);

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function normaliza(fila){
  return {
    sede:      String(fila.sede ?? "").trim(),
    id:        String(fila.id ?? "").trim(),
    categoria: String(fila.categoria ?? "").trim() || "Otro",
    nombre:    String(fila.nombre ?? "").trim(),
    bodega:    num(fila.bodega),
    prestamo:  num(fila.prestamo),
    danado:    num(fila[COL_DANADO] ?? fila["dañado"] ?? fila.danado)
  };
}

function aFilaHoja(e){
  const fila = {
    sede: e.sede, id: e.id, categoria: e.categoria, nombre: e.nombre,
    bodega: e.bodega, prestamo: e.prestamo, total: totalDe(e)
  };
  fila[COL_DANADO] = e.danado;   // usa el encabezado real de la hoja ("dañado")
  return fila;
}

/* ---------------- SheetDB ---------------- */
function sheetUrl(path = ""){
  let u = SHEETDB_URL + path;
  const params = [];
  if (SHEETDB_HOJA) params.push("sheet=" + encodeURIComponent(SHEETDB_HOJA));
  if (params.length) u += (u.includes("?") ? "&" : "?") + params.join("&");
  return u;
}
function sheetHeaders(){
  const h = { "Content-Type": "application/json" };
  if (SHEETDB_TOKEN) h["Authorization"] = "Bearer " + SHEETDB_TOKEN;
  return h;
}
function sheetConfigurado(){
  return SHEETDB_URL && !SHEETDB_URL.includes("TU_ID_AQUI");
}

function setSync(texto, ok){
  const el = $("syncState");
  el.textContent = texto;
  el.style.color = ok ? "var(--open)" : "var(--amber)";
}

async function cargarDatos(){
  if (!sheetConfigurado()){
    equipos = INVENTARIO.map(normaliza);
    modoSheet = false;
    setSync("Local (sin SheetDB)", false);
    render();
    return;
  }
  setSync("Cargando…", false);
  try{
    const r = await fetch(sheetUrl(), { headers: sheetHeaders() });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    equipos = (Array.isArray(data) ? data : []).map(normaliza).filter(e => e.id);
    modoSheet = true;
    setSync("Conectado a la hoja", true);
  }catch(err){
    console.error(err);
    equipos = INVENTARIO.map(normaliza);
    modoSheet = false;
    setSync("Sin conexión · datos locales", false);
  }
  render();
}

async function crearEnHoja(e){
  const r = await fetch(sheetUrl(), {
    method: "POST", headers: sheetHeaders(),
    body: JSON.stringify({ data: [aFilaHoja(e)] })
  });
  if (!r.ok) throw new Error("No se pudo escribir en la hoja (HTTP " + r.status + ")");
}

async function actualizarEnHoja(idOriginal, e){
  const r = await fetch(sheetUrl("/id/" + encodeURIComponent(idOriginal)), {
    method: "PATCH", headers: sheetHeaders(),
    body: JSON.stringify({ data: aFilaHoja(e) })
  });
  if (!r.ok) throw new Error("No se pudo actualizar la hoja (HTTP " + r.status + ")");
}

async function borrarEnHoja(id){
  const r = await fetch(sheetUrl("/id/" + encodeURIComponent(id)), {
    method: "DELETE", headers: sheetHeaders()
  });
  if (!r.ok) throw new Error("No se pudo borrar en la hoja (HTTP " + r.status + ")");
}

/* ---------------- Cálculos ---------------- */
function listaSedes(){
  return [...new Set([...SEDES, ...equipos.map(e => e.sede)].filter(Boolean))];
}
function listaCategorias(){
  return [...new Set([...CATEGORIAS, ...equipos.map(e => e.categoria)].filter(Boolean))];
}
function porCategoria(cat){
  const filas = equipos.filter(e => e.categoria === cat);
  return {
    total:    filas.reduce((s,e) => s + totalDe(e), 0),
    bodega:   filas.reduce((s,e) => s + num(e.bodega), 0),
    prestamo: filas.reduce((s,e) => s + num(e.prestamo), 0),
    danado:   filas.reduce((s,e) => s + num(e.danado), 0)
  };
}

/* ---------------- Render ---------------- */
function renderStats(){
  const total    = equipos.reduce((s,e) => s + totalDe(e), 0);
  const bodega   = equipos.reduce((s,e) => s + num(e.bodega), 0);
  const prestamo = equipos.reduce((s,e) => s + num(e.prestamo), 0);
  const danado   = equipos.reduce((s,e) => s + num(e.danado), 0);
  $("statTotal").textContent      = total;
  $("statBodega").textContent     = bodega;
  $("statPrestamo").textContent   = prestamo;
  $("statDanado").textContent     = danado;
  $("statCategorias").textContent = listaCategorias().filter(c => porCategoria(c).total > 0).length;
}

function renderCategorias(){
  const grid = $("catGrid");
  grid.innerHTML = "";
  listaCategorias().forEach(cat => {
    const d = porCategoria(cat);
    if (d.total === 0 && !CATEGORIAS.includes(cat)) return;
    let clase = "full";
    if (d.bodega === 0) clase = "empty";
    else if (d.prestamo > 0 || d.danado > 0) clase = "partial";

    const card = document.createElement("div");
    card.className = "cat-card " + clase;
    card.innerHTML = `
      <div class="state-bar"></div>
      <div class="name">${escapeHtml(cat)}</div>
      <div class="row"><span>Total</span><b>${d.total}</b></div>
      <div class="row disp"><span>Bodega</span><b>${d.bodega}</b></div>
      <div class="row"><span>Préstamo</span><b>${d.prestamo}</b></div>
      <div class="row dam"><span>Dañado</span><b>${d.danado}</b></div>
    `;
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      filters.categoria = (filters.categoria === cat) ? "" : cat;
      $("fCategoria").value = filters.categoria;
      renderTabla();
    });
    grid.appendChild(card);
  });
}

function renderFiltrosSelects(){
  const s = $("fSede"), c = $("fCategoria");
  s.innerHTML = '<option value="">Todas</option>' +
    listaSedes().map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  c.innerHTML = '<option value="">Todas</option>' +
    listaCategorias().map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
  s.value = filters.sede;
  c.value = filters.categoria;

  $("sedesList").innerHTML = listaSedes().map(x => `<option value="${escapeHtml(x)}">`).join("");
  $("catList").innerHTML   = listaCategorias().map(x => `<option value="${escapeHtml(x)}">`).join("");
}

function filtrar(){
  let list = equipos.slice();
  if (filters.sede)      list = list.filter(e => e.sede === filters.sede);
  if (filters.categoria) list = list.filter(e => e.categoria === filters.categoria);
  if (filters.estado === "bodega")   list = list.filter(e => num(e.bodega) > 0);
  if (filters.estado === "prestamo") list = list.filter(e => num(e.prestamo) > 0);
  if (filters.estado === "danado")   list = list.filter(e => num(e.danado) > 0);
  if (filters.texto){
    const t = filters.texto.toLowerCase();
    list = list.filter(e =>
      e.id.toLowerCase().includes(t) ||
      e.nombre.toLowerCase().includes(t) ||
      e.categoria.toLowerCase().includes(t));
  }
  return list.sort((a,b) => (a.sede+a.categoria+a.id).localeCompare(b.sede+b.categoria+b.id));
}

function renderTabla(){
  const list = filtrar();
  $("listLabel").textContent = `Equipos (${list.length})`;
  const wrap = $("itemsList");

  if (!list.length){
    wrap.innerHTML = '<div class="empty-msg">No hay equipos que coincidan con estos filtros.</div>';
    return;
  }

  const rows = list.map(e => {
    let badge = '<span class="badge open">En bodega</span>';
    if (num(e.bodega) === 0 && num(e.prestamo) > 0) badge = '<span class="badge amber">Todo prestado</span>';
    else if (num(e.prestamo) > 0) badge = '<span class="badge amber">Parcial</span>';
    if (num(e.bodega) === 0 && num(e.prestamo) === 0) badge = '<span class="badge closed">Sin disponibles</span>';

    return `
      <tr>
        <td data-label="Sede">${escapeHtml(e.sede)}</td>
        <td data-label="ID" class="mono"><b>${escapeHtml(e.id)}</b></td>
        <td data-label="Categoría">${escapeHtml(e.categoria)}</td>
        <td data-label="Nombre">${escapeHtml(e.nombre)}</td>
        <td data-label="Bodega" class="num">${num(e.bodega)}</td>
        <td data-label="Préstamo" class="num">${num(e.prestamo)}</td>
        <td data-label="Dañado" class="num">${num(e.danado)}</td>
        <td data-label="Total" class="num"><b>${totalDe(e)}</b></td>
        <td data-label="Estado">${badge}</td>
        <td data-label="Acciones"><div class="row-actions">
          <button class="mini-btn success" data-action="editar" data-id="${escapeHtml(e.id)}">✎ Editar</button>
          <button class="mini-btn danger" data-action="eliminar" data-id="${escapeHtml(e.id)}">🗑 Eliminar</button>
        </div></td>
      </tr>`;
  }).join("");

  wrap.innerHTML = `
    <table class="loan-table">
      <thead><tr>
        <th>Sede</th><th>ID</th><th>Categoría</th><th>Nombre</th>
        <th>Bodega</th><th>Préstamo</th><th>Dañado</th><th>Total</th>
        <th>Estado</th><th>Acciones</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function render(){
  renderStats();
  renderCategorias();
  renderFiltrosSelects();
  renderTabla();
}

/* ---------------- Acciones de la tabla ---------------- */
$("itemsList").addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "editar") return abrirModal(id);

  if (!confirm(`¿Eliminar el equipo ${id} del inventario?`)) return;
  try{
    if (modoSheet) await borrarEnHoja(id);
    equipos = equipos.filter(e => e.id !== id);
    render();
  }catch(err){ alert(err.message); }
});

/* ---------------- Modal de equipo ---------------- */
const itemOverlay = $("itemOverlay");

function recalcularTotal(){
  $("inTotal").value = num($("inBodega").value) + num($("inPrestamo").value) + num($("inDanado").value);
}
["inBodega","inPrestamo","inDanado"].forEach(id => $(id).addEventListener("input", recalcularTotal));

function abrirModal(id = null){
  editandoId = id;
  $("itemError").textContent = "";
  $("itemModalTitle").textContent = id ? "Editar equipo" : "Ingresar equipo a bodega";
  $("hintId").textContent = id ? "Puedes cambiar el ID" : "Debe ser único";

  const e = id ? equipos.find(x => x.id === id) : null;
  $("inSede").value      = e ? e.sede : (filters.sede || SEDES[0] || "");
  $("inId").value        = e ? e.id : "";
  $("inCategoria").value = e ? e.categoria : (filters.categoria || "");
  $("inNombre").value    = e ? e.nombre : "";
  $("inBodega").value    = e ? e.bodega : 1;
  $("inPrestamo").value  = e ? e.prestamo : 0;
  $("inDanado").value    = e ? e.danado : 0;
  recalcularTotal();

  itemOverlay.classList.add("show");
  $("inSede").focus();
}
function cerrarModal(){ itemOverlay.classList.remove("show"); editandoId = null; }

$("btnNuevo").addEventListener("click", () => abrirModal());
$("itemClose").addEventListener("click", cerrarModal);
itemOverlay.addEventListener("click", ev => { if (ev.target === itemOverlay) cerrarModal(); });
$("btnRecargar").addEventListener("click", cargarDatos);

$("itemForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nuevo = normaliza({
    sede: $("inSede").value, id: $("inId").value, categoria: $("inCategoria").value,
    nombre: $("inNombre").value, bodega: $("inBodega").value,
    prestamo: $("inPrestamo").value, danado: $("inDanado").value
  });
  const err = $("itemError");
  err.textContent = "";

  const duplicado = equipos.some(e => e.id === nuevo.id && e.id !== editandoId);
  if (duplicado){ err.textContent = `Ya existe un equipo con el ID ${nuevo.id}.`; return; }

  try{
    if (editandoId){
      if (modoSheet) await actualizarEnHoja(editandoId, nuevo);
      equipos = equipos.map(e => e.id === editandoId ? nuevo : e);
    }else{
      if (modoSheet) await crearEnHoja(nuevo);
      equipos.push(nuevo);
    }
    cerrarModal();
    render();
  }catch(e2){ err.textContent = e2.message; }
});

/* ---------------- Filtros ---------------- */
$("fSede").addEventListener("change", e => { filters.sede = e.target.value; renderTabla(); });
$("fCategoria").addEventListener("change", e => { filters.categoria = e.target.value; renderTabla(); });
$("fSearch").addEventListener("input", e => { filters.texto = e.target.value.trim(); renderTabla(); });
document.querySelectorAll(".status-toggle button").forEach(b => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".status-toggle button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    filters.estado = b.dataset.status;
    renderTabla();
  });
});

/* ---------------- Reporte ---------------- */
function fechaHoraActual(){
  return new Date().toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
}

function generarReporte(){
  const total    = equipos.reduce((s,e) => s + totalDe(e), 0);
  const bodega   = equipos.reduce((s,e) => s + num(e.bodega), 0);
  const prestamo = equipos.reduce((s,e) => s + num(e.prestamo), 0);
  const danado   = equipos.reduce((s,e) => s + num(e.danado), 0);

  let out = `REPORTE DE INVENTARIO — ${SITE_TITLE}\n`;
  out += `Generado: ${fechaHoraActual()}\n`;
  out += `Responsable: ${REPORTE_CONFIG.nombreResponsable}\n\n`;
  out += `RESUMEN\nTotal: ${total} · Bodega: ${bodega} · Préstamo: ${prestamo} · Dañado: ${danado}\n\n`;

  out += "POR CATEGORÍA\n";
  listaCategorias().forEach(c => {
    const d = porCategoria(c);
    if (!d.total) return;
    out += `- ${c}: total ${d.total} | bodega ${d.bodega} | préstamo ${d.prestamo} | dañado ${d.danado}\n`;
  });

  out += "\nDETALLE\n";
  filtrar().forEach(e => {
    out += `[${e.sede}] ${e.id} · ${e.categoria} · ${e.nombre} — bodega ${e.bodega}, préstamo ${e.prestamo}, dañado ${e.danado}, total ${totalDe(e)}\n`;
  });
  return out;
}

$("btnReporte").addEventListener("click", () => {
  const texto = generarReporte();
  $("reportText").value = texto;
  $("btnMailto").href = `mailto:${REPORTE_CONFIG.correoJefe}?subject=${encodeURIComponent("Reporte de inventario — " + SITE_TITLE)}&body=${encodeURIComponent(texto)}`;
  $("btnWhatsapp").href = `https://wa.me/${REPORTE_CONFIG.telefonoWhatsapp}?text=${encodeURIComponent("Adjunto el reporte de inventario en PDF.")}`;
  $("reportOverlay").classList.add("show");
});
$("reportClose").addEventListener("click", () => $("reportOverlay").classList.remove("show"));
$("reportOverlay").addEventListener("click", ev => { if (ev.target === $("reportOverlay")) ev.currentTarget.classList.remove("show"); });

$("btnCopiar").addEventListener("click", () => {
  navigator.clipboard.writeText($("reportText").value).then(() => alert("Reporte copiado."));
});
$("btnDescargar").addEventListener("click", () => {
  const blob = new Blob([$("reportText").value], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `inventario_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
});
$("btnDescargarPDF").addEventListener("click", () => {
  if (!window.jspdf){ alert("No se pudo cargar el generador de PDF."); return; }
  const doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("courier", "normal"); doc.setFontSize(9);
  const lineas = doc.splitTextToSize($("reportText").value, 520);
  let y = 50;
  lineas.forEach(l => {
    if (y > 740){ doc.addPage(); y = 50; }
    doc.text(l, 40, y); y += 12;
  });
  doc.save(`inventario_${new Date().toISOString().slice(0,10)}.pdf`);
});

document.addEventListener("keydown", ev => {
  if (ev.key === "Escape"){
    cerrarModal();
    $("reportOverlay").classList.remove("show");
  }
});

/* ---------------- Inicio ---------------- */
$("siteTitle").textContent = SITE_TITLE;
cargarDatos();
