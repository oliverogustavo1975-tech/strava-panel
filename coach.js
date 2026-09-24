const { sportLabel, sportColor, esc, fmtDate, fmtDuration, ago, initials, round, daysBetween, todayISO, dayName } = require('./util');
const { sparkline, pmc } = require('./charts');
const { coachPage, barePage, icon } = require('./layout');

const signed = (v) => (v == null ? '—' : (v > 0 ? '+' : '') + Math.round(v));
const tsbColor = (t) => (t == null ? '#B7C0CC' : t <= -20 ? '#F2645A' : t < -5 ? '#F08A4B' : t <= 5 ? '#B7C0CC' : '#5B9BFF');
const compColor = (c) => (c >= 85 ? '#3FB68B' : c >= 70 ? '#E8B33A' : '#F2645A');
const dotColor = (l) => (l === 'high' ? '#F2645A' : '#E8B33A');
const SPORTS = ['Ciclismo', 'Running', 'Ciclismo y running', 'Triatlón', 'Natación', 'Trekking', 'Fitness', 'Otro'];
const goalDays = (today, d) => { const n = daysBetween(today, d); return n >= 0 ? `${n} días` : 'ya pasó'; };

function flash(msg) {
  if (!msg) return '';
  const err = msg.startsWith('!');
  return `<div class="flash ${err ? 'err' : ''}" role="status">${esc(err ? msg.slice(1) : msg)}</div>`;
}

