// Respaldo: descarga de los datos en CSV (se abre directo en Excel).
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const hoyUY = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

const EXPORTS = {
  fletes: {
    titulo: "Fletes",
    sql: `SELECT to_char(f.fecha AT TIME ZONE 'America/Montevideo','YYYY-MM-DD HH24:MI') AS fecha, f.cliente, f.componente, f.numero_serie,
                 c.nombre AS camion, r.nombre AS remolque, ch.nombre AS chofer, j.titulo AS trabajo,
                 f.origen_texto AS origen, f.destino_texto AS destino, f.peso_carga_t AS peso_t,
                 f.km_recorridos AS km, f.combustible_litros AS litros, f.combustible_costo AS costo_combustible,
                 to_char(f.fecha_llegada AT TIME ZONE 'America/Montevideo','YYYY-MM-DD HH24:MI') AS llegada,
                 fi.precio, fi.otros_gastos, f.notas
          FROM fletes f
          LEFT JOIN resources c ON c.id=f.camion_id LEFT JOIN resources r ON r.id=f.remolque_id LEFT JOIN resources ch ON ch.id=f.chofer_id
          LEFT JOIN jobs j ON j.id=f.trabajo_id LEFT JOIN finanzas fi ON fi.tipo='flete' AND fi.ref_id=f.id
          ORDER BY f.fecha DESC NULLS FIRST`,
  },
  trabajos: {
    titulo: "Trabajos",
    sql: `SELECT j.titulo, j.cliente, j.solicitante, j.ubicacion, j.estado,
                 to_char(j.fecha_inicio AT TIME ZONE 'America/Montevideo','YYYY-MM-DD HH24:MI') AS inicio,
                 to_char(j.fecha_fin AT TIME ZONE 'America/Montevideo','YYYY-MM-DD HH24:MI') AS fin,
                 j.distancia_km, j.tonelaje_requerido, j.notas_tecnicas, fi.precio, fi.otros_gastos
          FROM jobs j LEFT JOIN finanzas fi ON fi.tipo='trabajo' AND fi.ref_id=j.id ORDER BY j.fecha_inicio DESC`,
  },
  horas: {
    titulo: "Horas del personal",
    sql: `SELECT to_char(h.fecha,'YYYY-MM-DD') AS fecha, r.nombre AS persona, h.horas, h.horas_extra, j.titulo AS trabajo, f.componente AS flete, h.notas
          FROM horas h LEFT JOIN resources r ON r.id=h.persona_id LEFT JOIN jobs j ON j.id=h.trabajo_id LEFT JOIN fletes f ON f.id=h.flete_id
          ORDER BY h.fecha DESC, r.nombre`,
  },
  recursos: {
    titulo: "Recursos (grúas, camiones, remolques, personal)",
    sql: `SELECT r.tipo, r.nombre, r.identificador, r.pais, r.estado_base AS estado, r.capacidad_ton, r.tara_ton, r.especialidad,
                 r.ubicacion_texto AS ubicacion, t.costo_hora, t.costo_km, r.notas
          FROM resources r LEFT JOIN tarifas t ON t.recurso_id=r.id ORDER BY r.tipo, r.nombre`,
  },
  deposito: {
    titulo: "Depósito",
    sql: `SELECT componente, numero_serie, cliente, to_char(fecha_ingreso AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') AS ingreso,
                 to_char(fecha_egreso AT TIME ZONE 'America/Montevideo','YYYY-MM-DD') AS egreso, notas
          FROM deposito ORDER BY fecha_ingreso DESC NULLS LAST`,
  },
  mantenimiento: {
    titulo: "Services y reparaciones",
    sql: `SELECT to_char(m.fecha,'YYYY-MM-DD') AS fecha, r.nombre AS equipo, m.tipo AS trabajo, m.km, m.costo, m.notas
          FROM mantenimientos m LEFT JOIN resources r ON r.id=m.recurso_id ORDER BY m.fecha DESC`,
  },
  vencimientos: {
    titulo: "Vencimientos",
    sql: `SELECT to_char(v.fecha,'YYYY-MM-DD') AS vence, v.concepto, r.nombre AS equipo, v.notas
          FROM vencimientos v LEFT JOIN resources r ON r.id=v.recurso_id ORDER BY v.fecha`,
  },
};

function celda(v) {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas en Excel
  if (/[;"\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

router.get("/respaldo", (req, res) => {
  res.render("respaldo", { titulo: "Respaldo", tag: "Descargar tus datos a Excel", activo: "respaldo", ruta: "/respaldo", EXPORTS });
});

router.get("/respaldo/:que.csv", requireAuth, async (req, res, next) => {
  try {
    const def = EXPORTS[req.params.que];
    if (!def) return res.redirect("/respaldo");
    const { rows, fields } = await db.query(def.sql);
    const cols = fields.map(f => f.name);
    const lineas = [cols.join(";")].concat(rows.map(r => cols.map(c => celda(r[c])).join(";")));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="torre-${req.params.que}-${hoyUY()}.csv"`);
    res.send("﻿" + lineas.join("\r\n") + "\r\n");
  } catch (e) { next(e); }
});

module.exports = router;
