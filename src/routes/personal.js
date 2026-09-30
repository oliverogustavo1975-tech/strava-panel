const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const genId = () => crypto.randomBytes(10).toString("hex");
const str = v => (v === undefined || v === null || v === "" ? null : String(v));
const num = v => (v === undefined || v === null || v === "" ? 0 : Number(String(v).replace(",", ".")) || 0);

function hoyUY() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

async function loadOptions() {
  const [{ rows: personas }, { rows: jobs }, { rows: fletes }] = await Promise.all([
    db.query("SELECT id, nombre FROM resources WHERE tipo='operario' ORDER BY nombre"),
    db.query("SELECT id, titulo FROM jobs ORDER BY fecha_inicio DESC NULLS LAST"),
    db.query("SELECT id, componente, cliente FROM fletes ORDER BY fecha DESC NULLS LAST, created_at DESC LIMIT 200"),
  ]);
  return { personas, jobs, fletes };
}

router.get("/", async (req, res, next) => {
  try {
    let mes = /^\d{4}-\d{2}$/.test(req.query.mes || "") ? req.query.mes : hoyUY().slice(0, 7);
    const desde = mes + "-01";
    const persona = req.query.persona || "";
    const params = [desde];
    let filtroP = "";
    if (persona) { params.push(persona); filtroP = " AND h.persona_id=$2"; }
    const base = `FROM horas h
      LEFT JOIN resources r ON r.id=h.persona_id
      LEFT JOIN jobs j ON j.id=h.trabajo_id
      LEFT JOIN fletes f ON f.id=h.flete_id
      WHERE h.fecha >= $1::date AND h.fecha < ($1::date + interval '1 month')${filtroP}`;
    const [{ rows: registros }, { rows: porPersona }, { rows: porTrabajo }, opts] = await Promise.all([
      db.query(`SELECT h.*, to_char(h.fecha,'YYYY-MM-DD') AS fecha_s, r.nombre AS persona, j.titulo AS trabajo, f.componente AS flete ${base} ORDER BY h.fecha DESC, r.nombre`, params),
      db.query(`SELECT COALESCE(r.nombre,'(borrado)') AS persona, COUNT(DISTINCT h.fecha)::int AS dias, SUM(h.horas)::float AS horas, SUM(h.horas_extra)::float AS extra ${base} GROUP BY 1 ORDER BY 1`, params),
      db.query(`SELECT COALESCE(j.titulo, f.componente, 'Sin asignar') AS destino, SUM(h.horas + h.horas_extra)::float AS total ${base} GROUP BY 1 ORDER BY 2 DESC`, params),
      loadOptions(),
    ]);
    const tot = porPersona.reduce((a, p) => ({ dias: a.dias + p.dias, horas: a.horas + p.horas, extra: a.extra + p.extra }), { dias: 0, horas: 0, extra: 0 });
    res.render("personal", { mes, persona, registros, porPersona, porTrabajo, tot, personas: opts.personas, generatedAt: new Date() });
  } catch (err) { next(err); }
});

router.get("/nuevo", requireAuth, async (req, res, next) => {
  try {
    const opts = await loadOptions();
    res.render("personal-form", { h: { fecha_s: req.query.fecha || hoyUY(), persona_id: req.query.persona || "" }, isNew: true, ...opts });
  } catch (err) { next(err); }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query(
      "INSERT INTO horas (id, persona_id, fecha, horas, horas_extra, trabajo_id, flete_id, notas) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [genId(), b.persona_id, b.fecha, num(b.horas), num(b.horas_extra), str(b.trabajo_id), str(b.flete_id), str(b.notas)]
    );
    res.redirect("/personal?mes=" + String(b.fecha).slice(0, 7));
  } catch (err) { next(err); }
});

router.get("/:id/editar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT *, to_char(fecha,'YYYY-MM-DD') AS fecha_s FROM horas WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Registro no encontrado");
    const opts = await loadOptions();
    res.render("personal-form", { h: rows[0], isNew: false, ...opts });
  } catch (err) { next(err); }
});

router.post("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query(
      "UPDATE horas SET persona_id=$2, fecha=$3, horas=$4, horas_extra=$5, trabajo_id=$6, flete_id=$7, notas=$8, updated_at=now() WHERE id=$1",
      [req.params.id, b.persona_id, b.fecha, num(b.horas), num(b.horas_extra), str(b.trabajo_id), str(b.flete_id), str(b.notas)]
    );
    res.redirect("/personal?mes=" + String(b.fecha).slice(0, 7));
  } catch (err) { next(err); }
});

router.post("/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM horas WHERE id=$1", [req.params.id]);
    res.redirect("/personal");
  } catch (err) { next(err); }
});

module.exports = router;
