// Carga db/seed-data.json (extraído de Torre de Control, el artifact de
// Claude) en la base Postgres nueva. Es el punto de partida de datos reales
// para Torre — se puede volver a correr: hace upsert, no duplica filas.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const num = v => (v === null || v === undefined || v === "" ? null : Number(v));
const str = v => (v === null || v === undefined || v === "" ? null : String(v));
const dt = v => (v ? new Date(v) : null);
const bool = v => !!v;
const json = v => JSON.stringify(v ?? []);

async function main() {
  const raw = fs.readFileSync(path.join(__dirname, "seed-data.json"), "utf8");
  const data = JSON.parse(raw);
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    let n;

    n = 0;
    for (const { id, data: r } of data.resources || []) {
      await pool.query(
        `INSERT INTO resources (id, tipo, nombre, identificador, pais, estado_base,
           capacidad_ton, tara_ton, tipo_remolque, largo_m, especialidad,
           ubicacion_texto, ubicacion_maps_url, ubicacion_fecha,
           gps_fuente, gps_imei, gps_proveedor, gps_unidad, notas, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO UPDATE SET
           tipo=$2, nombre=$3, identificador=$4, pais=$5, estado_base=$6,
           capacidad_ton=$7, tara_ton=$8, tipo_remolque=$9, largo_m=$10, especialidad=$11,
           ubicacion_texto=$12, ubicacion_maps_url=$13, ubicacion_fecha=$14,
           gps_fuente=$15, gps_imei=$16, gps_proveedor=$17, gps_unidad=$18, notas=$19,
           updated_at=now()`,
        [
          id, r.tipo, r.nombre, str(r.identificador), str(r.pais) || null, r.estado_base || "activo",
          num(r.capacidad_ton), num(r.tara_ton), str(r.tipo_remolque), num(r.largo_m), str(r.especialidad),
          str(r.ubicacion_texto), str(r.ubicacion_maps_url), dt(r.ubicacion_fecha),
          str(r.gps_fuente), str(r.gps_imei), str(r.gps_proveedor), str(r.gps_unidad), str(r.notas),
          dt(r.created_at) || new Date(),
        ]
      );
      n++;
    }
    console.log(`resources: ${n}`);

    n = 0;
    for (const { id, data: j } of data.jobs || []) {
      await pool.query(
        `INSERT INTO jobs (id, titulo, cliente, solicitante, solicitante_contacto,
           ubicacion, ubicacion_maps_url, fecha_inicio, fecha_fin, estado,
           distancia_km, tonelaje_requerido, tipo_grua_requerida, viajes_movilizacion_total,
           notas_tecnicas, tareas_total, tareas_hechas, tareas_unidad,
           gruas, camiones, remolques, operarios, acoples, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
         ON CONFLICT (id) DO UPDATE SET
           titulo=$2, cliente=$3, solicitante=$4, solicitante_contacto=$5,
           ubicacion=$6, ubicacion_maps_url=$7, fecha_inicio=$8, fecha_fin=$9, estado=$10,
           distancia_km=$11, tonelaje_requerido=$12, tipo_grua_requerida=$13, viajes_movilizacion_total=$14,
           notas_tecnicas=$15, tareas_total=$16, tareas_hechas=$17, tareas_unidad=$18,
           gruas=$19, camiones=$20, remolques=$21, operarios=$22, acoples=$23,
           updated_at=now()`,
        [
          id, j.titulo, str(j.cliente), str(j.solicitante), str(j.solicitante_contacto),
          str(j.ubicacion), str(j.ubicacion_maps_url), dt(j.fecha_inicio), dt(j.fecha_fin), j.estado || "pendiente",
          num(j.distancia_km), num(j.tonelaje_requerido), str(j.tipo_grua_requerida), num(j.viajes_movilizacion_total),
          str(j.notas_tecnicas), num(j.tareas_total), num(j.tareas_hechas), str(j.tareas_unidad),
          json(j.gruas), json(j.camiones), json(j.remolques), json(j.operarios), json(j.acoples),
          dt(j.created_at) || new Date(),
        ]
      );
      n++;
    }
    console.log(`jobs: ${n}`);

    n = 0;
    for (const { id, data: f } of data.fletes || []) {
      await pool.query(
        `INSERT INTO fletes (id, cliente, solicitante, solicitante_contacto, componente, numero_serie, fecha,
           camion_id, remolque_id, chofer_id, trabajo_id,
           origen_texto, origen_maps_url, destino_texto, destino_maps_url,
           peso_carga_t, medida_ancho_m, medida_largo_m, necesita_grua, grua_id,
           distancia_km, viajes_movilizacion_total, fecha_llegada, llegada_nota,
           fotos, placa, remito, notas, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
         ON CONFLICT (id) DO UPDATE SET
           cliente=$2, solicitante=$3, solicitante_contacto=$4, componente=$5, numero_serie=$6, fecha=$7,
           camion_id=$8, remolque_id=$9, chofer_id=$10, trabajo_id=$11,
           origen_texto=$12, origen_maps_url=$13, destino_texto=$14, destino_maps_url=$15,
           peso_carga_t=$16, medida_ancho_m=$17, medida_largo_m=$18, necesita_grua=$19, grua_id=$20,
           distancia_km=$21, viajes_movilizacion_total=$22, fecha_llegada=$23, llegada_nota=$24,
           fotos=$25, placa=$26, remito=$27, notas=$28,
           updated_at=now()`,
        [
          id, str(f.cliente), str(f.solicitante), str(f.solicitante_contacto), str(f.componente), str(f.numero_serie), dt(f.fecha),
          str(f.camion_id), str(f.remolque_id), str(f.chofer_id), str(f.trabajo_id),
          str(f.origen_texto), str(f.origen_maps_url), str(f.destino_texto), str(f.destino_maps_url),
          num(f.peso_carga_t), num(f.medida_ancho_m), num(f.medida_largo_m), bool(f.necesita_grua), str(f.grua_id),
          num(f.distancia_km), num(f.viajes_movilizacion_total), dt(f.fecha_llegada), str(f.llegada_nota),
          json(f.fotos), json(f.placa), json(f.remito), str(f.notas),
          dt(f.created_at) || new Date(),
        ]
      );
      n++;
    }
    console.log(`fletes: ${n}`);

    n = 0;
    for (const { id, data: d0 } of data.deposito || []) {
      await pool.query(
        `INSERT INTO deposito (id, componente, numero_serie, cliente, fecha_ingreso, procedencia,
           fecha_egreso, destino, fotos, placa, notas, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET
           componente=$2, numero_serie=$3, cliente=$4, fecha_ingreso=$5, procedencia=$6,
           fecha_egreso=$7, destino=$8, fotos=$9, placa=$10, notas=$11,
           updated_at=now()`,
        [
          id, str(d0.componente), str(d0.numero_serie), str(d0.cliente), dt(d0.fecha_ingreso), str(d0.procedencia),
          dt(d0.fecha_egreso), str(d0.destino), json(d0.fotos), json(d0.placa), str(d0.notas),
          dt(d0.created_at) || new Date(),
        ]
      );
      n++;
    }
    console.log(`deposito: ${n}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Error al cargar datos:", err);
  process.exit(1);
});
