// Constructor de workouts, biblioteca con carpetas y planificador semanal con proyección
const W = require('./workout');
const { esc, fmtDate, fmtDuration, todayISO, addDays, dayName, sportLabel, sportColor } = require('./util');
const { coachPage, icon } = require('./layout');

const TYPES = [['Ride', 'Ciclismo (ruta)'], ['VirtualRide', 'Rodillo / Zwift'], ['Run', 'Running'], ['Swim', 'Natación'], ['Walk', 'Caminata'], ['Hike', 'Trekking'], ['WeightTraining', 'Fuerza']];
const TEMPLATES = {
  Ride: { 'Calentamiento': 'Calentamiento\n- 15m ramp 50-70%\n', 'Umbral 4×8′': '4x\n- 8m 95-99% 95rpm\n- 4m 50%\n', 'Sweet spot 3×12′': '3x\n- 12m 88-93%\n- 4m 50%\n', 'VO2 5×3′': '5x\n- 3m 110-120%\n- 3m 50%\n', 'Z2 60′': '- 60m 65-75%\n', 'Vuelta a la calma': 'Vuelta a la calma\n- 10m 50%\n' },
  VirtualRide: { 'Calentamiento': 'Calentamiento\n- 10m ramp 45-65%\n', 'Sweet spot 3×12′': '3x\n- 12m 88-93% 90rpm\n- 4m 55%\n', 'VO2 6×2′': '6x\n- 2m 115-120%\n- 2m 50%\n', 'Cadencia 5×1′': '5x\n- 1m 60% 110rpm\n- 1m 55% 85rpm\n', 'Vuelta a la calma': 'Vuelta a la calma\n- 8m 45%\n' },
  Run: { 'Calentamiento': 'Calentamiento\n- 15m Z1-Z2 HR\n', 'Series 6×1000 m': '6x\n- 1km 98-102% Pace\n- 2m Z1 HR\n', 'Tempo 3×10′': '3x\n- 10m 88-92% Pace\n- 3m Z1 HR\n', 'Rodaje Z2 50′': '- 50m Z2 HR\n', 'Vuelta a la calma': 'Vuelta a la calma\n- 10m Z1 HR\n' },
  Swim: { 'Entrada en calor': 'Entrada en calor\n- 300mtr Z1 Pace\n', 'Técnica 8×50': '8x\n- 50mtr Z2 Pace\n- 20s\n', 'Series 6×100': '6x\n- 100mtr Z3-Z4 Pace\n- 30s\n', 'Continuo 800': '- 800mtr Z2 Pace\n', 'Vuelta a la calma': 'Vuelta a la calma\n- 200mtr Z1 Pace\n' },
  Walk: { 'Caminata Z1 45′': '- 45m Z1 HR\n', 'Caminata activa 60′': '- 10m Z1 HR\n- 40m Z2 HR\n- 10m Z1 HR\n', 'Intervalos 5×3′': '- 10m Z1 HR\n\n5x\n- 3m Z3 HR\n- 2m Z1 HR\n' },
  Hike: { 'Trekking Z2 2h': '- 2h Z1-Z2 HR\n', 'Subidas 4×8′': '- 15m Z1 HR\n\n4x\n- 8m Z3 HR\n- 5m Z1 HR\n' },
  WeightTraining: { 'Fuerza general 45′': '- 10m Z1 HR Entrada en calor\n- 30m Circuito de fuerza\n- 5m Movilidad\n' },
};

const paceSecs = (txt) => { const m = String(txt || '').match(/(\d+):(\d{2})/); return m ? +m[1] * 60 + +m[2] : null; };
const ctxOf = (a, type) => ({ sport: type, ftp: a && a.ftp, lthr: a && a.lthr, paceSecKm: a && paceSecs(a.threshold_pace) });
const estimate = (desc, type, a) => W.parse(desc, ctxOf(a, type));

function flash(msg) {
  if (!msg) return '';
  const err = msg.startsWith('!');
  return `<div class="flash ${err ? 'err' : ''}" role="status">${esc(err ? msg.slice(1) : msg)}</div>`;
}

