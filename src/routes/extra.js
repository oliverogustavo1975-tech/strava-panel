// Páginas nuevas: Inicio (tablero), Costos, Mantenimiento/vencimientos y Calculadora.
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");
const { resourceStatus } = require("../lib/status");

const genId = () => crypto.randomBytes(10).toString("hex");
const str = v => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const numN = v => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const hoyUY = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mesDe = q => (/^\d{4}-\d{2}$/.test(q || "") ? q : hoyUY().slice(0, 7));
const N = v => (v === null || v === undefined ? 0 : Number(v));
const fmt = (v, d = 0) => Number(v || 0).toLocaleString("es-UY", { minimumFractionDigits: d, maximumFractionDigits: d });

async function factorExtra() {
  const { rows } = await db.query("SELECT valor FROM config WHERE clave='factor_extra'");
  const f = rows[0] ? Number(rows[0].valor) : 2;
  return Number.isFinite(f) && f > 0 ? f : 2;
}

/* ---------------- INICIO ---------------- */
router.get("/inicio", async (req, res, next) => {
  try {
    const hoy = hoyUY();
    const mes = hoy.slice(0, 7);
    const [{ rows: resources }, { rows: jobs }, { rows: fletes }, { rows: dep }, { rows: venc }, { rows: horasMes }] = await Promise.all([
      db.query("SELECT * FROM resources"),
      db.query("SELECT * FROM jobs WHERE estado <> 'cancelado'"),
      db.query("SELECT f.*, to_char(f.fecha AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') AS dia FROM fletes f"),
      db.query("SELECT id FROM deposito WHERE fecha_egreso IS NULL"),
      db.query(`SELECT v.*, to_char(v.fecha,'YYYY-MM-DD') AS fecha_s, r.nombre AS recurso, (v.fecha - $1::date) AS dias
                FROM vencimientos v LEFT JOIN resources r ON r.id=v.recurso_id
                WHERE v.fecha <= ($1::date + 30) ORDER BY v.fecha LIMIT 8`, [hoy]),
      db.query(`SELECT COALESCE(SUM(horas),0)::float AS h, COALESCE(SUM(horas_extra),0)::float AS e, COUNT(DISTINCT fecha)::int AS dias
                FROM horas WHERE fecha >= ($1||'-01')::date AND fecha < (($1||'-01')::date + interval '1 month')`, [mes]),
    ]);
    const nameMap = {}; resources.forEach(r => (nameMap[r.id] = r.nombre));
    const st = resources.map(r => ({ r, s: resourceStatus(r, jobs) }));
    const cuenta = t => {
      const l = st.filter(x => x.r.tipo === t);
      return { total: l.length, libres: l.filter(x => x.s.code === "disponible").length, ocupados: l.filter(x => x.s.code === "ocupado").length, fuera: l.filter(x => x.s.code === "mantenimiento" || x.s.code === "baja").length };
    };
    const ahora = new Date();
    const trabajosHoy = jobs.filter(j => {
      if (j.estado === "finalizado") return false;
      const s = new Date(j.fecha_inicio), e = j.fecha_fin ? new Date(j.fecha_fin) : null;
      return s <= new Date(ahora.getTime() + 24 * 3600 * 1000) && (!e || e >= ahora);
    });
    const fletesHoy = fletes.filter(f => f.dia === hoy);
    const enEspera = fletes.filter(f => !f.fecha).length;
    const enCamino = fletes.filter(f => f.fecha && !f.fecha_llegada).length;
    res.render("inicio", {
      titulo: "Inicio", tag: "Tablero del día", activo: "inicio", ruta: "/inicio",
      hoy, cuentas: { grua: cuenta("grua"), camion: cuenta("camion"), remolque: cuenta("remolque"), operario: cuenta("operario") },
      trabajosHoy: trabajosHoy.map(j => ({ ...j, gruasN: (j.gruas || []).map(i => nameMap[i] || i), camionesN: (j.camiones || []).map(i => nameMap[i] || i) })),
      fletesHoy: fletesHoy.map(f => ({ ...f, camionN: nameMap[f.camion_id] || null, choferN: nameMap[f.chofer_id] || null })),
      enEspera, enCamino, deposito: dep.length, venc, horasMes: horasMes[0],
    });
  } catch (e) { next(e); }
});