function dashboard(rows, { unread, msg }) {
  const today = todayISO();
  const withPlan = rows.filter((r) => r.s.plan7 > 0);
  const compAll = withPlan.length ? Math.round((withPlan.reduce((s, r) => s + r.s.done7, 0) / withPlan.reduce((s, r) => s + r.s.plan7, 0)) * 100) : null;
  const weekDone = rows.reduce((s, r) => s + r.s.weekDone, 0), weekPlan = rows.reduce((s, r) => s + r.s.weekPlanned, 0);
  const alerts = rows.flatMap((r) => r.s.alerts.map((al) => ({ ...al, a: r.a }))).sort((x, y) => (x.level === 'high' ? 0 : 1) - (y.level === 'high' ? 0 : 1));
  const synced = rows.filter((r) => r.a.intervals_id && r.s.lastAct && daysBetween(r.s.lastAct.date, today) < 4).length;
  const linked = rows.filter((r) => r.a.intervals_id).length;
  const goals = rows.filter((r) => r.a.goal_date && r.a.goal_date >= today).sort((x, y) => (x.a.goal_date < y.a.goal_date ? -1 : 1)).slice(0, 5);

  const table = rows.map(({ a, s }) => `
    <a class="row" href="/coach/atleta/${a.id}">
      <div class="who"><span class="av">${esc(initials(a.name))}</span><div><span style="font-weight:500">${esc(a.name)}</span><small>${esc(a.sport)}${a.goal ? ' · ' + esc(a.goal) : ''}</small></div></div>
      <span class="hide">${sparkline(s.ctl42)}</span>
      <span class="num r">${s.ctl != null ? Math.round(s.ctl) : '—'}</span>
      <span class="num r" style="color:#F08A4B">${s.atl != null ? Math.round(s.atl) : '—'}</span>
      <span class="num r" style="font-weight:500;color:${tsbColor(s.tsb)}">${signed(s.tsb)}</span>
      <span class="hide" style="display:flex;align-items:center;gap:8px">${s.compliance != null
        ? `<span class="bar"><i style="width:${Math.min(100, s.compliance)}%;background:${compColor(s.compliance)}"></i></span><span class="num" style="width:40px;text-align:right">${s.compliance}%</span>`
        : '<span class="muted">sin plan</span>'}</span>
      <span class="hide" style="font-size:13px;color:#B7C0CC">${s.lastAct ? `${esc(s.lastAct.device || 'Actividad')} · ${fmtDate(s.lastAct.date)}` : a.intervals_id ? 'sin actividades' : 'no vinculado'}</span>
      <span class="pill t-${s.flag.tone}">${esc(s.flag.text)}</span>
    </a>`).join('');

  const body = `
  <header class="head"><div><div class="th">${fmtDate(today, true)} · ${rows.length} atletas</div><h1>Panel del coach</h1></div>
    <div class="right"><a class="btn ghost" href="/coach/atletas/nuevo">${icon.plus}Atleta</a><a class="btn" href="/coach/workouts/nuevo">${icon.plus}Nuevo workout</a></div></header>
  ${flash(msg)}
  <section class="kpis" aria-label="Indicadores">
    <div class="card kpi"><span class="th">Cumplimiento 7 días</span><span class="v num">${compAll != null ? compAll + '%' : '—'}</span><span class="muted">Carga realizada / planificada</span></div>
    <div class="card kpi"><span class="th">Carga de la semana</span><span class="v num">${Math.round(weekDone)}</span><span class="muted">de ${Math.round(weekPlan)} planificada (lun–dom)</span></div>
    <div class="card kpi ${alerts.some((x) => x.level === 'high') ? 'warn' : ''}"><span class="th">Alertas</span><span class="v num">${alerts.length}</span><span class="muted">${alerts.filter((x) => x.level === 'high').length} prioritarias</span></div>
    <div class="card kpi"><span class="th">Datos al día</span><span class="v num">${synced}/${linked}</span><span class="muted">con actividad en los últimos 3 días</span></div>
  </section>
  <div class="cols">
    <section class="card table grow" aria-label="Atletas">
      <div class="hd"><h2>Atletas</h2><span class="muted">ordenado por prioridad</span></div>
      <div class="row h"><span class="th">Atleta</span><span class="th hide">CTL 42 días</span><span class="th r">CTL</span><span class="th r">ATL</span><span class="th r">Forma</span><span class="th hide">Cumplimiento 7d</span><span class="th hide">Última actividad</span><span class="th">Estado</span></div>
      ${table || '<div style="padding:24px 20px" class="muted">Todavía no hay atletas. <a href="/coach/atletas/nuevo" style="color:#F08A4B">Agregá el primero</a>.</div>'}
    </section>
    <aside class="aside">
      <section class="card stack" aria-label="Alertas"><h2>Requiere tu atención</h2>
        ${alerts.length ? alerts.slice(0, 8).map((al) => `<a class="alert" href="/coach/atleta/${al.a.id}"><span class="dot" style="background:${dotColor(al.level)}"></span><div><span style="font-weight:500">${esc(al.a.name.split(' ')[0])} · ${esc(al.text)}</span><small>${esc(al.detail)}</small></div></a>`).join('') : '<span class="muted">Todo en orden.</span>'}
      </section>
      <section class="card stack" aria-label="Objetivos"><h2>Próximos objetivos</h2>
        ${goals.length ? goals.map(({ a }) => `<a href="/coach/atleta/${a.id}" style="display:flex;align-items:center;gap:14px"><div style="width:52px;text-align:center;border:1px solid #262E39;border-radius:8px;padding:6px 0"><div class="num" style="font-size:20px">${a.goal_date.slice(8)}</div><div class="th">${fmtDate(a.goal_date).split(' ')[1]}</div></div><div style="display:flex;flex-direction:column;gap:2px"><span style="font-weight:500">${esc(a.name.split(' ')[0])} · ${esc(a.goal || 'Objetivo')}</span><span class="muted">${daysBetween(today, a.goal_date)} días</span></div></a>`).join('') : '<span class="muted">Cargá la fecha objetivo en la ficha de cada atleta para ver la proyección.</span>'}
      </section>
      ${unread ? `<section class="card"><span style="font-weight:500">${unread} mensajes sin leer</span><br><span class="muted">Están en la ficha de cada atleta.</span></section>` : ''}
    </aside>
  </div>`;
  return coachPage('Panel', 'panel', body, { unread });
}

