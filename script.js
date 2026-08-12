/* ================================================================
   CONFIGURACIÓN GENERAL — edita aquí
================================================================= */
const SITE_TITLE = "Oficina de Audiovisuales";

const REPORTE_CONFIG = {
  correoJefe: "jefe@correo.com",           // destinatario del correo
  telefonoWhatsapp: "573156422898",        // con código de país, sin "+", sin espacios
  nombreResponsable: "Aux Audiovisuales"
};

/* ================================================================
   INVENTARIO PRINCIPAL — EDITA AQUÍ LAS CANTIDADES REALES
   ================================================================
   Cada categoría:
     id:     identificador único, sin espacios (se usa internamente)
     nombre: nombre visible en la página
     total:  cantidad TOTAL que existe en la dependencia

   La disponibilidad se calcula sola (total - prestados activos),
   así que aquí SOLO pones el total que hay en el inventario.

   Para agregar una categoría nueva, copia una línea y cambia los
   valores — no necesitas tocar el resto del código.
================================================================= */
const CATEGORIAS = [
  { id: "Portatiles",     nombre: "Portátiles",         total: 100 },
  { id: "Bafles",         nombre: "Bafles",             total: 100 },
  { id: "Videobeam",      nombre: "Videobeams",         total: 100 },
  { id: "Mouse",          nombre: "Mouse",              total: 100 },
  { id: "Teclado",        nombre: "Teclados",           total: 100 },
  { id: "Convertidores",  nombre: "Convertidores",      total: 100 },
  { id: "Microfonos",     nombre: "Microfonos",         total: 100 },
  { id: "WebCam",         nombre: "WebCam",             total: 100 },
  { id: "Otro",           nombre: "Otro",               total: 100 }
  // Agrega aquí nuevas categorías, por ejemplo:
  // , { id: "camaras", nombre: "Cámaras", total: 0 }
  // , { id: "parlantes", nombre: "Parlantes", total: 0 }
];

/* ================================================================
   LÓGICA DE LA APLICACIÓN — normalmente no necesitas editar debajo
================================================================= */

const STORAGE_KEY = "prestamos_audiovisuales_v1";

function loadPrestamos(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch(e){ return []; }
}
function savePrestamos(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prestamos));
}

let prestamos = loadPrestamos();
let filters = { categoria: "", estado: "prestado", texto: "" };

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function nombreCategoria(id){
  const c = CATEGORIAS.find(c => c.id === id);
  return c ? c.nombre : id;
}

function prestadoPorCategoria(catId){
  return prestamos
    .filter(p => p.categoriaId === catId && p.estado === "prestado")
    .reduce((s, p) => s + Number(p.cantidad), 0);
}

function disponiblePorCategoria(catId){
  const cat = CATEGORIAS.find(c => c.id === catId);
  const total = cat ? cat.total : 0;
  return total - prestadoPorCategoria(catId);
}

function hoyISO(){
  return new Date().toISOString().slice(0,10);
}

function fechaHoraActual(){
  const d = new Date();
  return d.toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });
}

/* ---------- Render: estadísticas ---------- */
function renderStats(){
  const total = CATEGORIAS.reduce((s,c) => s + c.total, 0);
  const prestado = CATEGORIAS.reduce((s,c) => s + prestadoPorCategoria(c.id), 0);
  const disponible = total - prestado;
  const activos = prestamos.filter(p => p.estado === "prestado").length;

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statDisponible").textContent = disponible;
  document.getElementById("statPrestado").textContent = prestado;
  document.getElementById("statCategorias").textContent = CATEGORIAS.length;
  document.getElementById("activeCount").textContent = activos;
}