/* ---------------- COSTOS ---------------- */
router.get("/costos", async (req, res, next) => {
  try {
    const mes = mesDe(req.query.mes);
    const desde = mes + "-01";
    const factor = await factorExtra();
    const [{ rows: fletes }, { rows: jobs }, { rows: resources }, { rows: tarifas }, { rows: fin }, { rows: hFlete }, { rows: hTrab }, { rows: hMes }, { rows: jobsAll }, { rows: fletesJob }] = await Promise.all([
      db.query(`SELECT f.*, to_char(f.fecha AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') AS dia FROM fletes f
                WHERE (f.fecha AT TIME ZONE 'America/Montevideo')::date >= $1::date AND (f.fecha AT TIME ZONE 'America/Montevideo')::date < $1::date + interval '1 month'
                ORDER BY f.fecha`, [desde]),
      db.query(`SELECT * FROM jobs WHERE estado <> 'cancelado' AND fecha_inicio >= $1::date AND fecha_inicio < $1::date + interval '1 month' ORDER BY fecha_inicio`, [desde]),
      db.query("SELECT * FROM resources ORDER BY nombre"),
      db.query("SELECT * FROM tarifas"),
      db.query("SELECT * FROM finanzas"),
      db.query(`SELECT h.flete_id AS k, SUM(h.horas*COALESCE(t.costo_hora,0) + h.horas_extra*COALESCE(t.costo_hora,0)*$1)::float AS costo
                FROM horas h LEFT JOIN tarifas t ON t.recurso_id=h.persona_id WHERE h.flete_id IS NOT NULL GROUP BY 1`, [factor]),
      db.query(`SELECT h.trabajo_id AS k, SUM(h.horas*COALESCE(t.costo_hora,0) + h.horas_extra*COALESCE(t.costo_hora,0)*$1)::float AS costo
                FROM horas h LEFT JOIN tarifas t ON t.recurso_id=h.persona_id WHERE h.trabajo_id IS NOT NULL GROUP BY 1`, [factor]),
      db.query(`SELECT COALESCE(SUM(h.horas*COALESCE(t.costo_hora,0) + h.horas_extra*COALESCE(t.costo_hora,0)*$2),0)::float AS costo,
                       COALESCE(SUM(h.horas+h.horas_extra),0)::float AS horas
                FROM horas h LEFT JOIN tarifas t ON t.recurso_id=h.persona_id
                WHERE h.fecha >= $1::date AND h.fecha < $1::date + interval '1 month'`, [desde, factor]),
      db.query("SELECT id, fecha_inicio, fecha_fin, estado, gruas, camiones FROM jobs WHERE estado <> 'cancelado'"),
      db.query("SELECT id, trabajo_id, camion_id, km_recorridos, combustible_costo FROM fletes WHERE trabajo_id IS NOT NULL"),
    ]);
    const nameMap = {}; resources.forEach(r => (nameMap[r.id] = r.nombre));
    const tar = {}; tarifas.forEach(t => (tar[t.recurso_id] = t));
    const finF = {}, finT = {};
    fin.forEach(f => (f.tipo === "flete" ? finF : finT)[f.ref_id] = f);
    const hF = {}; hFlete.forEach(h => (hF[h.k] = h.costo));
    const hT = {}; hTrab.forEach(h => (hT[h.k] = h.costo));

    const costoFlete = f => {
      const costoKm = N(tar[f.camion_id] && tar[f.camion_id].costo_km);
      const comb = N(f.combustible_costo);
      const desgaste = N(f.km_recorridos) * costoKm;
      const personal = hF[f.id] || 0;
      const otros = N(finF[f.id] && finF[f.id].otros_gastos);
      return { comb, desgaste, personal, otros, total: comb + desgaste + personal + otros };
    };
    const filasF = fletes.map(f => {
      const c = costoFlete(f);
      const precio = finF[f.id] && finF[f.id].precio !== null ? Number(finF[f.id].precio) : null;
      return { f, c, precio, margen: precio === null ? null : precio - c.total, camionN: nameMap[f.camion_id] || "—", otros: finF[f.id] ? finF[f.id].otros_gastos : null };
    });
    const filasJ = jobs.map(j => {
      const fj = fletesJob.filter(x => x.trabajo_id === j.id);
      const combF = fj.reduce((a, x) => a + N(x.combustible_costo) + N(x.km_recorridos) * N(tar[x.camion_id] && tar[x.camion_id].costo_km) + (hF[x.id] || 0), 0);
      const personal = hT[j.id] || 0;
      const otros = N(finT[j.id] && finT[j.id].otros_gastos);
      const total = combF + personal + otros;
      const precio = finT[j.id] && finT[j.id].precio !== null ? Number(finT[j.id].precio) : null;
      return { j, fletes: fj.length, combF, personal, otros, total, precio, margen: precio === null ? null : precio - total, otrosRaw: finT[j.id] ? finT[j.id].otros_gastos : null };
    });

    // por camión (consumo)
    const porCamion = {};
    fletes.forEach(f => {
      if (!f.camion_id) return;
      const p = (porCamion[f.camion_id] = porCamion[f.camion_id] || { nombre: nameMap[f.camion_id] || f.camion_id, fletes: 0, km: 0, litros: 0, costo: 0, kmCons: 0, litCons: 0 });
      p.fletes++; p.km += N(f.km_recorridos); p.litros += N(f.combustible_litros); p.costo += N(f.combustible_costo);
      if (N(f.km_recorridos) > 0 && N(f.combustible_litros) > 0) { p.kmCons += N(f.km_recorridos); p.litCons += N(f.combustible_litros); }
    });
    const camiones = Object.values(porCamion).map(p => ({ ...p, l100: p.kmCons ? (p.litCons / p.kmCons) * 100 : null, costoKm: p.km ? p.costo / p.km : null }));

    // utilización del mes (grúas y camiones)
    const [y, m] = mes.split("-").map(Number);
    const diasMes = new Date(y, m, 0).getDate();
    const util = {};
    const marca = (id, d) => { (util[id] = util[id] || new Set()).add(d); };
    jobsAll.forEach(j => {
      const s = new Date(j.fecha_inicio), e = j.fecha_fin ? new Date(j.fecha_fin) : new Date(y, m, 0, 23, 59);
      for (let d = 1; d <= diasMes; d++) {
        const ini = new Date(y, m - 1, d), fin2 = new Date(y, m - 1, d, 23, 59, 59);
        if (s <= fin2 && e >= ini) [...(j.gruas || []), ...(j.camiones || [])].forEach(id => marca(id, d));
      }
    });
    const fletesMesCam = fletes.filter(f => f.camion_id);
    fletesMesCam.forEach(f => marca(f.camion_id, Number(f.dia.slice(8))));
    const utilFilas = resources.filter(r => r.tipo === "grua" || r.tipo === "camion").map(r => ({ r, dias: (util[r.id] || new Set()).size, pct: Math.round(((util[r.id] || new Set()).size / diasMes) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    const totales = {
      ingresos: filasF.reduce((a, x) => a + (x.precio || 0), 0) + filasJ.reduce((a, x) => a + (x.precio || 0), 0),
      costoFletes: filasF.reduce((a, x) => a + x.c.total, 0),
      costoTrabajos: filasJ.reduce((a, x) => a + x.total, 0),
      personal: hMes[0].costo, horas: hMes[0].horas,
    };
    const operarios = resources.filter(r => r.tipo === "operario"), vehiculos = resources.filter(r => r.tipo === "camion");
    res.render("costos", {
      titulo: "Costos", tag: "Costos, márgenes y consumo", activo: "costos", ruta: "/costos?mes=" + mes,
      mes, diasMes, factor, filasF, filasJ, camiones, utilFilas, totales, operarios, vehiculos, tar, fmt,
    });
  } catch (e) { next(e); }
});

router.post("/costos/finanzas", requireAuth, async (req, res, next) => {
  try {
    const tipo = req.body.tipo === "trabajo" ? "trabajo" : "flete";
    await db.query(
      `INSERT INTO finanzas (tipo, ref_id, precio, otros_gastos) VALUES ($1,$2,$3,$4)
       ON CONFLICT (tipo, ref_id) DO UPDATE SET precio=$3, otros_gastos=$4, updated_at=now()`,
      [tipo, req.body.ref_id, numN(req.body.precio), numN(req.body.otros_gastos)]);
    res.redirect("/costos?mes=" + mesDe(req.body.mes));
  } catch (e) { next(e); }
});
router.post("/costos/tarifa", requireAuth, async (req, res, next) => {
  try {
    await db.query(
      `INSERT INTO tarifas (recurso_id, costo_hora, costo_km) VALUES ($1,$2,$3)
       ON CONFLICT (recurso_id) DO UPDATE SET costo_hora=COALESCE($2, tarifas.costo_hora), costo_km=COALESCE($3, tarifas.costo_km), updated_at=now()`,
      [req.body.recurso_id, numN(req.body.costo_hora), numN(req.body.costo_km)]);
    res.redirect("/costos?mes=" + mesDe(req.body.mes) + "#tarifas");
  } catch (e) { next(e); }
});
router.post("/costos/config", requireAuth, async (req, res, next) => {
  try {
    const f = numN(req.body.factor_extra);
    if (f && f > 0) await db.query("INSERT INTO config (clave, valor) VALUES ('factor_extra',$1) ON CONFLICT (clave) DO UPDATE SET valor=$1", [String(f)]);
    res.redirect("/costos?mes=" + mesDe(req.body.mes) + "#tarifas");
  } catch (e) { next(e); }
});

/* ---------------- MANTENIMIENTO ---------------- */
router.get("/mantenimiento", async (req, res, next) => {
  try {
    const hoy = hoyUY();
    const [{ rows: recursos }, { rows: venc }, { rows: mant }, { rows: costoPor }] = await Promise.all([
      db.query("SELECT id, nombre, tipo FROM resources ORDER BY tipo, nombre"),
      db.query(`SELECT v.*, to_char(v.fecha,'YYYY-MM-DD') AS fecha_s, r.nombre AS recurso, (v.fecha - $1::date) AS dias
                FROM vencimientos v LEFT JOIN resources r ON r.id=v.recurso_id ORDER BY v.fecha`, [hoy]),
      db.query(`SELECT m.*, to_char(m.fecha,'YYYY-MM-DD') AS fecha_s, r.nombre AS recurso FROM mantenimientos m
                LEFT JOIN resources r ON r.id=m.recurso_id ORDER BY m.fecha DESC LIMIT 200`),
      db.query(`SELECT COALESCE(r.nombre,'(borrado)') AS recurso, COUNT(*)::int AS n, COALESCE(SUM(m.costo),0)::float AS costo
                FROM mantenimientos m LEFT JOIN resources r ON r.id=m.recurso_id GROUP BY 1 ORDER BY 3 DESC`),
    ]);
    res.render("mantenimiento", { titulo: "Mantenimiento", tag: "Vencimientos y services", activo: "mantenimiento", ruta: "/mantenimiento", recursos, venc, mant, costoPor, hoy, fmt });
  } catch (e) { next(e); }
});
router.post("/mantenimiento/venc", requireAuth, async (req, res, next) => {
  try {
    if (!str(req.body.concepto) || !str(req.body.fecha)) return res.redirect("/mantenimiento");
    await db.query("INSERT INTO vencimientos (id, recurso_id, concepto, fecha, notas) VALUES ($1,$2,$3,$4,$5)",
      [genId(), str(req.body.recurso_id), str(req.body.concepto), req.body.fecha, str(req.body.notas)]);
    res.redirect("/mantenimiento");
  } catch (e) { next(e); }
});
router.post("/mantenimiento/venc/:id/eliminar", requireAuth, async (req, res, next) => {
  try { await db.query("DELETE FROM vencimientos WHERE id=$1", [req.params.id]); res.redirect("/mantenimiento"); } catch (e) { next(e); }
});
router.post("/mantenimiento/service", requireAuth, async (req, res, next) => {
  try {
    if (!str(req.body.recurso_id) || !str(req.body.fecha)) return res.redirect("/mantenimiento");
    await db.query("INSERT INTO mantenimientos (id, recurso_id, fecha, tipo, km, costo, notas) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [genId(), req.body.recurso_id, req.body.fecha, str(req.body.tipo), numN(req.body.km), numN(req.body.costo), str(req.body.notas)]);
    res.redirect("/mantenimiento");
  } catch (e) { next(e); }
});
router.post("/mantenimiento/service/:id/eliminar", requireAuth, async (req, res, next) => {
  try { await db.query("DELETE FROM mantenimientos WHERE id=$1", [req.params.id]); res.redirect("/mantenimiento"); } catch (e) { next(e); }
});

/* ---------------- CALCULADORA ---------------- */
router.get("/calculadora", (req, res) => {
  res.render("calculadora", { titulo: "Calculadora", tag: "Cuentas rápidas de logística", activo: "calculadora", ruta: "/calculadora" });
});

module.exports = router;
