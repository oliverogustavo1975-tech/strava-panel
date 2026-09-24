const api = require('./intervals');
const { q } = require('./db');
const { todayISO, addDays } = require('./util');

const WELLNESS_DAYS = 120;          // curva de forma (sólo números diarios, liviano)
const ACTIVITY_DAYS_FIRST = Number(process.env.SYNC_DAYS_BACK || 42);
const ACTIVITY_DAYS_INCR = 10;
const PLAN_DAYS_AHEAD = 90;

const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

function sportSetting(settings, kinds) {
  const list = (settings && settings.sportSettings) || [];
  return list.find((s) => (s.types || []).some((t) => kinds.includes(t))) || null;
}
function paceToText(p) {
  // Intervals guarda threshold_pace en m/s
  const v = num(p);
  if (!v) return null;
  const secPerKm = 1000 / v;
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}/km`;
}

async function syncAthlete(a) {
  if (!a.intervals_id) return { skipped: true };
  const today = todayISO();
  try {
    // Umbrales
    const s = await api.athlete(a.intervals_id).catch(() => null);
    if (s) {
      const ride = sportSetting(s, ['Ride', 'VirtualRide']);
      const run = sportSetting(s, ['Run', 'VirtualRun']);
      await q('UPDATE athletes SET ftp = COALESCE($2, ftp), lthr = COALESCE($3, lthr), threshold_pace = COALESCE($4, threshold_pace) WHERE id = $1',
        [a.id, num(ride && ride.ftp), num((run || ride || {}).lthr), paceToText(run && run.threshold_pace)]);
    }

    // Wellness: CTL/ATL ya calculados por Intervals con TODO el historial del atleta
    const wel = await api.wellness(a.intervals_id, addDays(today, -WELLNESS_DAYS), today);
    for (const w of wel || []) {
      await q(`INSERT INTO wellness (athlete_id, date, ctl, atl, resting_hr, hrv, sleep_secs, weight)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (athlete_id, date) DO UPDATE SET ctl=$3, atl=$4, resting_hr=$5, hrv=$6, sleep_secs=$7, weight=$8`,
        [a.id, w.id, num(w.ctl), num(w.atl), num(w.restingHR), num(w.hrv), num(w.sleepSecs), num(w.weight)]);
    }

    // Actividades
    const first = !a.last_sync_at;
    const acts = await api.activities(a.intervals_id, addDays(today, -ACTIVITY_DAYS_FIRST), today);
    for (const x of acts || []) {
      if (!x || !x.id || !x.start_date_local) continue;
      await q(`INSERT INTO activities (athlete_id, ext_id, date, type, name, moving_time, distance, load, np, intensity, avg_hr, avg_power, device, raw)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
               ON CONFLICT (athlete_id, ext_id) DO UPDATE SET date=$3, type=$4, name=$5, moving_time=$6, distance=$7, load=$8, np=$9,
                 intensity=$10, avg_hr=$11, avg_power=$12, device=$13, raw=$14`,
        [a.id, String(x.id), x.start_date_local.slice(0, 10), x.type, x.name, num(x.moving_time), num(x.distance),
          num(x.icu_training_load), num(x.icu_weighted_avg_watts), num(x.icu_intensity), num(x.average_heartrate),
          num(x.icu_average_watts ?? x.average_watts), x.device_name || null, x]);
    }

    // Plan: eventos WORKOUT del calendario (los cargados desde HyT y los que cargues en Intervals)
    const evs = await api.events(a.intervals_id, addDays(today, -21), addDays(today, PLAN_DAYS_AHEAD));
    const seen = [];
    for (const e of evs || []) {
      if (!e || e.category !== 'WORKOUT' || !e.start_date_local) continue;
      seen.push(String(e.id));
      await q(`INSERT INTO planned (athlete_id, ext_id, date, type, name, description, load)
               VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (athlete_id, ext_id) DO UPDATE SET date=$3, type=$4, name=$5, description=$6, load=$7`,
        [a.id, String(e.id), e.start_date_local.slice(0, 10), e.type, e.name, e.description, num(e.icu_training_load)]);
    }
    // Borrar planificados que se eliminaron en Intervals (dentro de la ventana consultada)
    await q(`DELETE FROM planned WHERE athlete_id = $1 AND date BETWEEN $2 AND $3 AND NOT (ext_id = ANY($4))`,
      [a.id, addDays(today, -21), addDays(today, PLAN_DAYS_AHEAD), seen]);

    await q('UPDATE athletes SET last_sync_at = now(), last_sync_error = NULL WHERE id = $1', [a.id]);
    return { ok: true, activities: (acts || []).length };
  } catch (err) {
    await q('UPDATE athletes SET last_sync_error = $2 WHERE id = $1', [a.id, err.message.slice(0, 300)]);
    return { ok: false, error: err.message };
  }
}

async function syncAll() {
  if (!process.env.INTERVALS_API_KEY) return;
  const list = await q('SELECT * FROM athletes WHERE active AND intervals_id IS NOT NULL ORDER BY id');
  for (const a of list) {
    const r = await syncAthlete(a);
    if (r.ok === false) console.warn(`[sync] ${a.name}: ${r.error}`);
  }
  console.log(`[sync] ${list.length} atletas sincronizados`);
}

module.exports = { syncAthlete, syncAll };