/* ---------- Render: tarjetas de inventario ---------- */
function renderCatGrid(){
  const grid = document.getElementById("catGrid");
  grid.innerHTML = "";

  CATEGORIAS.forEach(c => {
    const disp = disponiblePorCategoria(c.id);
    const prest = prestadoPorCategoria(c.id);
    let estadoClase = "full";
    if (disp === 0 && c.total > 0) estadoClase = "empty";
    else if (disp < c.total) estadoClase = "partial";

    const card = document.createElement("div");
    card.className = "cat-card " + estadoClase;
    card.innerHTML = `
      <span class="state-bar"></span>
      <div class="name">${escapeHtml(c.nombre)}</div>
      <div class="row"><span>Total</span><b>${c.total}</b></div>
      <div class="row disp"><span>Disponibles</span><b>${disp}</b></div>
      <div class="row"><span>Prestados</span><b>${prest}</b></div>
    `;
    grid.appendChild(card);
  });
}

/* ---------- Render: filtros (select de categoría) ---------- */
function populateCategoriaFilter(){
  const sel = document.getElementById("fCategoria");
  const current = sel.value;
  sel.innerHTML = '<option value="">Todas</option>' +
    CATEGORIAS.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  sel.value = filters.categoria || current || "";
}

/* ---------- Render: listado de préstamos ---------- */
function renderLoansList(){
  const label = document.getElementById("loansSectionLabel");
  label.textContent = filters.estado === "prestado" ? "Préstamos activos"
    : filters.estado === "devuelto" ? "Historial (devueltos)"
    : "Todos los préstamos";

  let list = prestamos.slice().sort((a,b) => (b.fechaPrestamo || "").localeCompare(a.fechaPrestamo || ""));

  if (filters.categoria) list = list.filter(p => p.categoriaId === filters.categoria);
  if (filters.estado) list = list.filter(p => p.estado === filters.estado);
  if (filters.texto){
    const t = filters.texto.toLowerCase();
    list = list.filter(p => (p.solicitante || "").toLowerCase().includes(t));
  }

  const wrap = document.getElementById("loansList");

  if (!list.length){
    wrap.innerHTML = '<div class="empty-msg">No hay préstamos que coincidan con estos filtros.</div>';
    return;
  }

  const rows = list.map(p => {
    const badge = p.estado === "prestado"
      ? '<span class="badge amber">Prestado</span>'
      : '<span class="badge open">Devuelto</span>';

    const acciones = p.estado === "prestado"
      ? `<button class="mini-btn success" data-action="devolver" data-id="${p.id}">✓ Marcar devuelto</button>
         <button class="mini-btn danger" data-action="eliminar" data-id="${p.id}">🗑 Eliminar</button>`
      : `<button class="mini-btn danger" data-action="eliminar" data-id="${p.id}">🗑 Eliminar</button>`;

    return `
      <tr>
        <td data-label="Equipo"><b>${escapeHtml(nombreCategoria(p.categoriaId))}</b> × ${p.cantidad}</td>
        <td data-label="Solicitante">${escapeHtml(p.solicitante)}${p.dependencia ? `<br><span class="obs">${escapeHtml(p.dependencia)}</span>` : ""}</td>
        <td data-label="Préstamo" class="mono">${escapeHtml(p.fechaPrestamo || "—")}</td>
        <td data-label="Devolución est." class="mono">${escapeHtml(p.fechaDevolucionEstimada || "—")}</td>
        <td data-label="Devolución real" class="mono">${escapeHtml(p.fechaDevolucionReal || "—")}</td>
        <td data-label="Estado">${badge}</td>
        <td data-label="Observaciones" class="obs">${escapeHtml(p.observaciones || "—")}</td>
        <td data-label="Acciones"><div class="row-actions">${acciones}</div></td>
      </tr>
    `;
  }).join("");

  wrap.innerHTML = `
    <table class="loan-table">
      <thead>
        <tr>
          <th>Equipo</th><th>Solicitante</th><th>Préstamo</th><th>Devolución est.</th>
          <th>Devolución real</th><th>Estado</th><th>Observaciones</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  wrap.querySelectorAll("[data-action='devolver']").forEach(btn => {
    btn.addEventListener("click", () => marcarDevuelto(btn.getAttribute("data-id")));
  });
  wrap.querySelectorAll("[data-action='eliminar']").forEach(btn => {
    btn.addEventListener("click", () => eliminarPrestamo(btn.getAttribute("data-id")));
  });
}

function renderAll(){
  renderStats();
  renderCatGrid();
  populateCategoriaFilter();
  renderLoansList();
}

/* ---------- Acciones sobre préstamos ---------- */
function marcarDevuelto(id){
  const p = prestamos.find(x => x.id === id);
  if (!p) return;
  p.estado = "devuelto";
  p.fechaDevolucionReal = hoyISO();
  savePrestamos();
  renderAll();
}

function eliminarPrestamo(id){
  if (!confirm("¿Eliminar este registro de préstamo? Esta acción no se puede deshacer.")) return;
  prestamos = prestamos.filter(x => x.id !== id);
  savePrestamos();
  renderAll();
}

/* ---------- Filtros ---------- */
document.getElementById("fCategoria").addEventListener("change", e => {
  filters.categoria = e.target.value;
  renderLoansList();
});
document.getElementById("fSearch").addEventListener("input", e => {
  filters.texto = e.target.value;
  renderLoansList();
});
document.querySelectorAll(".status-toggle button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".status-toggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    filters.estado = btn.getAttribute("data-status");
    renderLoansList();
  });
});

/* ---------- Modal: nuevo préstamo ---------- */
const loanOverlay = document.getElementById("loanOverlay");

function abrirModalPrestamo(){
  const sel = document.getElementById("inCategoria");
  sel.innerHTML = CATEGORIAS.map(c =>
    `<option value="${c.id}">${escapeHtml(c.nombre)} — disponibles: ${disponiblePorCategoria(c.id)}</option>`
  ).join("");

  document.getElementById("inCantidad").value = 1;
  document.getElementById("inSolicitante").value = "";
  document.getElementById("inDependencia").value = "";
  document.getElementById("inFechaPrestamo").value = hoyISO();
  document.getElementById("inFechaDevolucion").value = "";
  document.getElementById("inObservaciones").value = "";
  document.getElementById("loanError").textContent = "";
  actualizarHintDisponible();

  loanOverlay.classList.add("show");
}
function cerrarModalPrestamo(){
  loanOverlay.classList.remove("show");
}

function actualizarHintDisponible(){
  const catId = document.getElementById("inCategoria").value;
  const disp = disponiblePorCategoria(catId);
  document.getElementById("hintDisponible").textContent = `Disponibles ahora: ${disp}`;
}

document.getElementById("btnNuevoPrestamo").addEventListener("click", abrirModalPrestamo);
document.getElementById("loanClose").addEventListener("click", cerrarModalPrestamo);
loanOverlay.addEventListener("click", e => { if (e.target === loanOverlay) cerrarModalPrestamo(); });
document.getElementById("inCategoria").addEventListener("change", actualizarHintDisponible);

document.getElementById("loanForm").addEventListener("submit", e => {
  e.preventDefault();

  const categoriaId = document.getElementById("inCategoria").value;
  const cantidad = parseInt(document.getElementById("inCantidad").value, 10);
  const solicitante = document.getElementById("inSolicitante").value.trim();
  const dependencia = document.getElementById("inDependencia").value.trim();
  const fechaPrestamo = document.getElementById("inFechaPrestamo").value || hoyISO();
  const fechaDevolucionEstimada = document.getElementById("inFechaDevolucion").value;
  const observaciones = document.getElementById("inObservaciones").value.trim();

  const errorEl = document.getElementById("loanError");

  if (!solicitante){
    errorEl.textContent = "Debes indicar el nombre del solicitante.";
    return;
  }
  if (!cantidad || cantidad < 1){
    errorEl.textContent = "La cantidad debe ser al menos 1.";
    return;
  }
  const disponible = disponiblePorCategoria(categoriaId);
  if (cantidad > disponible){
    errorEl.textContent = `Solo hay ${disponible} unidad(es) disponibles de ${nombreCategoria(categoriaId)}.`;
    return;
  }

  prestamos.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2,7),
    categoriaId,
    cantidad,
    solicitante,
    dependencia,
    fechaPrestamo,
    fechaDevolucionEstimada,
    fechaDevolucionReal: null,
    estado: "prestado",
    observaciones
  });

  savePrestamos();
  renderAll();
  cerrarModalPrestamo();
});

/* ================================================================
   REPORTE (texto, PDF, correo, WhatsApp)
================================================================= */
function construirTextoReporte(){
  const total = CATEGORIAS.reduce((s,c) => s + c.total, 0);
  const prestado = CATEGORIAS.reduce((s,c) => s + prestadoPorCategoria(c.id), 0);
  const disponible = total - prestado;

  let out = "";
  out += "REPORTE DE PRÉSTAMOS — AUDIOVISUALES\n";
  out += SITE_TITLE + "\n";
  out += "Generado: " + fechaHoraActual() + "\n";
  out += "----------------------------------------\n\n";
  out += "RESUMEN GENERAL\n";
  out += `Equipos totales:  ${total}\n`;
  out += `Disponibles:      ${disponible}\n`;
  out += `Prestados:        ${prestado}\n\n`;

  out += "INVENTARIO POR CATEGORÍA\n";
  CATEGORIAS.forEach(c => {
    const disp = disponiblePorCategoria(c.id);
    const prest = prestadoPorCategoria(c.id);
    out += `  ${c.nombre}: total ${c.total} — disponibles ${disp} — prestados ${prest}\n`;
  });
  out += "\n";

  const activos = prestamos.filter(p => p.estado === "prestado")
    .sort((a,b) => (a.fechaPrestamo || "").localeCompare(b.fechaPrestamo || ""));

  out += `PRÉSTAMOS ACTIVOS (${activos.length})\n`;
  if (!activos.length){
    out += "  Ninguno.\n";
  } else {
    activos.forEach(p => {
      out += `  - ${nombreCategoria(p.categoriaId)} x${p.cantidad} | ${p.solicitante}`
        + (p.dependencia ? ` (${p.dependencia})` : "")
        + ` | prestado: ${p.fechaPrestamo || "—"}`
        + ` | devolución est.: ${p.fechaDevolucionEstimada || "—"}\n`;
    });
  }

  out += "\n----------------------------------------\n";
  out += "Reporte generado automáticamente desde el sistema de préstamos.\n";
  out += "Responsable: " + REPORTE_CONFIG.nombreResponsable + "\n";

  return out;
}

function abrirModalReporte(){
  const texto = construirTextoReporte();
  document.getElementById("reportText").value = texto;

  const asunto = `Reporte de préstamos — Audiovisuales — ${new Date().toLocaleDateString("es-CO")}`;
  const mailtoUrl = `mailto:${encodeURIComponent(REPORTE_CONFIG.correoJefe)}`
    + `?subject=${encodeURIComponent(asunto)}`
    + `&body=${encodeURIComponent(texto)}`;
  document.getElementById("btnMailto").href = mailtoUrl;

  const waTexto = `Buen día, adjunto el reporte de préstamos de audiovisuales del ${new Date().toLocaleDateString("es-CO")}.`;
  const waUrl = `https://wa.me/${REPORTE_CONFIG.telefonoWhatsapp}?text=${encodeURIComponent(waTexto)}`;
  document.getElementById("btnWhatsapp").href = waUrl;

  document.getElementById("reportOverlay").classList.add("show");
}
function cerrarModalReporte(){
  document.getElementById("reportOverlay").classList.remove("show");
}

