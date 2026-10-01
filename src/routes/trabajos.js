const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const genId = () => crypto.randomBytes(10).toString("hex");
const str = v => (v === undefined || v === null || v === "" ? null : String(v));
const num = v => (v === undefined || v === null || v === "" ? null : Number(v));
const arr = v => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const json = v => JSON.stringify(v || []);

// Uruguay no tiene horario de verano: UTC-3 todo el año. Los campos
// datetime-local del navegador no llevan huso horario, así que sumamos o
// restamos 3 horas a mano para que lo que se ve en el formulario coincida
// con la hora que ya se muestra en las vistas de solo lectura (toLocaleString
// "es-UY").
function toInputLocal(d) {
  if (!d) return "";
  const dt = new Date(new Date(d).getTime() - 3 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 16);
}
function fromInputLocal(v) {
  if (!v) return null;
  return new Date(new Date(v + ":00Z").getTime() + 3 * 60 * 60 * 1000);
}

async function loadResourceGroups() {
  const { rows } = await db.query("SELECT id, tipo, nombre, identificador FROM resources ORDER BY nombre");
  const groups = { grua: [], camion: [], remolque: [], operario: [] };
  for (const r of rows) if (groups[r.tipo]) groups[r.tipo].push(r);
  return groups;
}

router.get("/nuevo", requireAuth, async (req, res, next) => {
  try {
    const groups = await loadResourceGroups();
    res.render("trabajo-form", {
      j: {}, isNew: true, groups,
      selected: { gruas: [], camiones: [], remolques: [], operarios: [] },
      toInputLocal,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const id = genId();
    await db.query(
      `INSERT INTO jobs (id, titulo, cliente, solicitante, solicitante_contacto, ubicacion, ubicacion_maps_url,
         fecha_inicio, fecha_fin, estado, distancia_km, tonelaje_requerido, tipo_grua_requerida,
         viajes_movilizacion_total, notas_tecnicas, tareas_total, tareas_hechas, tareas_unidad,
         gruas, camiones, remolques, operarios)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        id, b.titulo, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.ubicacion), str(b.ubicacion_maps_url),
        fromInputLocal(b.fecha_inicio), fromInputLocal(b.fecha_fin), b.estado || "pendiente",
        num(b.distancia_km), num(b.tonelaje_requerido), str(b.tipo_grua_requerida),
        num(b.viajes_movilizacion_total), str(b.notas_tecnicas), num(b.tareas_total), num(b.tareas_hechas), str(b.tareas_unidad),
        json(arr(b.gruas)), json(arr(b.camiones)), json(arr(b.remolques)), json(arr(b.operarios)),
      ]
    );
    res.redirect("/trabajos");
  } catch (err) {
    next(err);
  }
});

router.get("/:id/editar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM jobs WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Trabajo no encontrado");
    const j = rows[0];
    const groups = await loadResourceGroups();
    res.render("trabajo-form", {
      j, isNew: false, groups,
      selected: {
        gruas: j.gruas || [], camiones: j.camiones || [],
        remolques: j.remolques || [], operarios: j.operarios || [],
      },
      toInputLocal,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query(
      `UPDATE jobs SET titulo=$2, cliente=$3, solicitante=$4, solicitante_contacto=$5, ubicacion=$6, ubicacion_maps_url=$7,
         fecha_inicio=$8, fecha_fin=$9, estado=$10, distancia_km=$11, tonelaje_requerido=$12, tipo_grua_requerida=$13,
         viajes_movilizacion_total=$14, notas_tecnicas=$15, tareas_total=$16, tareas_hechas=$17, tareas_unidad=$18,
         gruas=$19, camiones=$20, remolques=$21, operarios=$22, updated_at=now()
       WHERE id=$1`,
      [
        req.params.id, b.titulo, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.ubicacion), str(b.ubicacion_maps_url),
        fromInputLocal(b.fecha_inicio), fromInputLocal(b.fecha_fin), b.estado || "pendiente",
        num(b.distancia_km), num(b.tonelaje_requerido), str(b.tipo_grua_requerida),
        num(b.viajes_movilizacion_total), str(b.notas_tecnicas), num(b.tareas_total), num(b.tareas_hechas), str(b.tareas_unidad),
        json(arr(b.gruas)), json(arr(b.camiones)), json(arr(b.remolques)), json(arr(b.operarios)),
      ]
    );
    res.redirect("/trabajos");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM jobs WHERE id=$1", [req.params.id]);
    res.redirect("/trabajos");
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// Subir / bajar un trabajo activo en la lista de prioridades.
router.post("/:id/mover", requireAuth, async (req, res, next) => {
  try {
    const dir = req.body.dir === "up" ? -1 : 1;
    const { rows } = await db.query(
      "SELECT id FROM jobs WHERE estado IN ('pendiente','en_curso') ORDER BY orden ASC NULLS LAST, fecha_inicio ASC, id"
    );
    const ids = rows.map(r => r.id);
    const i = ids.indexOf(req.params.id);
    const k = i + dir;
    if (i >= 0 && k >= 0 && k < ids.length) {
      [ids[i], ids[k]] = [ids[k], ids[i]];
    }
    for (let n = 0; n < ids.length; n++) {
      await db.query("UPDATE jobs SET orden=$2 WHERE id=$1", [ids[n], n + 1]);
    }
    res.redirect("/trabajos#t-" + req.params.id);
  } catch (err) {
    next(err);
  }
});
