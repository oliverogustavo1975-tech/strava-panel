const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const { migrate, q, one } = require('./db');
const api = require('./intervals');
const { syncAthlete, syncAll } = require('./sync');
const { loadAthleteData, summarize, project } = require('./metrics');
const coachV = require('./coach');
const athleteV = require('./athlete');
const bib = require('./biblioteca');
const { todayISO, addDays, mondayOf } = require('./util');

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || 'dev-secret-cambiar';
const PASSWORD = process.env.COACH_PASSWORD;
const SYNC_EVERY_MIN = Number(process.env.SYNC_EVERY_MIN || 120);

const app = express();
app.set('trust proxy', 1);
app.use('/vendor/leaflet', express.static(require('path').join(require.resolve('leaflet/package.json'), '..', 'dist'), { maxAge: '30d' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ---------- Sesión del coach: cookie firmada con HMAC ----------
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function readCookie(req, name) {
  const m = (req.headers.cookie || '').split(/;\s*/).find((c) => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
function isCoach(req) {
  const c = readCookie(req, 'hyt');
  if (!c) return false;
  const [v, sig] = c.split('.');
  if (!v || !sig || sig.length !== 64) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(v)));
  return ok && Date.now() - Number(v) < 1000 * 60 * 60 * 24 * 60; // 60 días
}
function requireCoach(req, res, next) {
  if (isCoach(req)) return next();
  res.redirect('/login');
}
const back = (res, url, msg) => res.redirect(url + (url.includes('?') ? '&' : '?') + 'msg=' + encodeURIComponent(msg));
const baseUrl = (req) => process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const unreadCount = () => one("SELECT count(*)::int AS n FROM messages WHERE sender='athlete' AND read_at IS NULL").then((r) => r.n);

// ---------- Login ----------
app.get('/', (req, res) => res.redirect(isCoach(req) ? '/coach' : '/login'));
app.get('/login', (req, res) => res.send(coachV.login(req.query.e)));
app.post('/login', (req, res) => {
  const pw = String(req.body.password || '');
  const ok = PASSWORD && pw.length === PASSWORD.length && crypto.timingSafeEqual(Buffer.from(pw), Buffer.from(PASSWORD));
  if (!ok) return res.redirect('/login?e=1');
  const v = String(Date.now());
  res.setHeader('Set-Cookie', `hyt=${v}.${sign(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 60}${req.secure ? '; Secure' : ''}`);
  res.redirect('/coach');
});
app.post('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'hyt=; Path=/; Max-Age=0');
  res.redirect('/login');
});

// ---------- Coach ----------
app.get('/coach', requireCoach, wrap(async (req, res) => {
  const athletes = await q('SELECT * FROM athletes WHERE active ORDER BY name');
  const rows = [];
  for (const a of athletes) rows.push({ a, s: summarize(a, await loadAthleteData(a, 50)) });
  rows.sort((x, y) => x.s.priority - y.s.priority);
  res.send(coachV.dashboard(rows, { unread: await unreadCount(), msg: req.query.msg }));
}));

app.get('/coach/atletas/nuevo', requireCoach, wrap(async (req, res) => res.send(coachV.newAthlete({ msg: req.query.msg, unread: await unreadCount() }))));

function athleteFields(body) {
  const clean = (v) => (String(v || '').trim() || null);
  let iid = clean(body.intervals_id);
  if (iid && /^\d+$/.test(iid)) iid = 'i' + iid;
  return { name: clean(body.name), sport: clean(body.sport) || 'Ciclismo', goal: clean(body.goal), goal_date: clean(body.goal_date), intervals_id: iid, notes: clean(body.notes) };
}

async function checkIntervals(iid) {
  if (!iid || !process.env.INTERVALS_API_KEY) return null;
  try { await api.athlete(iid); return null; } catch (e) {
    return e.status === 403 || e.status === 401 || e.status === 404
      ? 'Guardado, pero Intervals no da acceso a ese ID: revisá que el atleta te haya agregado como coach.'
      : 'Guardado, pero no se pudo verificar con Intervals ahora.';
  }
}

app.post('/coach/atletas', requireCoach, wrap(async (req, res) => {
  const f = athleteFields(req.body);
  if (!f.name) return back(res, '/coach/atletas/nuevo', '!Falta el nombre');
  if (f.intervals_id && await one('SELECT id FROM athletes WHERE intervals_id=$1', [f.intervals_id])) return back(res, '/coach/atletas/nuevo', '!Ese ID de Intervals ya está cargado');
  const a = await one(`INSERT INTO athletes (name, sport, goal, goal_date, intervals_id, notes, invite_token) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [f.name, f.sport, f.goal, f.goal_date, f.intervals_id, f.notes, crypto.randomBytes(18).toString('base64url')]);
  const warn = await checkIntervals(f.intervals_id);
  if (!warn && a.intervals_id) await syncAthlete(a);
  back(res, `/coach/atleta/${a.id}`, warn ? '!' + warn : 'Atleta creado' + (a.intervals_id ? ' y sincronizado' : ''));
}));

app.get('/coach/atleta/:id', requireCoach, wrap(async (req, res) => {
  const a = await one('SELECT * FROM athletes WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).send('No encontrado');
  const s = summarize(a, await loadAthleteData(a, 120));
  const proj = project(s, a.goal_date);
  const msgs = await q('SELECT * FROM messages WHERE athlete_id=$1 ORDER BY created_at DESC LIMIT 40', [a.id]);
  await q("UPDATE messages SET read_at=now() WHERE athlete_id=$1 AND sender='athlete' AND read_at IS NULL", [a.id]);
  res.send(coachV.athleteDetail(a, s, proj, msgs.reverse(), { msg: req.query.msg, baseUrl: baseUrl(req), unread: await unreadCount() }));
}));

app.post('/coach/atleta/:id', requireCoach, wrap(async (req, res) => {
  const f = athleteFields(req.body);
  if (!f.name) return back(res, `/coach/atleta/${req.params.id}`, '!Falta el nombre');
  const prev = await one('SELECT intervals_id FROM athletes WHERE id=$1', [req.params.id]);
  await q(`UPDATE athletes SET name=$2, sport=$3, goal=$4, goal_date=$5, intervals_id=$6, notes=$7, active=$8,
           last_sync_at = CASE WHEN intervals_id IS DISTINCT FROM $6 THEN NULL ELSE last_sync_at END WHERE id=$1`,
    [req.params.id, f.name, f.sport, f.goal, f.goal_date, f.intervals_id, f.notes, req.body.active === 'on']);
  let warn = null;
  if (prev && prev.intervals_id !== f.intervals_id) {
    warn = await checkIntervals(f.intervals_id);
    if (!warn && f.intervals_id) await syncAthlete(await one('SELECT * FROM athletes WHERE id=$1', [req.params.id]));
  }
  back(res, `/coach/atleta/${req.params.id}`, warn ? '!' + warn : 'Ficha guardada');
}));

app.get('/coach/actividad/:id', requireCoach, wrap(async (req, res) => {
  const act = await one('SELECT * FROM activities WHERE id=$1', [req.params.id]);
  if (!act) return res.status(404).send('No encontrada');
  const a = await one('SELECT * FROM athletes WHERE id=$1', [act.athlete_id]);
  let streams = [], streamError = false;
  if (process.env.INTERVALS_API_KEY && !String(act.ext_id).startsWith('demo')) {
    try { streams = await api.streams(act.ext_id, 'latlng,watts,heartrate,velocity_smooth,cadence,altitude,time'); } catch (e) { streamError = true; console.warn('[streams]', e.message); }
  }
  res.send(coachV.activityDetail(a, act, Array.isArray(streams) ? streams : [], { unread: await unreadCount(), streamError }));
}));

app.post('/coach/atleta/:id/sync', requireCoach, wrap(async (req, res) => {
  const a = await one('SELECT * FROM athletes WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).send('No encontrado');
  if (!process.env.INTERVALS_API_KEY) return back(res, `/coach/atleta/${a.id}`, '!Falta configurar INTERVALS_API_KEY');
  const r = await syncAthlete(a);
  back(res, `/coach/atleta/${a.id}`, r.ok ? `Sincronizado (${r.activities} actividades revisadas)` : r.skipped ? '!El atleta no tiene ID de Intervals' : '!' + r.error);
}));

app.post('/coach/atleta/:id/mensaje', requireCoach, wrap(async (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 4000);
  if (body) await q("INSERT INTO messages (athlete_id, sender, body) VALUES ($1,'coach',$2)", [req.params.id, body]);
  res.redirect(`/coach/atleta/${req.params.id}#body`);
}));

app.post('/coach/sync', requireCoach, wrap(async (req, res) => {
  if (!process.env.INTERVALS_API_KEY) return back(res, '/coach', '!Falta configurar INTERVALS_API_KEY');
  await syncAll();
  back(res, '/coach', 'Sincronización completa');
}));

app.get('/hyt-workout.js', (req, res) => res.type('application/javascript').sendFile(require('path').join(__dirname, 'workout.js')));

app.get('/coach/workouts/nuevo', requireCoach, wrap(async (req, res) => {
  const [athletes, folders] = await Promise.all([q('SELECT * FROM athletes WHERE active ORDER BY name'), q('SELECT * FROM folders ORDER BY name')]);
  const lib = req.query.lib ? await one('SELECT * FROM library WHERE id=$1', [req.query.lib]) : null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || '') ? req.query.fecha : null;
  res.send(bib.builder({ athletes, folders, lib, preselect: req.query.atleta, date, msg: req.query.msg, unread: await unreadCount() }));
}));

// ---------- Biblioteca ----------
app.get('/coach/biblioteca', requireCoach, wrap(async (req, res) => {
  const cur = req.query.carpeta ?? '';
  const folders = await q('SELECT * FROM folders ORDER BY name');
  const all = await q('SELECT l.*, f.name AS folder_name FROM library l LEFT JOIN folders f ON f.id = l.folder_id ORDER BY l.updated_at DESC');
  const counts = { all: all.length, 0: all.filter((w) => !w.folder_id).length };
  folders.forEach((f) => { counts[f.id] = all.filter((w) => w.folder_id === f.id).length; });
  const items = cur === '' ? all : cur === '0' ? all.filter((w) => !w.folder_id) : all.filter((w) => String(w.folder_id) === String(cur));
  res.send(bib.library({ folders, items, current: cur, counts, msg: req.query.msg, unread: await unreadCount() }));
}));
app.post('/coach/biblioteca', requireCoach, wrap(async (req, res) => {
  const { name, type, target, description } = req.body;
  const folder = req.body.folder_id ? Number(req.body.folder_id) : null;
  if (!String(name || '').trim() || !String(description || '').trim()) return back(res, '/coach/workouts/nuevo' + (req.body.lib_id ? '?lib=' + req.body.lib_id : ''), '!Poné un nombre y armá la estructura antes de guardar');
  let id = req.body.lib_id && !req.query.copia ? Number(req.body.lib_id) : null;
  if (id) await q('UPDATE library SET name=$2, type=$3, target=$4, description=$5, folder_id=$6, updated_at=now() WHERE id=$1', [id, name.trim(), type, target || 'power', description, folder]);
  else id = (await one('INSERT INTO library (name, type, target, description, folder_id) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name.trim(), type, target || 'power', description, folder])).id;
  back(res, '/coach/biblioteca' + (folder ? '?carpeta=' + folder : ''), `«${name.trim()}» guardado en la biblioteca`);
}));
app.post('/coach/biblioteca/carpetas', requireCoach, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return back(res, '/coach/biblioteca', '!Poné un nombre a la carpeta');
  const f = await one('INSERT INTO folders (name) VALUES ($1) RETURNING id', [name]);
  back(res, '/coach/biblioteca?carpeta=' + f.id, `Carpeta «${name}» creada`);
}));
app.post('/coach/biblioteca/carpetas/:id/borrar', requireCoach, wrap(async (req, res) => {
  await q('DELETE FROM folders WHERE id=$1', [req.params.id]);
  back(res, '/coach/biblioteca', 'Carpeta borrada; sus workouts quedaron en «Sin carpeta»');
}));
app.post('/coach/biblioteca/:id/borrar', requireCoach, wrap(async (req, res) => {
  await q('DELETE FROM library WHERE id=$1', [req.params.id]);
  back(res, '/coach/biblioteca', 'Workout borrado');
}));

// ---------- Semana del atleta ----------
app.get('/coach/atleta/:id/semana', requireCoach, wrap(async (req, res) => {
  const a = await one('SELECT * FROM athletes WHERE id=$1', [req.params.id]);
  if (!a) return res.status(404).send('No encontrado');
  const today = todayISO();
  const mon = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(req.query.d || '') ? req.query.d : today);
  const sun = addDays(mon, 6);
  const anchorDate = addDays(mon, -1) < today ? addDays(mon, -1) : addDays(today, -1);
  const anchorRow = await one('SELECT date, ctl, atl FROM wellness WHERE athlete_id=$1 AND date <= $2 AND ctl IS NOT NULL ORDER BY date DESC LIMIT 1', [a.id, anchorDate]);
  const from = addDays(anchorDate, 1);
  const [acts, plan, last28, lib] = await Promise.all([
    q('SELECT id, date, type, name, moving_time, load FROM activities WHERE athlete_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date', [a.id, from, sun]),
    q('SELECT * FROM planned WHERE athlete_id=$1 AND date BETWEEN $2 AND $3 ORDER BY date, id', [a.id, from, sun]),
    one('SELECT COALESCE(SUM(load),0) AS s FROM activities WHERE athlete_id=$1 AND date > $2 AND date <= $3', [a.id, addDays(today, -28), today]),
    q('SELECT l.*, f.name AS folder_name FROM library l LEFT JOIN folders f ON f.id = l.folder_id ORDER BY f.name NULLS FIRST, l.name'),
  ]);
  const days = [];
  for (let d = from; d <= sun; d = addDays(d, 1)) days.push({ date: d, acts: acts.filter((x) => x.date === d), plan: plan.filter((p) => p.date === d) });
  const anchor = anchorRow ? { date: anchorRow.date, ctl: anchorRow.ctl, atl: anchorRow.atl } : { ctl: null, atl: null };
  res.send(bib.week({ a, mon, days, anchor, avg4w: Number(last28.s) / 4, lib, msg: req.query.msg, unread: await unreadCount() }));
}));
app.post('/coach/atleta/:id/semana/enviar', requireCoach, wrap(async (req, res) => {
  const a = await one('SELECT * FROM athletes WHERE id=$1', [req.params.id]);
  const url = `/coach/atleta/${req.params.id}/semana?d=${encodeURIComponent(req.query.d || '')}`;
  if (!a || !a.intervals_id) return back(res, url, '!El atleta no está vinculado a Intervals');
  let sims = [];
  try { sims = JSON.parse(req.body.sims || '[]'); } catch (e) { sims = []; }
  let ok = 0, fail = 0;
  for (const s of sims.slice(0, 30)) {
    const w = await one('SELECT * FROM library WHERE id=$1', [s.lib_id]);
    if (!w || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) continue;
    try {
      const ev = await api.createEvent(a.intervals_id, { category: 'WORKOUT', start_date_local: `${s.date}T00:00:00`, type: w.type, name: w.name, description: w.description });
      await q(`INSERT INTO planned (athlete_id, ext_id, date, type, name, description, load) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (athlete_id, ext_id) DO NOTHING`,
        [a.id, String(ev.id), s.date, w.type, w.name, w.description, ev.icu_training_load ?? bib.estimate(w.description, w.type, a).tss]);
      ok++;
    } catch (e) { fail++; }
  }
  back(res, url, fail ? `!Enviados ${ok}, fallaron ${fail}` : `${ok} workout${ok === 1 ? '' : 's'} enviado${ok === 1 ? '' : 's'} al calendario de ${a.name.split(' ')[0]}`);
}));

app.post('/coach/workouts', requireCoach, wrap(async (req, res) => {
  const ids = [].concat(req.body.athletes || []);
  const { name, type, description, date } = req.body;
  if (!ids.length) return back(res, '/coach/workouts/nuevo', '!Elegí al menos un atleta');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return back(res, '/coach/workouts/nuevo', '!Fecha inválida');
  const ok = [], fail = [];
  for (const id of ids) {
    const a = await one('SELECT * FROM athletes WHERE id=$1 AND intervals_id IS NOT NULL', [id]);
    if (!a) continue;
    try {
      const ev = await api.createEvent(a.intervals_id, { category: 'WORKOUT', start_date_local: `${date}T00:00:00`, type, name, description });
      await q(`INSERT INTO planned (athlete_id, ext_id, date, type, name, description, load) VALUES ($1,$2,$3,$4,$5,$6,$7)
               ON CONFLICT (athlete_id, ext_id) DO NOTHING`, [a.id, String(ev.id), date, type, name, description, ev.icu_training_load ?? bib.estimate(description, type, a).tss]);
      ok.push(a.name.split(' ')[0]);
    } catch (e) { fail.push(`${a.name.split(' ')[0]} (${e.status || 'error'})`); }
  }
  back(res, '/coach/workouts/nuevo', fail.length ? `!Enviado a: ${ok.join(', ') || 'nadie'}. Falló: ${fail.join(', ')}` : `Enviado a ${ok.join(', ')} para el ${date}`);
}));

// ---------- Atleta (link personal, sin contraseña) ----------
async function athleteByToken(req, res, next) {
  const a = await one('SELECT * FROM athletes WHERE invite_token=$1 AND active', [req.params.token]).catch(() => null);
  if (!a) return res.status(404).send('Link no válido. Pedile uno nuevo a tu coach.');
  req.athlete = a;
  next();
}
app.get('/a/:token', wrap(athleteByToken), wrap(async (req, res) => {
  const a = req.athlete;
  res.send(athleteV.home(a, summarize(a, await loadAthleteData(a, 120)), { msg: req.query.msg }));
}));
app.get('/a/:token/mensajes', wrap(athleteByToken), wrap(async (req, res) => {
  const list = await q('SELECT * FROM messages WHERE athlete_id=$1 ORDER BY created_at DESC LIMIT 50', [req.athlete.id]);
  res.send(athleteV.messages(req.athlete, list.reverse(), { msg: req.query.msg }));
}));
app.post('/a/:token/mensajes', wrap(athleteByToken), wrap(async (req, res) => {
  const body = String(req.body.body || '').trim().slice(0, 4000);
  if (body) await q("INSERT INTO messages (athlete_id, sender, body) VALUES ($1,'athlete',$2)", [req.athlete.id, body]);
  res.redirect(`/a/${encodeURIComponent(req.params.token)}/mensajes`);
}));
app.get('/a/:token/conectar', wrap(athleteByToken), (req, res) => res.send(athleteV.connect(req.athlete, { msg: req.query.msg })));
app.post('/a/:token/fit', wrap(athleteByToken), upload.single('file'), wrap(async (req, res) => {
  const a = req.athlete, url = `/a/${encodeURIComponent(req.params.token)}/conectar`;
  if (!req.file || !a.intervals_id) return back(res, url, '!No se recibió el archivo');
  try {
    await api.uploadFile(a.intervals_id, req.file.buffer, req.file.originalname);
    await syncAthlete(a);
    back(res, url, 'Actividad subida. Tu coach ya la puede ver.');
  } catch (e) { back(res, url, '!No se pudo subir: ' + (e.status || 'error')); }
}));

app.get('/health', (req, res) => res.send('ok'));
app.use((err, req, res, next) => { console.error(err); res.status(500).send('Error interno'); });

(async () => {
  await migrate();
  if (!PASSWORD) console.warn('ATENCIÓN: falta COACH_PASSWORD; nadie puede ingresar como coach.');
  app.listen(PORT, () => console.log(`HyT escuchando en :${PORT}`));
  if (process.env.INTERVALS_API_KEY && SYNC_EVERY_MIN > 0) {
    setTimeout(() => syncAll().catch(console.error), 15000);
    setInterval(() => syncAll().catch(console.error), SYNC_EVERY_MIN * 60000);
  }
})();
