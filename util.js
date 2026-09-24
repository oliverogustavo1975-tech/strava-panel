const TZ = process.env.TZ_APP || 'America/Montevideo';

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
function mondayOf(iso) {
  const dow = new Date(iso + 'T12:00:00Z').getUTCDay(); // 0 = domingo
  return addDays(iso, dow === 0 ? -6 : 1 - dow);
}
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic'];
function fmtDate(iso, withDay) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00Z');
  const s = `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
  return withDay ? `${DIAS[d.getUTCDay()]} ${s}` : s;
}
function dayName(iso) { return DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()]; }
function fmtDuration(sec) {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}′`;
}
function ago(ts) {
  if (!ts) return 'nunca';
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  if (min < 1440) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function round(v, d = 0) { return v == null || isNaN(v) ? null : Number(Number(v).toFixed(d)); }
function initials(name) {
  return String(name || '?').split(/\s+/).filter((w) => /^\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

const SPORTS = {
  Ride: ['Ciclismo', '#5B9BFF'], VirtualRide: ['Rodillo / Zwift', '#8C7CF0'], MountainBikeRide: ['MTB', '#4FA3C7'], GravelRide: ['Gravel', '#4FA3C7'],
  EBikeRide: ['E-bike', '#4FA3C7'], Run: ['Running', '#F08A4B'], TrailRun: ['Trail', '#E0A04A'], VirtualRun: ['Cinta', '#F0A070'],
  Swim: ['Natación', '#3FC1C9'], OpenWaterSwim: ['Aguas abiertas', '#3FC1C9'], Walk: ['Caminata', '#9CCB6B'], Hike: ['Trekking', '#6FB36F'],
  WeightTraining: ['Fuerza', '#C98BD9'], Workout: ['Entrenamiento', '#B7C0CC'], Yoga: ['Yoga', '#B7C0CC'], Rowing: ['Remo', '#6FC3A8'],
};
const sportLabel = (t) => (SPORTS[t] ? SPORTS[t][0] : t || 'Otro');
const sportColor = (t) => (SPORTS[t] ? SPORTS[t][1] : '#B7C0CC');

module.exports = { sportLabel, sportColor, todayISO, addDays, daysBetween, mondayOf, fmtDate, dayName, fmtDuration, ago, esc, round, initials, TZ };