function athleteDetail(a, s, proj, messages, { msg, baseUrl, unread }) {
  const today = todayISO();
  const goalLbl = a.goal_date ? `${a.goal || 'Objetivo'} · ${fmtDate(a.goal_date)}` : null;
  const endP = proj ? proj.points[proj.points.length - 1] : null;
  const rhr = s.series.slice(-1)[0] || {};
  const lastRhr = [...s.series].reverse().find((x) => x.resting_hr != null);
  const lastHrv = [...s.series].reverse().find((x) => x.hrv != null);
  const link = `${baseUrl}/a/${a.invite_token}`;
  const statusTxt = { done: 'Hecho', missed: 'No realizado', today: 'Hoy', planned: 'Planificado', rest: 'Descanso' };

  const week = s.week.map((d) => {
    const title = d.done.length ? d.done.map((x) => x.name).join(' + ') : d.planned.length ? d.planned.map((x) => x.name).join(' + ') : 'Descanso';
    const load = d.plannedLoad || d.doneLoad ? `${d.doneLoad ? Math.round(d.doneLoad) : '—'} / ${d.plannedLoad ? Math.round(d.plannedLoad) : '—'}` : '—';
    return `<div class="day s-${d.status}"><div style="display:flex;justify-content:space-between;font-size:12px;color:#8B96A5"><span>${dayName(d.date)}</span><span class="num">${d.date.slice(8)}</span></div>
      <span class="t">${esc(title)}</span><span class="num muted" style="font-size:12px">${load}</span><span class="st">${statusTxt[d.status]}</span></div>`;
  }).join('');

  const acts = s.acts.slice(0, 15).map((x) => `<a class="li" href="/coach/actividad/${x.id}"><span class="muted">${fmtDate(x.date, true)}</span>
    <span class="sport" style="color:${sportColor(x.type)};border-color:${sportColor(x.type)}">${esc(sportLabel(x.type))}</span>
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.name || sportLabel(x.type))}</span>
    <span class="num">${fmtDuration(x.moving_time)}</span><span class="num">${x.distance ? (x.distance / 1000).toFixed(1) + ' km' : '—'}</span>
    <span class="num">${x.load != null ? Math.round(x.load) + ' TSS' : '—'}</span>
    <span class="num">${x.np ? Math.round(x.np) + ' W' : x.avg_hr ? Math.round(x.avg_hr) + ' lpm' : '—'}</span></a>`).join('');

  // Carga por deporte, últimos 28 días
  const d28 = require('./util').addDays(today, -27);
  const bySport = {};
  s.acts.filter((x) => x.date >= d28).forEach((x) => {
    const k = sportLabel(x.type);
    bySport[k] = bySport[k] || { label: k, color: sportColor(x.type), load: 0, secs: 0, n: 0, km: 0 };
    bySport[k].load += x.load || 0; bySport[k].secs += x.moving_time || 0; bySport[k].n++; bySport[k].km += (x.distance || 0) / 1000;
  });
  const sports = Object.values(bySport).sort((p, q) => q.load - p.load);
  const totalLoad = sports.reduce((t, x) => t + x.load, 0) || 1;
  const sportRows = sports.map((x) => `<div style="display:grid;grid-template-columns:130px minmax(0,1fr) 70px 70px 80px;gap:12px;align-items:center;font-size:13px">
    <span style="color:${x.color};font-weight:500">${esc(x.label)}</span>
    <span style="background:#1F262F;border-radius:3px"><i class="sbar" style="display:block;width:${Math.max(2, (x.load / totalLoad) * 100).toFixed(0)}%;background:${x.color}"></i></span>
    <span class="num r">${Math.round((x.load / totalLoad) * 100)}%</span><span class="num r">${fmtDuration(x.secs)}</span><span class="num r">${x.km ? x.km.toFixed(0) + ' km' : x.n + ' ses.'}</span></div>`).join('');

  const thread = messages.map((m) => `<div class="msg ${m.sender === 'coach' ? 'me' : ''}"><small>${m.sender === 'coach' ? 'Vos' : esc(a.name.split(' ')[0])} · ${ago(m.created_at)}</small><span>${esc(m.body)}</span></div>`).join('');

  const body = `
  <div style="display:flex;gap:8px;align-items:center;font-size:13px"><a href="/coach" class="muted">← Panel</a></div>
  ${flash(msg)}
  <header class="head" style="align-items:center">
    <span class="av" style="width:64px;height:64px;font-size:22px">${esc(initials(a.name))}</span>
    <div style="display:flex;flex-direction:column;gap:6px"><h1>${esc(a.name)}</h1>
      <div class="muted">${esc(a.sport)}${a.goal ? ' · Objetivo: ' + esc(a.goal) : ''}${a.goal_date ? ' · ' + fmtDate(a.goal_date) + ` (${goalDays(today, a.goal_date)})` : ''}</div></div>
    <div class="right">
      <span class="pill t-${a.intervals_id ? (a.last_sync_error ? 'high' : 'ok') : 'mid'}">${a.intervals_id ? (a.last_sync_error ? 'Error de sync' : 'Intervals · ' + ago(a.last_sync_at)) : 'No vinculado'}</span>
      <form method="post" action="/coach/atleta/${a.id}/sync"><button class="btn ghost">${icon.sync}Sincronizar</button></form>
      <a class="btn" href="/coach/workouts/nuevo?atleta=${a.id}">Asignar workout</a></div>
  </header>

  <section class="metrics" aria-label="Métricas">
    <div class="card metric"><span class="th">Fitness (CTL)</span><span class="v num" style="color:#5B9BFF">${s.ctl != null ? Math.round(s.ctl) : '—'}</span><span class="num muted" style="font-size:12px">${s.ctl != null && s.ctl42ago != null ? signed(s.ctl - s.ctl42ago) + ' en 6 sem' : ''}</span></div>
    <div class="card metric"><span class="th">Fatiga (ATL)</span><span class="v num" style="color:#F08A4B">${s.atl != null ? Math.round(s.atl) : '—'}</span><span class="muted" style="font-size:12px">7 días</span></div>
    <div class="card metric"><span class="th">Forma (TSB)</span><span class="v num" style="color:${tsbColor(s.tsb)}">${signed(s.tsb)}</span><span class="muted" style="font-size:12px">${s.tsb == null ? '' : s.tsb <= -20 ? 'riesgo de sobrecarga' : s.tsb < -5 ? 'zona productiva' : s.tsb <= 5 ? 'neutral' : 'fresco'}</span></div>
    <div class="card metric"><span class="th">FTP · FC umbral</span><span class="v num">${a.ftp ? a.ftp + '<span class="muted" style="font-size:14px"> W</span>' : '—'}</span><span class="num muted" style="font-size:12px">${a.lthr ? a.lthr + ' lpm' : ''}${a.threshold_pace ? ' · ' + esc(a.threshold_pace) : ''}</span></div>
    <div class="card metric"><span class="th">FC reposo</span><span class="v num">${lastRhr ? Math.round(lastRhr.resting_hr) : '—'}</span><span class="muted" style="font-size:12px">${lastRhr ? fmtDate(lastRhr.date) : 'sin dato'}</span></div>
    <div class="card metric"><span class="th">HRV</span><span class="v num">${lastHrv ? Math.round(lastHrv.hrv) : '—'}</span><span class="muted" style="font-size:12px">${lastHrv ? fmtDate(lastHrv.date) : 'sin dato'}</span></div>
  </section>

  <div class="cols">
    <section class="card grow stack" aria-label="Carga y proyección">
      <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><h2>Carga, fatiga y forma${goalLbl ? ' → proyección' : ''}</h2>
        <div class="legend" style="margin-left:auto"><span><i style="width:14px;height:2px;background:#5B9BFF"></i>CTL</span><span><i style="width:14px;height:2px;background:#F08A4B"></i>ATL</span><span><i style="width:10px;height:10px;background:#3A4453"></i>TSB</span>${proj ? '<span><i style="width:14px;border-top:2px dashed #5B9BFF"></i>Proyección</span>' : ''}</div></div>
      ${pmc(s.series, proj, goalLbl)}
      ${endP ? `<div style="display:flex;gap:24px;flex-wrap:wrap;border-top:1px solid #262E39;padding-top:12px;color:#B7C0CC">
        <span>CTL el día objetivo: <b class="num" style="color:#5B9BFF">${Math.round(endP.ctl)}</b></span>
        <span>Forma ese día: <b class="num" style="color:#E8EBF0">${signed(endP.tsb)}</b></span>
        <span class="muted">${proj.usesPlanUntil ? `Usa tu plan cargado hasta el ${fmtDate(proj.usesPlanUntil)}; después, la carga media actual (${Math.round(proj.avg28)}/día).` : `Sin plan futuro cargado: asume la carga media actual (${Math.round(proj.avg28)}/día).`}</span></div>`
        : '<span class="muted">Cargá una fecha objetivo para proyectar la forma al día de la carrera.</span>'}
    </section>
    <aside class="aside">
      <section class="card stack" aria-label="Alertas"><h2>Alertas</h2>
        ${s.alerts.length ? s.alerts.map((al) => `<div class="alert"><span class="dot" style="background:${dotColor(al.level)}"></span><div><span style="font-weight:500">${esc(al.text)}</span><small>${esc(al.detail)}</small></div></div>`).join('') : '<span class="muted">Sin alertas.</span>'}
      </section>
      <section class="card stack" aria-label="Link del atleta"><h2>Link del atleta</h2>
        <span class="muted" style="font-size:13px">Mandale este link por WhatsApp: es su acceso personal, sin contraseña.</span>
        <div class="copy">${esc(link)}</div></section>
    </aside>
  </div>

  <section class="card stack" aria-label="Semana"><div style="display:flex;align-items:baseline;gap:12px"><h2>Esta semana</h2><span class="muted">realizado / planificado</span><span class="num" style="margin-left:auto">${Math.round(s.weekDone)} / ${Math.round(s.weekPlanned)} TSS</span></div>
    <div class="week">${week}</div></section>

  <section class="card stack" aria-label="Carga por deporte"><div style="display:flex;align-items:baseline;gap:12px"><h2>Carga por deporte</h2><span class="muted">últimos 28 días · % de la carga total, tiempo y distancia</span></div>
    ${sportRows || '<span class="muted">Sin actividades en los últimos 28 días.</span>'}</section>

  <div class="cols">
    <section class="card grow" aria-label="Actividades"><h2 style="margin-bottom:8px">Últimas actividades <span class="muted" style="font-weight:400;font-size:13px">· tocá una para ver mapa y gráficos</span></h2><div class="list">${acts || '<span class="muted">Sin actividades todavía.</span>'}</div></section>
    <section class="card aside stack" aria-label="Mensajes"><h2>Mensajes</h2>
      <div class="thread">${thread || '<span class="muted">Sin mensajes.</span>'}</div>
      <form method="post" action="/coach/atleta/${a.id}/mensaje" style="display:flex;flex-direction:column;gap:8px">
        <label class="f" for="body">Escribir a ${esc(a.name.split(' ')[0])}</label><textarea id="body" name="body" rows="3" required style="font-family:inherit"></textarea>
        <button class="btn">Enviar</button></form></section>
  </div>

  <section class="card stack" aria-label="Ficha"><h2>Ficha</h2>${athleteForm(a, `/coach/atleta/${a.id}`)}</section>`;
  return coachPage(a.name, '', body, { unread });
}