const EXTRA_CSS = `<style>
[hidden]{display:none!important}
.seg{display:inline-flex;border:1px solid #262E39;border-radius:8px;overflow:hidden}
.seg label{display:flex;align-items:center;gap:6px;padding:0 14px;height:40px;cursor:pointer;color:#B7C0CC;font-size:13px;letter-spacing:0}
.seg input{position:absolute;opacity:0;pointer-events:none}
.seg label:has(input:checked){background:#F08A4B;color:#14100C;font-weight:600}
.seg label:has(input:focus-visible){outline:2px solid #F08A4B}
.tabs2{display:flex;gap:4px;border-bottom:1px solid #262E39}
.tabs2 button{background:none;border:0;border-bottom:2px solid transparent;color:#B7C0CC;font:inherit;font-size:14px;padding:10px 14px;cursor:pointer;margin-bottom:-1px;min-height:44px}
.tabs2 button[aria-selected=true]{color:#E8EBF0;border-bottom-color:#F08A4B;font-weight:500}
.row5{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}
.row5 label.f{min-width:90px}
.row5 input,.row5 select{height:40px}
.zrow{display:grid;grid-template-columns:120px minmax(0,1fr) 54px;gap:10px;align-items:center;font-size:12px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.wcard{display:flex;flex-direction:column;gap:8px}
.days7{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}
.dcol{display:flex;flex-direction:column;gap:8px;background:#161B22;border:1px solid #262E39;border-radius:10px;padding:10px;min-height:260px}
.dcol.today{border-color:#F08A4B}
.it{border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;font-size:12px}
.it.done{background:#16211D;border:1px solid #2B4A3E}.it.plan{background:#1A2230;border:1px solid #2E3E57}.it.sim{background:#241B15;border:1px dashed #F08A4B}
.it b{font-size:13px;font-weight:500}
.fold a{display:flex;justify-content:space-between;padding:9px 10px;border-radius:6px;color:#B7C0CC}.fold a.on{background:#1C222B;color:#E8EBF0}
.pill2{font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #3A4453;color:#B7C0CC}
@media (max-width:1100px){.days7{grid-template-columns:repeat(2,minmax(0,1fr))}.grid3{grid-template-columns:1fr}}
</style>`;

