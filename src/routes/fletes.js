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

// Sincroniza el depósito con el flete (dentro de una transacción):
//  - a_deposito + fecha_llegada  -> la pieza ENTRA al depósito (una sola vez)
//  - sin llegada / sin a_deposito -> se retira ese ingreso si aún no salió
//  - desde_deposito_id + fecha    -> la pieza SALE (baja) con fecha del flete
//  - se quita el vínculo          -> se revierte la baja
async function syncDeposito(c, fleteId) {
  const { rows } = await c.query("SELECT * FROM fletes WHERE id=$1", [fleteId]);
  const f = rows[0];
  if (!f) return;

  // Ingreso
  if (f.a_deposito && f.fecha_llegada) {
    if (f.deposito_ingreso_id) {
      await c.query(
        `UPDATE deposito SET componente=$2, numero_serie=$3, cliente=$4, fecha_ingreso=$5, procedencia=$6, updated_at=now()
         WHERE id=$1`,
        [f.deposito_ingreso_id, f.componente, f.numero_serie, f.cliente, f.fecha_llegada, f.origen_texto]
      );
    } else {
      const did = genId();
      await c.query(
        `INSERT INTO deposito (id, componente, numero_serie, cliente, fecha_ingreso, procedencia, flete_ingreso_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [did, f.componente, f.numero_serie, f.cliente, f.fecha_llegada, f.origen_texto, f.id]
      );
      await c.query("UPDATE fletes SET deposito_ingreso_id=$2 WHERE id=$1", [f.id, did]);
    }
  } else if (f.deposito_ingreso_id) {
    await c.query("DELETE FROM deposito WHERE id=$1 AND fecha_egreso IS NULL", [f.deposito_ingreso_id]);
    await c.query("UPDATE fletes SET deposito_ingreso_id=NULL WHERE id=$1", [f.id]);
  }

  // Egreso: revertir cualquier baja anterior de este flete y aplicar la vigente
  await c.query(
    "UPDATE deposito SET fecha_egreso=NULL, destino=NULL, flete_egreso_id=NULL, updated_at=now() WHERE flete_egreso_id=$1 AND id IS DISTINCT FROM $2",
    [f.id, f.desde_deposito_id]
  );
  if (f.desde_deposito_id && f.fecha) {
    await c.query(
      "UPDATE deposito SET fecha_egreso=$2, destino=$3, flete_egreso_id=$4, updated_at=now() WHERE id=$1",
      [f.desde_deposito_id, f.fecha, f.destino_texto, f.id]
    );
  } else if (f.desde_deposito_id) {
    await c.query(
      "UPDATE deposito SET fecha_egreso=NULL, destino=NULL, flete_egreso_id=NULL, updated_at=now() WHERE id=$1 AND flete_egreso_id=$2",
      [f.desde_deposito_id, f.id]
    );
  }
}

async function withTx(fn) {
  const c = await db.pool.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

async function loadOptions(fleteId) {
  const [{ rows: resources }, { rows: jobs }, { rows: depositoItems }] = await Promise.all([
    db.query("SELECT id, tipo, nombre, identificador FROM resources ORDER BY nombre"),
    db.query("SELECT id, titulo FROM jobs ORDER BY fecha_inicio DESC"),
    db.query(
      "SELECT id, componente, numero_serie, cliente FROM deposito WHERE fecha_egreso IS NULL OR flete_egreso_id=$1 ORDER BY componente",
      [fleteId || ""]
    ),
  ]);
  const groups = { grua: [], camion: [], remolque: [], operario: [] };
  for (const r of resources) if (groups[r.tipo]) groups[r.tipo].push(r);
  return { groups, jobs, depositoItems };
}

router.get("/nuevo", requireAuth, async (req, res, next) => {
  try {
    const { groups, jobs, depositoItems } = await loadOptions();
    let f = {};
    if (req.query.copiar) {
      // Duplicar un flete: se copia todo menos fechas, llegada y vínculos de depósito
      const { rows } = await db.query("SELECT * FROM fletes WHERE id=$1", [req.query.copiar]);
      if (rows[0]) {
        f = { ...rows[0], id: undefined, fecha: null, fecha_llegada: null, llegada_nota: null,
              a_deposito: false, deposito_ingreso_id: null, desde_deposito_id: null,
              km_recorridos: null, combustible_litros: null, combustible_costo: null };
      }
    } else if (req.query.desde_deposito) {
      // Crear un flete a partir de una pieza del depósito
      const { rows } = await db.query("SELECT * FROM deposito WHERE id=$1", [req.query.desde_deposito]);
      const d = rows[0];
      if (d) {
        f = { componente: d.componente, numero_serie: d.numero_serie, cliente: d.cliente,
              origen_texto: "Depósito", notas: d.notas, desde_deposito_id: d.id };
      }
    }
    res.render("flete-form", { f, isNew: true, groups, jobs, depositoItems, toInputLocal });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const id = genId();
    await withTx(async c => {
    await c.query(
      `INSERT INTO fletes (id, cliente, solicitante, solicitante_contacto, componente, numero_serie, fecha,
         camion_id, remolque_id, chofer_id, trabajo_id, origen_texto, origen_maps_url, destino_texto, destino_maps_url,
         peso_carga_t, medida_ancho_m, medida_largo_m, necesita_grua, grua_id, distancia_km, viajes_movilizacion_total,
         fecha_llegada, llegada_nota, notas, a_deposito, desde_deposito_id, km_recorridos, combustible_litros, combustible_costo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
      [
        id, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.componente), str(b.numero_serie), fromInputLocal(b.fecha),
        str(b.camion_id), str(b.remolque_id), str(b.chofer_id), str(b.trabajo_id), str(b.origen_texto), str(b.origen_maps_url), str(b.destino_texto), str(b.destino_maps_url),
        num(b.peso_carga_t), num(b.medida_ancho_m), num(b.medida_largo_m), bool(b.necesita_grua), str(b.grua_id), num(b.distancia_km), num(b.viajes_movilizacion_total),
        fromInputLocal(b.fecha_llegada), str(b.llegada_nota), str(b.notas), bool(b.a_deposito), str(b.desde_deposito_id), num(b.km_recorridos), num(b.combustible_litros), num(b.combustible_costo),
      ]
    );
    await syncDeposito(c, id);
    });
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

router.get("/:id/editar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM fletes WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Flete no encontrado");
    const { groups, jobs, depositoItems } = await loadOptions(req.params.id);
    res.render("flete-form", { f: rows[0], isNew: false, groups, jobs, depositoItems, toInputLocal });
  } catch (err) {
    next(err);
  }
});