function athleteForm(a, action) {
  a = a || {};
  return `<form method="post" action="${action}" class="form">
    <label class="f">Nombre<input type="text" name="name" required value="${esc(a.name)}"></label>
    <label class="f">ID de Intervals.icu (ej. i123456)<input type="text" name="intervals_id" value="${esc(a.intervals_id)}" placeholder="i123456"></label>
    <label class="f">Disciplina<select name="sport">${SPORTS.map((s) => `<option ${a.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f">Objetivo<input type="text" name="goal" value="${esc(a.goal)}" placeholder="10K, Gran fondo…"></label>
    <label class="f">Fecha objetivo<input type="date" name="goal_date" value="${esc(a.goal_date)}"></label>
    <label class="f">Notas del coach<input type="text" name="notes" value="${esc(a.notes)}"></label>
    <div style="grid-column:1/-1;display:flex;gap:10px;align-items:center">
      <button class="btn">Guardar</button>${a.id ? `<label class="check" style="margin-left:auto"><input type="checkbox" name="active" ${a.active !== false ? 'checked' : ''}>Activo</label>` : ''}</div>
  </form>`;
}

function newAthlete({ msg, unread }) {
  const body = `<header class="head"><div><div class="th">Alta</div><h1>Agregar atleta</h1></div></header>${flash(msg)}
  <div class="cols"><section class="card grow">${athleteForm(null, '/coach/atletas')}</section>
  <aside class="aside"><section class="card stack"><h2>Cómo se vincula</h2>
    <ol style="margin:0;padding-left:18px;line-height:1.6;color:#B7C0CC">
      <li>El atleta crea su cuenta gratis en intervals.icu y conecta su Garmin, COROS, Wahoo, Suunto o Polar (una sola vez).</li>
      <li>En Intervals: <b>Settings → Coach</b>, te agrega como coach con permiso de edición.</li>
      <li>Copiá su ID (aparece en la URL de su perfil: <span class="num">i123456</span>) y pegalo acá.</li></ol>
    <span class="muted" style="font-size:13px">La autorización queda activa hasta que el atleta te quite como coach.</span></section></aside></div>`;
  return coachPage('Agregar atleta', 'nuevo', body, { unread });
}

const TEMPLATES = {
  Ride: {
    'Calentamiento': 'Calentamiento\n- 15m ramp 50-70%\n',
    'Umbral 4×8′': '4x\n- 8m 95-99% 95-100rpm\n- 4m 55%\n',
    'VO2 5×3′': '5x\n- 3m 110-120%\n- 3m 50%\n',
    'Z2 60′': '- 60m 65-75%\n',
    'Vuelta a la calma': 'Vuelta a la calma\n- 10m 50%\n',
  },
  VirtualRide: {
    'Calentamiento': 'Calentamiento\n- 10m ramp 45-65%\n',
    'Sweet spot 3×12′': '3x\n- 12m 88-93% 90rpm\n- 4m 55%\n',
    'VO2 6×2′': '6x\n- 2m 115-120%\n- 2m 50%\n',
    'Cadencia 5×1′': '5x\n- 1m 60% 110rpm\n- 1m 55% 85rpm\n',
    'Vuelta a la calma': 'Vuelta a la calma\n- 8m 45%\n',
  },
  Swim: {
    'Entrada en calor': 'Entrada en calor\n- 300mtr Z1 Pace\n',
    'Técnica 8×50': '8x\n- 50mtr Z2 Pace\n- 20s\n',
    'Series 6×100': '6x\n- 100mtr Z3-Z4 Pace\n- 30s\n',
    'Continuo 800': '- 800mtr Z2 Pace\n',
    'Vuelta a la calma': 'Vuelta a la calma\n- 200mtr Z1 Pace\n',
  },
  Walk: {
    'Caminata Z1 45′': '- 45m Z1 HR\n',
    'Caminata activa 60′': '- 10m Z1 HR\n- 40m Z2 HR\n- 10m Z1 HR\n',
    'Intervalos 5×3′': '- 10m Z1 HR\n\n5x\n- 3m Z3 HR\n- 2m Z1 HR\n',
  },
  Hike: {
    'Trekking Z2 2h': '- 2h Z1-Z2 HR\n',
    'Subidas 4×8′': '- 15m Z1 HR\n\n4x\n- 8m Z3 HR\n- 5m Z1 HR\n',
  },
  WeightTraining: {
    'Fuerza general 45′': '- 10m Z1 HR Entrada en calor\n- 30m Circuito de fuerza\n- 5m Movilidad\n',
  },
  Run: {
    'Calentamiento': 'Calentamiento\n- 15m Z1-Z2 HR\n',
    'Series 6×1000 m': '6x\n- 1km 98-102% Pace\n- 2m Z1 HR\n',
    'Tempo 3×10′': '3x\n- 10m 88-92% Pace\n- 3m Z1 HR\n',
    'Rodaje Z2 50′': '- 50m Z2 HR\n',
    'Vuelta a la calma': 'Vuelta a la calma\n- 10m Z1 HR\n',
  },
};

function workoutBuilder(athletes, { msg, preselect, unread }) {
  const tomorrow = require('./util').addDays(todayISO(), 1);
  const list = athletes.filter((a) => a.intervals_id).map((a) => `<label class="check"><input type="checkbox" name="athletes" value="${a.id}" ${String(a.id) === String(preselect) ? 'checked' : ''}>${esc(a.name)}<span class="muted" style="margin-left:auto;font-size:12px">${a.ftp ? a.ftp + ' W' : ''}${a.threshold_pace ? ' ' + esc(a.threshold_pace) : ''}</span></label>`).join('');
  const body = `<header class="head"><div><div class="th">Constructor</div><h1>Nuevo workout</h1></div></header>${flash(msg)}
  <form method="post" action="/coach/workouts" class="cols">
    <section class="card grow stack">
      <div class="form">
        <label class="f">Nombre<input type="text" name="name" required placeholder="Umbral 4×8′ cadencia alta"></label>
        <label class="f">Tipo<select name="type" id="type"><option value="Ride">Ciclismo (ruta)</option><option value="VirtualRide">Rodillo / Zwift</option><option value="Run">Running</option><option value="Swim">Natación</option><option value="Walk">Caminata</option><option value="Hike">Trekking</option><option value="WeightTraining">Fuerza</option></select></label>
      </div>
      <div class="stack" style="gap:8px"><span class="th">Bloques rápidos</span><div class="chips" id="chips"></div></div>
      <label class="f" for="desc">Estructura (formato Intervals.icu: se convierte en workout estructurado para el reloj)</label>
      <textarea id="desc" name="description" rows="14" required placeholder="Calentamiento&#10;- 15m ramp 50-70%&#10;&#10;4x&#10;- 8m 95-99% 95-100rpm&#10;- 4m 55%"></textarea>
      <span class="muted" style="font-size:13px">% = de FTP (bici/rodillo) o ritmo umbral con «Pace». Zonas: Z2 HR, Z3 Pace… Natación: metros con «mtr» (ej. 100mtr). Repeticiones: «4x» y los pasos debajo. Rodillo: llega a Zwift si el atleta lo conectó en Intervals. Cada atleta recibe los valores según sus propios umbrales.</span>
    </section>
    <aside class="aside"><section class="card stack"><h2>Asignar y enviar</h2>
      <label class="f">Fecha<input type="date" name="date" required value="${tomorrow}"></label>
      <div><span class="th">Atletas vinculados</span>${list || '<p class="muted">No hay atletas vinculados a Intervals todavía.</p>'}</div>
      <span class="muted" style="font-size:13px">Se carga en el calendario de Intervals de cada atleta, que lo sincroniza a su Garmin (u otro dispositivo compatible) si tiene activada la subida de workouts.</span>
      <button class="btn" style="height:48px;justify-content:center">Enviar a los atletas</button></section></aside>
  </form>
  <script>
  const T=${JSON.stringify(TEMPLATES)};const sel=document.getElementById('type'),chips=document.getElementById('chips'),ta=document.getElementById('desc');
  function draw(){chips.innerHTML='';const set=T[sel.value]||T.Ride;Object.keys(set).forEach(k=>{const b=document.createElement('button');b.type='button';b.className='chip';b.textContent='+ '+k;b.onclick=()=>{ta.value+=(ta.value&&!ta.value.endsWith('\\n\\n')?'\\n':'')+set[k];ta.focus();};chips.appendChild(b);});}
  sel.onchange=draw;draw();
  </script>`;
  return coachPage('Nuevo workout', 'workouts', body, { unread });
}

// ---------- Detalle de actividad: mapa + gráficos ----------
function streamOf(streams, type) {
  const st = (streams || []).find((x) => x && x.type === type);
  return st ? st : null;
}
function latlngOf(streams) {
  const st = streamOf(streams, 'latlng');
  if (!st || !st.data || !st.data.length) return [];
  let pts = Array.isArray(st.data[0]) ? st.data : (st.data2 ? st.data.map((lat, i) => [lat, st.data2[i]]) : []);
  pts = pts.filter((p) => p && p[0] != null && p[1] != null && !(p[0] === 0 && p[1] === 0));
  const step = Math.max(1, Math.floor(pts.length / 1500));
  return pts.filter((_, i) => i % step === 0).map((p) => [Number(p[0].toFixed(5)), Number(p[1].toFixed(5))]);
}
function lineChart(values, secs, { color, label, unit, fmt }) {
  const v = (values || []).map((x) => (x == null ? null : Number(x)));
  const valid = v.filter((x) => x != null && !isNaN(x));
  if (valid.length < 10) return '';
  const W = 900, H = 150, L = 46, R = 10, T = 12, B = 22;
  const n = v.length, step = Math.max(1, Math.floor(n / 600));
  const pts = [];
  for (let i = 0; i < n; i += step) {
    const chunk = v.slice(i, i + step).filter((x) => x != null);
    if (chunk.length) pts.push([i, chunk.reduce((s, x) => s + x, 0) / chunk.length]);
  }
  const mx = Math.max(...valid) * 1.05 || 1, mn = Math.min(0, Math.min(...valid));
  const x = (i) => L + (i / (n - 1)) * (W - L - R), y = (val) => T + (1 - (val - mn) / (mx - mn)) * (H - T - B);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p[0]).toFixed(1)} ${y(p[1]).toFixed(1)}`).join(' ');
  const avg = valid.reduce((s, q) => s + q, 0) / valid.length;
  const total = secs || n;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${(L + f * (W - L - R)).toFixed(0)}" y="${H - 6}" fill="#8B96A5" font-size="11" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}" font-family="IBM Plex Mono">${fmtDuration(Math.round(total * f)) || '0'}</text>`).join('');
  return `<div class="stack" style="gap:6px"><div style="display:flex;gap:10px;align-items:baseline"><span style="font-weight:500;color:${color}">${label}</span>
    <span class="muted num" style="font-size:12px">prom ${fmt(avg)}${unit} · máx ${fmt(Math.max(...valid))}${unit}</span></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${label} en el tiempo">
    <line x1="${L}" y1="${y(avg)}" x2="${W - R}" y2="${y(avg)}" stroke="${color}" stroke-dasharray="3 4" opacity=".5"/>
    <text x="${L - 6}" y="${T + 8}" fill="#8B96A5" font-size="11" text-anchor="end" font-family="IBM Plex Mono">${fmt(mx)}</text>
    <path d="${d} L${x(pts[pts.length - 1][0]).toFixed(1)} ${y(mn)} L${x(pts[0][0]).toFixed(1)} ${y(mn)} Z" fill="${color}" opacity=".12"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.4"/>${ticks}</svg></div>`;
}
function activityDetail(a, act, streams, { unread, streamError }) {
  const raw = act.raw || {};
  const pts = latlngOf(streams);
  const secs = act.moving_time || (raw.elapsed_time) || null;
  const isRun = /Run|Walk|Hike/.test(act.type || '');
  const vel = streamOf(streams, 'velocity_smooth');
  const pace = (mps) => { if (!mps || mps < 0.3) return '—'; const s = 1000 / mps; return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`; };
  const stat = (lbl, val) => val ? `<div class="card metric"><span class="th">${lbl}</span><span class="v num" style="font-size:22px">${val}</span></div>` : '';
  const avgSpeed = act.distance && act.moving_time ? act.distance / act.moving_time : null;
  const charts = [
    lineChart(streamOf(streams, 'watts') && streamOf(streams, 'watts').data, secs, { color: '#F0C04B', label: 'Potencia', unit: ' W', fmt: (q) => Math.round(q) }),
    lineChart(streamOf(streams, 'heartrate') && streamOf(streams, 'heartrate').data, secs, { color: '#F2645A', label: 'Frecuencia cardíaca', unit: ' lpm', fmt: (q) => Math.round(q) }),
    vel ? lineChart(vel.data.map((q) => (q == null ? null : isRun ? q : q * 3.6)), secs, isRun
      ? { color: '#5B9BFF', label: 'Velocidad', unit: ' m/s', fmt: (q) => q.toFixed(1) }
      : { color: '#5B9BFF', label: 'Velocidad', unit: ' km/h', fmt: (q) => q.toFixed(1) }) : '',
    lineChart(streamOf(streams, 'cadence') && streamOf(streams, 'cadence').data, secs, { color: '#9CCB6B', label: 'Cadencia', unit: '', fmt: (q) => Math.round(q) }),
    lineChart(streamOf(streams, 'altitude') && streamOf(streams, 'altitude').data, secs, { color: '#B7C0CC', label: 'Altitud', unit: ' m', fmt: (q) => Math.round(q) }),
  ].filter(Boolean).join('');
  const map = pts.length > 1 ? `<div id="map" style="height:420px;border-radius:10px;overflow:hidden;border:1px solid #262E39"></div>
    <link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
    <script src="/vendor/leaflet/leaflet.js"></script>
    <script>(function(){var p=${JSON.stringify(pts)};var m=L.map('map',{scrollWheelZoom:false});
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap &copy; CARTO'}).addTo(m);
      var line=L.polyline(p,{color:'#F08A4B',weight:4}).addTo(m);m.fitBounds(line.getBounds(),{padding:[20,20]});
      L.circleMarker(p[0],{radius:6,color:'#3FB68B',fillOpacity:1}).addTo(m);L.circleMarker(p[p.length-1],{radius:6,color:'#F2645A',fillOpacity:1}).addTo(m);})();</script>`
    : `<div class="card" style="text-align:center;padding:28px"><span class="muted">${streamError ? 'No se pudieron traer los datos detallados de Intervals ahora.' : 'Actividad sin GPS (rodillo, Zwift, cinta, natación en pileta o fuerza).'}</span></div>`;
  const body = `<div style="font-size:13px"><a href="/coach/atleta/${a.id}" class="muted">← ${esc(a.name)}</a></div>
  <header class="head" style="align-items:center"><div style="display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;gap:10px;align-items:center"><span class="sport" style="color:${sportColor(act.type)};border-color:${sportColor(act.type)}">${esc(sportLabel(act.type))}</span><span class="muted">${fmtDate(act.date, true)}${act.device ? ' · ' + esc(act.device) : ''}</span></div>
    <h1>${esc(act.name || sportLabel(act.type))}</h1></div></header>
  <section class="metrics" aria-label="Resumen">
    ${stat('Duración', fmtDuration(act.moving_time))}${stat('Distancia', act.distance ? (act.distance / 1000).toFixed(2) + ' km' : '')}
    ${stat(isRun ? 'Ritmo medio' : 'Velocidad media', avgSpeed ? (isRun ? pace(avgSpeed) + '/km' : (avgSpeed * 3.6).toFixed(1) + ' km/h') : '')}
    ${stat('Carga (TSS)', act.load != null ? Math.round(act.load) : '')}${stat('NP · IF', act.np ? Math.round(act.np) + ' W' + (act.intensity != null ? ' · ' + (act.intensity > 3 ? act.intensity / 100 : act.intensity).toFixed(2) : '') : '')}
    ${stat('FC media', act.avg_hr ? Math.round(act.avg_hr) + ' lpm' : '')}${stat('Desnivel', raw.total_elevation_gain ? Math.round(raw.total_elevation_gain) + ' m' : '')}
  </section>
  ${map}
  ${charts ? `<section class="card stack" aria-label="Gráficos">${charts}</section>` : ''}`;
  return coachPage(act.name || 'Actividad', '', body, { unread });
}

function login(error) {
  return barePage('Ingresar · HyT', `<main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px">
  <form method="post" action="/login" class="card stack" style="width:100%;max-width:360px;padding:28px">
    <div class="logo" style="padding:0"><b>HyT</b><span>Entrenamiento</span></div>
    ${error ? '<div class="flash err">Contraseña incorrecta</div>' : ''}
    <label class="f">Contraseña del coach<input type="password" name="password" required autofocus></label>
    <button class="btn" style="justify-content:center">Ingresar</button></form></main>`);
}

module.exports = { activityDetail, dashboard, athleteDetail, newAthlete, workoutBuilder, login };