// ---------------- Constructor ----------------
function builder({ athletes, folders, lib, preselect, date, msg, unread }) {
  const w = lib || { name: '', type: 'Ride', target: 'power', description: '', folder_id: null };
  const d = date || addDays(todayISO(), 1);
  const list = athletes.filter((a) => a.intervals_id).map((a) => `<label class="check"><input type="checkbox" name="athletes" value="${a.id}" ${String(a.id) === String(preselect) ? 'checked' : ''}>${esc(a.name)}<span class="muted" style="margin-left:auto;font-size:12px">${a.ftp ? a.ftp + ' W' : ''}${a.threshold_pace ? ' ' + esc(a.threshold_pace) : ''}</span></label>`).join('');
  const body = `${EXTRA_CSS}
  <header class="head"><div><div class="th">Constructor${lib && lib.id ? ' · editando de la biblioteca' : ''}</div><h1>${lib && lib.id ? esc(w.name) : 'Nuevo workout'}</h1></div>
    <div class="right"><a class="btn ghost" href="/coach/biblioteca">Biblioteca</a></div></header>
  ${flash(msg)}
  <form method="post" action="/coach/workouts" class="cols" id="wf">
    <input type="hidden" name="lib_id" value="${lib && lib.id ? lib.id : ''}">
    <section class="card grow stack">
      <div class="form" style="grid-template-columns:2fr 1fr 1fr">
        <label class="f">Nombre<input type="text" name="name" required value="${esc(w.name)}" placeholder="Umbral 4×8′"></label>
        <label class="f">Deporte<select name="type" id="type">${TYPES.map(([v, l]) => `<option value="${v}" ${w.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="f">Carpeta<select name="folder_id"><option value="">Sin carpeta</option>${folders.map((f) => `<option value="${f.id}" ${String(w.folder_id) === String(f.id) ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>
      </div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap"><span class="th">Objetivo por</span>
        <div class="seg" role="radiogroup" aria-label="Objetivo por">
          <label><input type="radio" name="target" value="power" ${w.target === 'power' ? 'checked' : ''}>Potencia</label>
          <label><input type="radio" name="target" value="hr" ${w.target === 'hr' ? 'checked' : ''}>Frecuencia cardíaca</label>
          <label><input type="radio" name="target" value="pace" ${w.target === 'pace' ? 'checked' : ''}>Ritmo</label></div>
        <span class="muted" style="font-size:12px">Al cambiarlo, se convierte todo el workout.</span></div>

      <div class="tabs2" role="tablist"><button type="button" role="tab" aria-selected="true" data-tab="t1">Pegar texto</button><button type="button" role="tab" aria-selected="false" data-tab="t2">Manual</button><button type="button" role="tab" aria-selected="false" data-tab="t3">Bloques rápidos</button></div>
      <div id="t1" class="stack" style="gap:8px">
        <label class="f" for="free">Escribilo como se lo dirías al atleta (o pegá un texto)</label>
        <textarea id="free" rows="3" style="font-family:inherit;font-size:14px" placeholder="Calentamiento 15', 4x8' al 95% rec 4', vuelta a la calma 10'"></textarea>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><button type="button" class="btn" id="gen">Generar workout</button>
          <span class="muted" style="font-size:12px">Entiende: 4x8', 6 x 1 km a 4:00, 3x10' Z3, al 90-95%, 150 lpm, 250 w, rec 3', 100 rpm, calentamiento, vuelta a la calma, suave/tempo/umbral.</span></div>
      </div>
      <div id="t2" class="stack" hidden style="gap:14px">
        <div class="stack" style="gap:6px"><span class="th">Paso simple</span>
          <div class="row5">
            <label class="f">Tipo<select id="sKind"><option value="">Trabajo</option><option>Calentamiento</option><option>Recuperación</option><option>Vuelta a la calma</option></select></label>
            <label class="f">Duración<input type="text" id="sDur" value="10" style="width:80px"></label>
            <label class="f">Unidad<select id="sUnit"><option value="m">min</option><option value="s">seg</option><option value="km">km</option><option value="mtr">metros</option></select></label>
            <label class="f">Intensidad<input type="text" id="sInt" value="70" placeholder="95 · 90-95 · Z2" style="width:120px"></label>
            <label class="f">Cadencia<input type="text" id="sCad" placeholder="opcional" style="width:90px"></label>
            <label class="check" style="min-height:40px"><input type="checkbox" id="sRamp">Rampa</label>
            <button type="button" class="btn ghost" id="addStep" style="height:40px">+ Agregar paso</button></div></div>
        <div class="stack" style="gap:6px"><span class="th">Series (N × trabajo + recuperación)</span>
          <div class="row5">
            <label class="f">Repeticiones<input type="text" id="rN" value="4" style="width:70px"></label>
            <label class="f">Trabajo<input type="text" id="rDur" value="8" style="width:70px"></label>
            <label class="f">Unidad<select id="rUnit"><option value="m">min</option><option value="s">seg</option><option value="km">km</option><option value="mtr">metros</option></select></label>
            <label class="f">Intensidad<input type="text" id="rInt" value="95" placeholder="95 · 90-95 · Z4" style="width:110px"></label>
            <label class="f">Recuperación<input type="text" id="rRec" value="4" style="width:70px"></label>
            <label class="f">Unidad<select id="rRecU"><option value="m">min</option><option value="s">seg</option></select></label>
            <label class="f">Int. rec.<input type="text" id="rRecI" value="50" style="width:80px"></label>
            <button type="button" class="btn ghost" id="addRep" style="height:40px">+ Agregar series</button></div></div>
      </div>
      <div id="t3" hidden><div class="chips" id="chips"></div></div>

      <div class="card" style="background:#0E1217;padding:14px 16px" aria-live="polite">
        <div style="display:flex;gap:28px;flex-wrap:wrap;margin-bottom:10px">
          <div><div class="th">Duración</div><div class="num" style="font-size:22px" id="oDur">—</div></div>
          <div><div class="th">TSS estimado</div><div class="num" style="font-size:22px" id="oTss">—</div></div>
          <div><div class="th">IF</div><div class="num" style="font-size:22px" id="oIf">—</div></div>
          <div><div class="th">Pasos</div><div class="num" style="font-size:22px" id="oSteps">—</div></div>
        </div>
        <div id="bars"></div>
        <div id="zones" class="stack" style="gap:6px;margin-top:12px"></div>
      </div>
      <label class="f" for="desc">Estructura (se puede editar a mano · formato que entiende el reloj)</label>
      <textarea id="desc" name="description" rows="12" required>${esc(w.description)}</textarea>
      <div style="display:flex;gap:10px"><button type="button" class="btn ghost" id="clear">Borrar estructura</button></div>
    </section>
    <aside class="aside"><section class="card stack"><h2>Asignar y enviar</h2>
      <label class="f">Fecha<input type="date" name="date" value="${d}"></label>
      <div><span class="th">Atletas vinculados</span>${list || '<p class="muted">No hay atletas vinculados todavía.</p>'}</div>
      <span class="muted" style="font-size:13px">Llega al calendario de Intervals de cada atleta y de ahí a su reloj o a Zwift. Los % se aplican sobre los umbrales de cada uno.</span>
      <button class="btn" style="height:48px;justify-content:center">Enviar a los atletas</button>
      <button class="btn ghost" style="height:48px;justify-content:center" formaction="/coach/biblioteca" formnovalidate>${lib && lib.id ? 'Guardar cambios en biblioteca' : 'Guardar en biblioteca'}</button>
      ${lib && lib.id ? `<button class="btn ghost" style="height:44px;justify-content:center;font-size:13px" formaction="/coach/biblioteca?copia=1" formnovalidate>Guardar como copia</button>` : ''}
    </section></aside>
  </form>
  <script src="/hyt-workout.js"></script>
  <script>
  (function(){
    var W=window.HyTWorkout, T=${JSON.stringify(TEMPLATES)};
    var $=function(id){return document.getElementById(id)}, desc=$('desc'), type=$('type');
    function target(){return document.querySelector('input[name=target]:checked').value}
    var SF={power:{p:'',z:''},hr:{p:' LTHR',z:' HR'},pace:{p:' Pace',z:' Pace'}};
    function render(){
      var p=W.parse(desc.value,{sport:type.value});
      $('bars').innerHTML=W.bars(p,{w:900,h:120});
      $('oDur').textContent=p.totalSecs?W.fmt(p.totalSecs):'—'; $('oTss').textContent=p.totalSecs?p.tss:'—';
      $('oIf').textContent=p.totalSecs?p.ifAvg.toFixed(2):'—'; $('oSteps').textContent=p.steps.length||'—';
      var z='';p.zoneSecs.forEach(function(s,i){if(!s)return;var pc=Math.round(s/p.totalSecs*100);
        z+='<div class="zrow"><span style="color:'+W.ZCOL[i]+'">'+W.ZNAME[i]+'</span><span style="background:#1F262F;border-radius:3px"><i style="display:block;height:8px;border-radius:3px;width:'+pc+'%;background:'+W.ZCOL[i]+'"></i></span><span class="num" style="text-align:right">'+W.fmt(s)+'</span></div>';});
      $('zones').innerHTML=z;
    }
    function add(txt){var v=desc.value.replace(/\\s+$/,'');desc.value=(v?v+'\\n\\n':'')+txt.replace(/\\s+$/,'')+'\\n';render();}
    function intTxt(v){v=String(v||'').trim().toUpperCase().replace(/\\s/g,'');var t=target();
      if(/^\\d+(-\\d+)?%?$/.test(v))return v.replace('%','')+'%'+SF[t].p; if(/^Z\\d(-Z\\d)?$/.test(v))return v+SF[t].z; return v;}
    function dur(v,u){v=String(v).replace(',','.');return v+u;}
    $('gen').onclick=function(){var f=$('free').value.trim();if(!f)return;add(W.fromFreeText(f,target(),{sport:type.value,ftp:${JSON.stringify(null)}}));$('free').value='';};
    $('addStep').onclick=function(){var k=$('sKind').value,cad=$('sCad').value.trim();
      add((k?k+'\\n':'')+'- '+dur($('sDur').value,$('sUnit').value)+' '+($('sRamp').checked?'ramp ':'')+intTxt($('sInt').value)+(cad?' '+cad.replace(/rpm/i,'')+'rpm':''));};
    $('addRep').onclick=function(){add($('rN').value+'x\\n- '+dur($('rDur').value,$('rUnit').value)+' '+intTxt($('rInt').value)+'\\n- '+dur($('rRec').value,$('rRecU').value)+' '+intTxt($('rRecI').value));};
    $('clear').onclick=function(){desc.value='';render();};
    function chips(){var c=$('chips');c.innerHTML='';var s=T[type.value]||T.Ride;Object.keys(s).forEach(function(k){var b=document.createElement('button');b.type='button';b.className='chip';b.textContent='+ '+k;b.onclick=function(){add(W.convertTarget(s[k],target()));};c.appendChild(b);});}
    document.querySelectorAll('input[name=target]').forEach(function(r){r.onchange=function(){desc.value=W.convertTarget(desc.value,target());render();};});
    document.querySelectorAll('.tabs2 button').forEach(function(b){b.onclick=function(){document.querySelectorAll('.tabs2 button').forEach(function(x){x.setAttribute('aria-selected',x===b);$(x.dataset.tab).hidden=x!==b;});};});
    type.onchange=function(){chips();render();}; desc.oninput=render; chips(); render();
  })();
  </script>`;
  return coachPage('Constructor', 'workouts', body, { unread });
}

// ---------------- Biblioteca ----------------
function library({ folders, items, current, counts, msg, unread }) {
  const cards = items.map((w) => {
    const p = W.parse(w.description, { sport: w.type });
    return `<article class="card wcard"><div style="display:flex;gap:8px;align-items:center"><span class="sport" style="color:${sportColor(w.type)};border-color:${sportColor(w.type)}">${esc(sportLabel(w.type))}</span>
      <span class="pill2">${w.target === 'hr' ? 'FC' : w.target === 'pace' ? 'Ritmo' : 'Potencia'}</span>${w.folder_name ? `<span class="muted" style="font-size:12px;margin-left:auto">${esc(w.folder_name)}</span>` : ''}</div>
      <h2 style="font-size:15px">${esc(w.name)}</h2>
      <div>${W.bars(p, { w: 400, h: 56, ref: false })}</div>
      <div class="num muted" style="font-size:12px">${p.totalSecs ? W.fmt(p.totalSecs) : '—'} · ${p.tss} TSS est.</div>
      <div style="display:flex;gap:8px;margin-top:auto"><a class="btn" style="height:38px;font-size:13px" href="/coach/workouts/nuevo?lib=${w.id}">Abrir / asignar</a>
        <form method="post" action="/coach/biblioteca/${w.id}/borrar" style="margin-left:auto"><button class="btn ghost" style="height:38px;font-size:13px" aria-label="Borrar ${esc(w.name)}">Borrar</button></form></div></article>`;
  }).join('');
  const f = (href, key, label, n) => `<a href="${href}" class="${String(current) === String(key) ? 'on' : ''}"><span>${esc(label)}</span><span class="num">${n || 0}</span></a>`;
  const body = `${EXTRA_CSS}
  <header class="head"><div><div class="th">Workouts guardados</div><h1>Biblioteca</h1></div><div class="right"><a class="btn" href="/coach/workouts/nuevo">${icon.plus}Nuevo workout</a></div></header>
  ${flash(msg)}
  <div class="cols">
    <aside class="card stack" style="width:260px;flex-shrink:0"><h2>Carpetas</h2>
      <nav class="fold" aria-label="Carpetas">${f('/coach/biblioteca', '', 'Todos', counts.all)}${f('/coach/biblioteca?carpeta=0', '0', 'Sin carpeta', counts[0])}
      ${folders.map((x) => f('/coach/biblioteca?carpeta=' + x.id, x.id, x.name, counts[x.id])).join('')}</nav>
      <form method="post" action="/coach/biblioteca/carpetas" class="stack" style="gap:8px"><label class="f">Nueva carpeta<input type="text" name="name" required placeholder="Ej. Base, Umbral, Leandro…"></label><button class="btn ghost">Crear carpeta</button></form>
      ${current && current !== '0' ? `<form method="post" action="/coach/biblioteca/carpetas/${current}/borrar"><button class="btn ghost" style="width:100%;font-size:13px">Borrar esta carpeta</button></form><span class="muted" style="font-size:12px">Los workouts quedan en «Sin carpeta».</span>` : ''}
    </aside>
    <section class="grow">${cards ? `<div class="grid3">${cards}</div>` : '<div class="card muted">Todavía no hay workouts acá. Armá uno en el constructor y tocá «Guardar en biblioteca».</div>'}</section>
  </div>`;
  return coachPage('Biblioteca', 'biblioteca', body, { unread });
}

// ---------------- Semana del atleta + proyección ----------------
function week({ a, mon, days, anchor, avg4w, lib, msg, unread }) {
  const today = todayISO();
  const sun = addDays(mon, 6);
  const inWeek = days.filter((d) => d.date >= mon && d.date <= sun);
  const cols = inWeek.map((d) => {
    const done = d.acts.map((x) => `<a class="it done" href="/coach/actividad/${x.id}"><span class="sport" style="color:${sportColor(x.type)};border-color:${sportColor(x.type)}">${esc(sportLabel(x.type))}</span><b>${esc(x.name || '')}</b><span class="num muted">${fmtDuration(x.moving_time)} · ${x.load != null ? Math.round(x.load) : '—'} TSS</span></a>`).join('');
    const plan = d.plan.map((p) => { const e = W.parse(p.description || '', { sport: p.type });
      return `<div class="it plan"><span class="sport" style="color:${sportColor(p.type)};border-color:${sportColor(p.type)}">${esc(sportLabel(p.type))}</span><b>${esc(p.name || 'Workout')}</b>${e.totalSecs ? W.bars(e, { w: 200, h: 30, ref: false }) : ''}<span class="num muted">${e.totalSecs ? W.fmt(e.totalSecs) + ' · ' : ''}${Math.round(p.load != null ? p.load : e.tss)} TSS</span></div>`; }).join('');
    return `<div class="dcol ${d.date === today ? 'today' : ''}"><div style="display:flex;justify-content:space-between;font-size:12px"><span style="font-weight:600">${dayName(d.date)}</span><span class="num muted">${fmtDate(d.date)}</span></div>
      ${done}${plan}<div id="sim-${d.date}" class="stack" style="gap:8px"></div>
      ${!done && !plan ? '<span class="muted" style="font-size:12px">Descanso</span>' : ''}
      <a href="/coach/workouts/nuevo?atleta=${a.id}&fecha=${d.date}" class="muted" style="font-size:12px;margin-top:auto">+ nuevo workout</a></div>`;
  }).join('');
  const groups = {};
  lib.forEach((w) => { (groups[w.folder_name || 'Sin carpeta'] = groups[w.folder_name || 'Sin carpeta'] || []).push(w); });
  const libOpts = Object.keys(groups).map((g) => `<optgroup label="${esc(g)}">${groups[g].map((w) => `<option value="${w.id}">${esc(w.name)} · ${esc(sportLabel(w.type))}</option>`).join('')}</optgroup>`).join('');
  const data = {
    today, mon, sun, anchor, avg4w,
    days: days.map((d) => ({ date: d.date, done: d.acts.reduce((s, x) => s + (x.load || 0), 0), planned: d.plan.reduce((s, p) => s + (p.load != null ? p.load : W.parse(p.description || '', { sport: p.type }).tss), 0),
      plans: d.date >= today && !d.acts.length ? d.plan.map((p) => ({ type: p.type, description: p.description || '' })) : [] })),
    lib: lib.map((w) => ({ id: w.id, name: w.name, type: w.type, description: w.description })),
    ctx: { ftp: a.ftp, paceSecKm: paceSecs(a.threshold_pace) },
  };
  const body = `${EXTRA_CSS}
  <div style="font-size:13px"><a href="/coach/atleta/${a.id}" class="muted">← ${esc(a.name)}</a></div>
  ${flash(msg)}
  <header class="head" style="align-items:center"><div><div class="th">Planificación semanal</div><h1>Semana de ${esc(a.name.split(' ')[0])}</h1></div>
    <div class="right"><a class="btn ghost" href="?d=${addDays(mon, -7)}" aria-label="Semana anterior">‹</a><span class="num" style="min-width:150px;text-align:center">${fmtDate(mon)} – ${fmtDate(sun)}</span><a class="btn ghost" href="?d=${addDays(mon, 7)}" aria-label="Semana siguiente">›</a></div></header>
  <div class="days7">${cols}</div>
  <div class="cols">
    <section class="card grow stack" aria-label="Proyección"><h2>Proyección de la semana</h2><div id="proj"></div></section>
    <aside class="aside"><section class="card stack" aria-label="Simular"><h2>Probar workouts</h2>
      <span class="muted" style="font-size:13px">Elegí un workout de la biblioteca y un día: la proyección se recalcula al instante. Recién se envía cuando confirmás.</span>
      ${lib.length ? `<label class="f">Workout<select id="simW">${libOpts}</select></label>
      <label class="f">Día<select id="simD">${inWeek.map((d) => `<option value="${d.date}" ${d.date < today ? 'disabled' : ''}>${dayName(d.date)} ${fmtDate(d.date)}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost" id="simAdd">+ Simular</button>
      <form method="post" action="/coach/atleta/${a.id}/semana/enviar?d=${mon}" id="simForm" class="stack" style="gap:8px"><input type="hidden" name="sims" id="simsField">
        <button class="btn" id="simSend" disabled>Enviar simulados a Intervals</button></form>` : '<span class="muted">Guardá workouts en la <a href="/coach/biblioteca" style="color:#F08A4B">biblioteca</a> para simularlos acá.</span>'}
    </section></aside>
  </div>
  <script src="/hyt-workout.js"></script>
  <script>
  (function(){
    var W=window.HyTWorkout, D=${JSON.stringify(data).replace(/</g, '\\u003c')}, sims=[];
    var $=function(id){return document.getElementById(id)};
    function est(w){return W.parse(w.description,{sport:w.type,ftp:D.ctx.ftp,paceSecKm:D.ctx.paceSecKm});}
    function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
    function fmtS(v){return (v>0?'+':'')+Math.round(v);}
    function project(){
      var ctl=D.anchor.ctl, atl=D.anchor.atl, ctlStart=null, atlStart=null, wLoad=0, zs=[0,0,0,0,0,0], planned=0;
      D.days.forEach(function(d){
        if(d.date===D.mon){ctlStart=ctl;atlStart=atl;}
        var simL=0; sims.forEach(function(s){if(s.date===d.date){var e=est(s.w);simL+=e.tss;e.zoneSecs.forEach(function(v,i){zs[i]+=v;});}});
        var load=d.date<D.today?d.done:(d.done>0?d.done:d.planned)+simL;
        if(d.date>=D.mon&&d.date<=D.sun){wLoad+=load; d.plans.forEach(function(p){var e=W.parse(p.description,{sport:p.type,ftp:D.ctx.ftp,paceSecKm:D.ctx.paceSecKm});e.zoneSecs.forEach(function(v,i){zs[i]+=v;});});}
        ctl+=(load-ctl)/42; atl+=(load-atl)/7;
      });
      if(ctlStart==null){ctlStart=D.anchor.ctl;atlStart=D.anchor.atl;}
      return {ctl0:ctlStart,atl0:atlStart,ctl:ctl,atl:atl,tsb:ctl-atl,ramp:ctl-ctlStart,load:wLoad,zs:zs};
    }
    function render(){
      if(D.anchor.ctl==null){$('proj').innerHTML='<p class="muted">Faltan datos de carga de este atleta (sincronizá primero).</p>';return;}
      var r=project(), zt=r.zs.reduce(function(a,b){return a+b;},0), ratio=D.avg4w?r.load/D.avg4w:null, out=[];
      var rampTxt=r.ramp<-1?['#9FB7DA','Semana de descarga','El fitness baja un poco y la fatiga se disipa: es cuando el cuerpo asimila el trabajo previo (supercompensación).']:
        r.ramp<3?['#B7C0CC','Mantenimiento','Se sostiene el nivel actual sin sumar estímulo nuevo.']:
        r.ramp<=6?['#3FB68B','Progresión sostenible','La carga crónica sube a un ritmo que el cuerpo tolera: mejora la capacidad de absorber más entrenamiento.']:
        r.ramp<=8?['#E8B33A','Progresión agresiva','Sube rápido: vigilá sueño, FC en reposo y sensaciones durante la semana.']:
        ['#F2645A','Riesgo de sobrecarga','La carga crece más de lo que suele tolerarse: considerá quitar volumen o intensidad.'];
      var tsbTxt=r.tsb<-30?'fatiga muy alta al terminar la semana':r.tsb<-10?'fatiga productiva (está entrenando)':r.tsb<=5?'equilibrado':'fresco: ideal antes de competir';
      var h='<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">'+
        '<div class="card metric"><span class="th">Carga semana</span><span class="v num">'+Math.round(r.load)+'</span><span class="muted" style="font-size:12px">'+(ratio?Math.round(ratio*100)+'% de su promedio (4 sem)':'TSS')+'</span></div>'+
        '<div class="card metric"><span class="th">Fitness (CTL)</span><span class="v num" style="color:#5B9BFF">'+Math.round(r.ctl0)+' → '+Math.round(r.ctl)+'</span><span class="num" style="font-size:12px;color:'+rampTxt[0]+'">'+fmtS(r.ramp)+' esta semana</span></div>'+
        '<div class="card metric"><span class="th">Fatiga (ATL) al domingo</span><span class="v num" style="color:#F08A4B">'+Math.round(r.atl)+'</span><span class="muted" style="font-size:12px">desde '+Math.round(r.atl0)+'</span></div>'+
        '<div class="card metric"><span class="th">Forma al lunes</span><span class="v num">'+fmtS(r.tsb)+'</span><span class="muted" style="font-size:12px">'+tsbTxt+'</span></div></div>';
      h+='<div class="alert" style="margin-top:6px"><span class="dot" style="background:'+rampTxt[0]+'"></span><div><span style="font-weight:600">'+rampTxt[1]+'</span><small>'+rampTxt[2]+'</small></div></div>';
      if(ratio&&ratio>1.3) h+='<div class="alert"><span class="dot" style="background:#F2645A"></span><div><span style="font-weight:600">Salto de carga: '+Math.round((ratio-1)*100)+'% sobre su promedio</span><small>Aumentos de más de ~30% semana a semana se asocian a más riesgo de lesión y fatiga no funcional.</small></div></div>';
      else if(ratio&&ratio<0.7) h+='<div class="alert"><span class="dot" style="background:#9FB7DA"></span><div><span style="font-weight:600">Semana liviana ('+Math.round(ratio*100)+'% del promedio)</span><small>Útil como descarga; si no es la intención, el estímulo puede quedarse corto.</small></div></div>';
      if(zt>0){
        var pct=r.zs.map(function(v){return v/zt*100;}), base=pct[0]+pct[1], thr=pct[3], hi=pct[4]+pct[5];
        h+='<h2 style="margin-top:8px;font-size:15px">Qué mejora apunta lo planificado</h2><div class="stack" style="gap:6px">';
        r.zs.forEach(function(v,i){if(!v)return;h+='<div class="zrow"><span style="color:'+W.ZCOL[i]+'">'+W.ZNAME[i]+'</span><span style="background:#1F262F;border-radius:3px"><i style="display:block;height:8px;border-radius:3px;width:'+pct[i].toFixed(0)+'%;background:'+W.ZCOL[i]+'"></i></span><span class="num" style="text-align:right">'+Math.round(pct[i])+'%</span></div>';});
        h+='</div><div class="stack" style="gap:10px;margin-top:8px">';
        if(base>=10) out.push(['#5B9BFF','Base aeróbica ('+Math.round(base)+'% del tiempo)','Más mitocondrias y capilares, mejor uso de grasas y economía. Es lo que permite tolerar y recuperar el trabajo intenso.']);
        if(pct[2]>=10) out.push(['#3FB68B','Tempo ('+Math.round(pct[2])+'%)','Resistencia muscular a ritmo sostenido. Da bastante fatiga para el estímulo que genera: si pasa del ~20%, conviene polarizar.']);
        if(thr>=5) out.push(['#E8B33A','Umbral ('+Math.round(thr)+'%)','Sube el FTP / umbral de lactato: sostener más potencia o ritmo antes de acumular lactato.']);
        if(hi>=3) out.push(['#F08A4B','VO2max y anaeróbico ('+Math.round(hi)+'%)','Eleva el techo aeróbico (VO2max) y la tolerancia a esfuerzos cortos y muy intensos.']);
        out.forEach(function(o){h+='<div class="alert"><span class="dot" style="background:'+o[0]+'"></span><div><span style="font-weight:600">'+o[1]+'</span><small>'+o[2]+'</small></div></div>';});
        h+='</div>';
      } else h+='<p class="muted" style="margin-top:8px">No hay workouts estructurados pendientes esta semana para analizar la intensidad. Simulá uno desde la biblioteca.</p>';
      h+='<p class="muted" style="font-size:12px;margin:8px 0 0">Estimación a partir de la carga (TSS) y el modelo CTL/ATL. La respuesta real depende del atleta: confirmala con sus sensaciones, FC en reposo y resultados.</p>';
      $('proj').innerHTML=h;
    }
    function drawSims(){
      D.days.forEach(function(d){var c=$('sim-'+d.date);if(c)c.innerHTML='';});
      sims.forEach(function(s,idx){var c=$('sim-'+s.date);if(!c)return;var e=est(s.w);
        var el=document.createElement('div');el.className='it sim';
        el.innerHTML='<span style="font-size:11px;color:#F4A77A">Simulado</span><b>'+esc(s.w.name)+'</b>'+W.bars(e,{w:200,h:30,ref:false})+'<span class="num muted">'+W.fmt(e.totalSecs)+' · '+e.tss+' TSS</span>';
        var b=document.createElement('button');b.type='button';b.className='chip';b.textContent='Quitar';b.onclick=function(){sims.splice(idx,1);update();};el.appendChild(b);c.appendChild(el);});
      if($('simsField')){$('simsField').value=JSON.stringify(sims.map(function(s){return {lib_id:s.w.id,date:s.date};}));$('simSend').disabled=!sims.length;
        $('simSend').textContent=sims.length?'Enviar '+sims.length+' simulado'+(sims.length>1?'s':'')+' a Intervals':'Enviar simulados a Intervals';}
    }
    function update(){drawSims();render();}
    if($('simAdd'))$('simAdd').onclick=function(){var id=+$('simW').value,w=D.lib.find(function(x){return x.id===id;});var day=$('simD').value;if(w&&day){sims.push({w:w,date:day});update();}};
    render();
  })();
  </script>`;
  return coachPage('Semana', '', body, { unread });
}

module.exports = { builder, library, week, estimate, TYPES };