router.post("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await withTx(async c => {
    await c.query(
      `UPDATE fletes SET cliente=$2, solicitante=$3, solicitante_contacto=$4, componente=$5, numero_serie=$6, fecha=$7,
         camion_id=$8, remolque_id=$9, chofer_id=$10, trabajo_id=$11, origen_texto=$12, origen_maps_url=$13, destino_texto=$14, destino_maps_url=$15,
         peso_carga_t=$16, medida_ancho_m=$17, medida_largo_m=$18, necesita_grua=$19, grua_id=$20, distancia_km=$21, viajes_movilizacion_total=$22,
         fecha_llegada=$23, llegada_nota=$24, notas=$25, a_deposito=$26, desde_deposito_id=$27, km_recorridos=$28, combustible_litros=$29, combustible_costo=$30, updated_at=now()
       WHERE id=$1`,
      [
        req.params.id, str(b.cliente), str(b.solicitante), str(b.solicitante_contacto), str(b.componente), str(b.numero_serie), fromInputLocal(b.fecha),
        str(b.camion_id), str(b.remolque_id), str(b.chofer_id), str(b.trabajo_id), str(b.origen_texto), str(b.origen_maps_url), str(b.destino_texto), str(b.destino_maps_url),
        num(b.peso_carga_t), num(b.medida_ancho_m), num(b.medida_largo_m), bool(b.necesita_grua), str(b.grua_id), num(b.distancia_km), num(b.viajes_movilizacion_total),
        fromInputLocal(b.fecha_llegada), str(b.llegada_nota), str(b.notas), bool(b.a_deposito), str(b.desde_deposito_id), num(b.km_recorridos), num(b.combustible_litros), num(b.combustible_costo),
      ]
    );
    await syncDeposito(c, req.params.id);
    });
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

// Copiar un flete al depósito (crea la pieza con los mismos datos, sin vínculo automático)
router.post("/:id/copiar-deposito", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM fletes WHERE id=$1", [req.params.id]);
    const f = rows[0];
    if (!f) return res.status(404).send("Flete no encontrado");
    if (!f.deposito_ingreso_id) {
      await db.query(
        `INSERT INTO deposito (id, componente, numero_serie, cliente, fecha_ingreso, procedencia, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [genId(), f.componente, f.numero_serie, f.cliente, f.fecha_llegada || new Date(), f.origen_texto, f.notas]
      );
    }
    res.redirect("/deposito");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await withTx(async c => {
      await c.query("UPDATE deposito SET fecha_egreso=NULL, destino=NULL, flete_egreso_id=NULL WHERE flete_egreso_id=$1", [req.params.id]);
      await c.query("DELETE FROM deposito WHERE flete_ingreso_id=$1 AND fecha_egreso IS NULL", [req.params.id]);
      await c.query("DELETE FROM fletes WHERE id=$1", [req.params.id]);
    });
    res.redirect("/fletes");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
