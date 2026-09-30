// Configuración: tipos de recurso propios (lanchas, vacas, caramelos…) con campos a medida,
// y "Otros recursos": las fichas de esos tipos.
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const genId = () => crypto.randomBytes(8).toString("hex");
const str = v => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const numN = v => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const slug = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "campo";
const TIPOS_CAMPO = { texto: "Texto", numero: "Número", fecha: "Fecha" };
const ESTADOS = { disponible: "Disponible", ocupado: "Ocupado", mantenimiento: "Fuera de servicio", baja: "Baja" };
const ESTADO_PILL = { disponible: "disponible", ocupado: "ocupado", mantenimiento: "mantenimiento", baja: "baja" };

async function getTipo(id) {
  const { rows } = await db.query("SELECT * FROM tipos_custom WHERE id=$1", [id]);
  return rows[0] || null;
}

/* ---------- Configuración de tipos ---------- */
router.get("/config", async (req, res, next) => {
  try {
    const { rows: tipos } = await db.query("SELECT t.*, (SELECT COUNT(*) FROM items_custom i WHERE i.tipo_id=t.id)::int AS n FROM tipos_custom t ORDER BY t.nombre");
    res.render("config", { titulo: "Configuración", tag: "Tipos de recurso y campos a medida", activo: "config", ruta: "/config", tipos, TIPOS_CAMPO, msg: req.query.msg || "" });
  } catch (e) { next(e); }
});
router.post("/config/tipo", requireAuth, async (req, res, next) => {
  try {
    const nombre = str(req.body.nombre);
    if (!nombre) return res.redirect("/config");
    await db.query("INSERT INTO tipos_custom (id, nombre, plural, icono) VALUES ($1,$2,$3,$4)", [genId(), nombre, str(req.body.plural) || nombre + "s", str(req.body.icono) || "📦"]);
    res.redirect("/config");
  } catch (e) { next(e); }
});
router.post("/config/tipo/:id", requireAuth, async (req, res, next) => {
  try {
    const nombre = str(req.body.nombre);
    if (nombre) await db.query("UPDATE tipos_custom SET nombre=$2, plural=$3, icono=$4 WHERE id=$1", [req.params.id, nombre, str(req.body.plural) || nombre + "s", str(req.body.icono) || "📦"]);
    res.redirect("/config");
  } catch (e) { next(e); }
});
router.post("/config/tipo/:id/campo", requireAuth, async (req, res, next) => {
  try {
    const t = await getTipo(req.params.id);
    const label = str(req.body.label);
    if (!t || !label) return res.redirect("/config");
    const campos = t.campos || [];
    let k = slug(label), i = 2;
    while (campos.some(c => c.k === k)) k = slug(label) + "_" + i++;
    campos.push({ k, label, tipo: TIPOS_CAMPO[req.body.tipo] ? req.body.tipo : "texto" });
    await db.query("UPDATE tipos_custom SET campos=$2 WHERE id=$1", [t.id, JSON.stringify(campos)]);
    res.redirect("/config");
  } catch (e) { next(e); }
});
router.post("/config/tipo/:id/campo/:k/eliminar", requireAuth, async (req, res, next) => {
  try {
    const t = await getTipo(req.params.id);
    if (t) await db.query("UPDATE tipos_custom SET campos=$2 WHERE id=$1", [t.id, JSON.stringify((t.campos || []).filter(c => c.k !== req.params.k))]);
    res.redirect("/config");
  } catch (e) { next(e); }
});
router.post("/config/tipo/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT COUNT(*)::int AS n FROM items_custom WHERE tipo_id=$1", [req.params.id]);
    if (rows[0].n > 0) return res.redirect("/config?msg=" + encodeURIComponent("Ese tipo todavía tiene fichas cargadas. Borrá primero las fichas."));
    await db.query("DELETE FROM tipos_custom WHERE id=$1", [req.params.id]);
    res.redirect("/config");
  } catch (e) { next(e); }
});

/* ---------- Otros recursos (fichas de los tipos propios) ---------- */
router.get("/otros", async (req, res, next) => {
  try {
    const [{ rows: tipos }, { rows: cuentas }] = await Promise.all([
      db.query("SELECT * FROM tipos_custom ORDER BY nombre"),
      db.query("SELECT tipo_id, estado, COUNT(*)::int AS n FROM items_custom GROUP BY 1,2"),
    ]);
    const por = {};
    cuentas.forEach(c => { (por[c.tipo_id] = por[c.tipo_id] || { total: 0 }); por[c.tipo_id][c.estado] = c.n; por[c.tipo_id].total += c.n; });
    res.render("otros", { titulo: "Otros recursos", tag: "Recursos de tus otros rubros", activo: "otros", ruta: "/otros", tipos, por, ESTADOS });
  } catch (e) { next(e); }
});
router.get("/otros/:tipoId", async (req, res, next) => {
  try {
    const tipo = await getTipo(req.params.tipoId);
    if (!tipo) return res.redirect("/otros");
    const { rows: items } = await db.query("SELECT * FROM items_custom WHERE tipo_id=$1 ORDER BY nombre", [tipo.id]);
    const editar = req.query.editar ? items.find(i => i.id === req.query.editar) || null : null;
    res.render("otros-tipo", { titulo: tipo.plural || tipo.nombre, tag: (tipo.icono || "") + " " + (tipo.plural || tipo.nombre), activo: "otros", ruta: "/otros/" + tipo.id, tipo, items, editar, ESTADOS, ESTADO_PILL });
  } catch (e) { next(e); }
});
function leerDatos(tipo, body) {
  const datos = {};
  (tipo.campos || []).forEach(c => {
    const v = body["c_" + c.k];
    datos[c.k] = c.tipo === "numero" ? numN(v) : str(v);
  });
  return datos;
}
router.post("/otros/:tipoId", requireAuth, async (req, res, next) => {
  try {
    const tipo = await getTipo(req.params.tipoId);
    if (!tipo || !str(req.body.nombre)) return res.redirect("/otros/" + req.params.tipoId);
    await db.query("INSERT INTO items_custom (id, tipo_id, nombre, estado, datos, notas) VALUES ($1,$2,$3,$4,$5,$6)",
      [genId(), tipo.id, str(req.body.nombre), ESTADOS[req.body.estado] ? req.body.estado : "disponible", JSON.stringify(leerDatos(tipo, req.body)), str(req.body.notas)]);
    res.redirect("/otros/" + tipo.id);
  } catch (e) { next(e); }
});
router.post("/otros/:tipoId/:id", requireAuth, async (req, res, next) => {
  try {
    const tipo = await getTipo(req.params.tipoId);
    if (!tipo || !str(req.body.nombre)) return res.redirect("/otros/" + req.params.tipoId);
    await db.query("UPDATE items_custom SET nombre=$3, estado=$4, datos=$5, notas=$6, updated_at=now() WHERE id=$2 AND tipo_id=$1",
      [tipo.id, req.params.id, str(req.body.nombre), ESTADOS[req.body.estado] ? req.body.estado : "disponible", JSON.stringify(leerDatos(tipo, req.body)), str(req.body.notas)]);
    res.redirect("/otros/" + tipo.id);
  } catch (e) { next(e); }
});
router.post("/otros/:tipoId/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM items_custom WHERE id=$1 AND tipo_id=$2", [req.params.id, req.params.tipoId]);
    res.redirect("/otros/" + req.params.tipoId);
  } catch (e) { next(e); }
});

module.exports = router;