document.getElementById("btnReporte").addEventListener("click", abrirModalReporte);
document.getElementById("reportClose").addEventListener("click", cerrarModalReporte);
document.getElementById("reportOverlay").addEventListener("click", e => {
  if (e.target.id === "reportOverlay") cerrarModalReporte();
});

document.getElementById("btnCopiar").addEventListener("click", async () => {
  const texto = document.getElementById("reportText").value;
  try{
    await navigator.clipboard.writeText(texto);
    const btn = document.getElementById("btnCopiar");
    const original = btn.textContent;
    btn.textContent = "✅ Copiado";
    setTimeout(() => { btn.textContent = original; }, 1600);
  }catch(e){
    const ta = document.getElementById("reportText");
    ta.select();
    document.execCommand("copy");
  }
});

document.getElementById("btnDescargar").addEventListener("click", () => {
  const texto = document.getElementById("reportText").value;
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte-prestamos-${hoyISO()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

function generarPDF(){
  if (!window.jspdf){
    alert("No se pudo cargar el generador de PDF. Verifica tu conexión a internet e intenta de nuevo.");
    return null;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 44;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 54;

  function salto(alto){
    if (y + alto > pageHeight - 40){ doc.addPage(); y = 54; }
  }
  function linea(texto, opts={}){
    const { size=10, style="normal", color=[20,20,20], alto=14 } = opts;
    salto(alto);
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(texto, marginX, y);
    y += alto;
  }

  const total = CATEGORIAS.reduce((s,c) => s + c.total, 0);
  const prestado = CATEGORIAS.reduce((s,c) => s + prestadoPorCategoria(c.id), 0);
  const disponible = total - prestado;

  linea("Reporte de préstamos — Audiovisuales", { size: 17, style: "bold", alto: 22 });
  linea(SITE_TITLE, { size: 10, color: [90,90,90], alto: 14 });
  linea("Generado: " + fechaHoraActual(), { size: 10, color: [90,90,90], alto: 20 });

  linea("Resumen general", { size: 12, style: "bold", alto: 16 });
  linea(`Total: ${total}    Disponibles: ${disponible}    Prestados: ${prestado}`, { size: 10, alto: 20 });

  linea("Inventario por categoría", { size: 12, style: "bold", alto: 16 });
  CATEGORIAS.forEach(c => {
    const disp = disponiblePorCategoria(c.id);
    const prest = prestadoPorCategoria(c.id);
    linea(`  ${c.nombre}: total ${c.total} · disponibles ${disp} · prestados ${prest}`, { size: 9.5, alto: 13 });
  });
  y += 8;

  const activos = prestamos.filter(p => p.estado === "prestado")
    .sort((a,b) => (a.fechaPrestamo || "").localeCompare(b.fechaPrestamo || ""));

  salto(20);
  linea(`Préstamos activos (${activos.length})`, { size: 12, style: "bold", alto: 16 });
  if (!activos.length){
    linea("  Ninguno.", { size: 9.5, alto: 13 });
  } else {
    activos.forEach(p => {
      const texto = `  ${nombreCategoria(p.categoriaId)} x${p.cantidad} — ${p.solicitante}`
        + (p.dependencia ? ` (${p.dependencia})` : "")
        + ` — prestado: ${p.fechaPrestamo || "—"} — devolución est.: ${p.fechaDevolucionEstimada || "—"}`;
      const wrapped = doc.splitTextToSize(texto, maxWidth - 10);
      wrapped.forEach(w => linea(w, { size: 9.5, alto: 12 }));
    });
  }

  y += 10;
  salto(20);
  linea("Responsable: " + REPORTE_CONFIG.nombreResponsable, { size: 9, color: [110,110,110], alto: 13 });

  return doc;
}

document.getElementById("btnDescargarPDF").addEventListener("click", () => {
  const doc = generarPDF();
  if (!doc) return;
  doc.save(`reporte-prestamos-${hoyISO()}.pdf`);
});

/* ---------- Init ---------- */
document.getElementById("siteTitle").textContent = SITE_TITLE;
renderAll();
