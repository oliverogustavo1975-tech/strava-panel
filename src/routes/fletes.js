const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const genId = () => crypto.randomBytes(10).toString("hex");
const str = v => (v === undefined || v === null || v === "" ? null : String(v));
const num = v => (v === undefined || v === null || v === "" ? null : Number(v));
const bool = v => v === "on" || v === "true" || v === true;

function toInputLocal(d) {
  if (!d) return "";
  const dt = new Date(new Date(d).getTime() - 3 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 16);
}
function fromInputLocal(v) {
  if (!v) return null;
  return new Date(new Date(v + ":00Z").getTime() + 3 * 60 * 60 * 1000);
}

async function loadOptions() {
  const [{ rows: resources }, { rows: jobs }] = await Promise.all([
    db.query("SELECT id, tipo, nombre, identificador FROM resources ORDER BY nombre"),
    db.query("SELECT id, titulo FROM jobs ORDER BY fecha_inicio DESC"),
  ]);
  const groups = { grua: [], camion: [], remolque: [], operario: [] };
  for (const r of resources) if (groups[r.tipo]) groups[r.tipo].push(r);
  return { groups, jobs };
}

router.get("/nuevo", requireAuth, async (req, res, next) => {
  try {
    const { groups, jobs } = await loadOptions();
    res.render("flete-form", { f: {}, isNew: true, groups, jobs, toInputLocal });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const id = genId();
    await db.query(
      `INSERT INTO fletes (id, cliente, solicitante, solicitante_contacto, componente, numero_serie, fecha,
         camion_id, remolque_id, chofer_id, trabajo_id, origen_texto, origen_maps_url, destino_texto, destino_maps_url,
         peso_carga_t, medida_ancho_m, medida_largo_m, necesita_grua, grua_id, distancia_km, viajes_movilizacion_total,
         fecha_llegada, llegada_nota, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
      [
        id, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.componente), str(b.numero_serie), fromInputLocal(b.fecha),
        str(b.camion_id), str(b.remolque_id), str(b.chofer_id), str(b.trabajo_id), str(b.origen_texto), str(b.origen_maps_url), str(b.destino_texto), str(b.destino_maps_url),
        num(b.peso_carga_t), num(b.medida_ancho_m), num(b.medida_largo_m), bool(b.necesita_grua), str(b.grua_id), num(b.distancia_km), num(b.viajes_movilizacion_total),
        fromInputLocal(b.fecha_llegada), str(b.llegada_nota), str(b.notas),
      ]
    );
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

router.get("/:id/editar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM fletes WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Flete no encontrado");
    const { groups, jobs } = await loadOptions();
    res.render("flete-form", { f: rows[0], isNew: false, groups, jobs, toInputLocal });
  } catch (err) {
    next(err);
  }
});

router.post("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query(
      `UPDATE fletes SET cliente=$2, solicitante=$3, solicitante_contacto=$4, componente=$5, numero_serie=$6, fecha=$7,
         camion_id=$8, remolque_id=$9, chofer_id=$10, trabajo_id=$11, origen_texto=$12, origen_maps_url=$13, destino_texto=$14, destino_maps_url=$15,
         peso_carga_t=$16, medida_ancho_m=$17, medida_largo_m=$18, necesita_grua=$19, grua_id=$20, distancia_km=$21, viajes_movilizacion_total=$22,
         fecha_llegada=$23, llegada_nota=$24, notas=$25, updated_at=now()
       WHERE id=$1`,
      [
        req.params.id, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.componente), str(b.numero_serie), fromInputLocal(b.fecha),
        str(b.camion_id), str(b.remolque_id), str(b.chofer_id), str(b.trabajo_id), str(b.origen_texto), str(b.origen_maps_url), str(b.destino_texto), str(b.destino_maps_url),
        num(b.peso_carga_t), num(b.medida_ancho_m), num(b.medida_largo_m), bool(b.necesita_grua), str(b.grua_id), num(b.distancia_km), num(b.viajes_movilizacion_total),
        fromInputLocal(b.fecha_llegada), str(b.llegada_nota), str(b.notas),
      ]
    );
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM fletes WHERE id=$1", [req.params.id]);
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
