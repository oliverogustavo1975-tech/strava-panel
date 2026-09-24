const { esc } = require('./util');

const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">';

const COACH_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#0E1217;color:#E8EBF0;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:14px}
a{color:#E8EBF0;text-decoration:none}a:hover{color:#F08A4B}
.num{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8B96A5;font-weight:500}
.muted{color:#8B96A5}
.app{display:flex;min-height:100vh}
.side{width:224px;flex-shrink:0;background:#11161C;border-right:1px solid #262E39;padding:24px 16px;display:flex;flex-direction:column;gap:28px;position:sticky;top:0;height:100vh}
.logo{display:flex;align-items:baseline;gap:8px;padding:0 8px}
.logo b{font-family:'Barlow Condensed',sans-serif;font-size:30px;color:#F08A4B;letter-spacing:.02em}
.logo span{font-size:12px;color:#8B96A5;letter-spacing:.12em;text-transform:uppercase}
.nav{display:flex;flex-direction:column;gap:2px}
.nav a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:8px;color:#B7C0CC}
.nav a.on{background:#1C222B;color:#E8EBF0;font-weight:500}
.nav .badge{margin-left:auto;font-size:11px;background:#F08A4B;color:#14100C;border-radius:10px;padding:1px 7px}
.main{flex:1;min-width:0;padding:28px 32px;display:flex;flex-direction:column;gap:22px}
h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:40px;line-height:1}
h2{margin:0;font-size:16px;font-weight:600}
.head{display:flex;align-items:flex-end;gap:24px;flex-wrap:wrap}
.head .right{margin-left:auto;display:flex;gap:10px;align-items:center}
.btn{height:44px;display:inline-flex;align-items:center;gap:8px;padding:0 18px;background:#F08A4B;color:#14100C;border:0;border-radius:8px;font:inherit;font-weight:600;cursor:pointer}
.btn:hover{background:#F4A06A;color:#14100C}
.btn.ghost{background:transparent;border:1px solid #262E39;color:#E8EBF0;font-weight:500}
.btn.ghost:hover{border-color:#3A4453}
.card{background:#161B22;border:1px solid #262E39;border-radius:10px;padding:16px 18px}
.card.warn{border-color:#5A2C22}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.kpi{display:flex;flex-direction:column;gap:6px}
.kpi .v{font-size:30px;font-weight:500}
.cols{display:flex;gap:18px;align-items:flex-start}
.grow{flex:1;min-width:0}
.aside{width:340px;flex-shrink:0;display:flex;flex-direction:column;gap:18px}
.table{padding:0}
.table .hd{display:flex;align-items:center;padding:16px 20px;border-bottom:1px solid #262E39;gap:12px}
.row{display:grid;grid-template-columns:2.1fr 1.1fr 56px 56px 64px 1.3fr 1.2fr 1fr;gap:12px;padding:12px 20px;border-bottom:1px solid #1F262F;align-items:center;min-height:56px}
.row.h{min-height:0;padding:10px 20px;border-bottom:1px solid #262E39}
a.row:hover{background:#1A2029;color:#E8EBF0}
.r{text-align:right}
.av{width:36px;height:36px;border-radius:50%;background:#262E39;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0}
.who{display:flex;align-items:center;gap:12px;min-width:0}
.who div{display:flex;flex-direction:column;min-width:0}
.who small{font-size:12px;color:#8B96A5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{flex:1;height:6px;background:#262E39;border-radius:3px}.bar i{display:block;height:6px;border-radius:3px}
.pill{justify-self:start;font-size:12px;font-weight:500;padding:4px 10px;border-radius:12px;border:1px solid}
.t-high{color:#F2645A;border-color:#F2645A}.t-mid{color:#E8B33A;border-color:#E8B33A}.t-ok{color:#3FB68B;border-color:#3FB68B}.t-fresh{color:#5B9BFF;border-color:#5B9BFF}
.alert{display:flex;gap:12px}.alert .dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0}
.alert div{display:flex;flex-direction:column;gap:3px}.alert small{font-size:13px;color:#8B96A5;line-height:1.45}
.stack{display:flex;flex-direction:column;gap:14px}
.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
.metric{display:flex;flex-direction:column;gap:4px}.metric .v{font-size:24px}
.week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px}
.day{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:8px;border:1px solid #262E39;min-height:118px}
.day .t{font-size:13px;font-weight:500;line-height:1.35}
.s-done{background:#16211D;border-color:#2B4A3E}.s-done .st{color:#6FD3A8}
.s-missed{background:#231818;border-color:#5A2C22}.s-missed .st{color:#F2A08A}
.s-today{background:#241B15;border-color:#F08A4B}.s-today .st{color:#F4A77A}
.s-planned .st{color:#9FB7DA}.s-rest .st{color:#8B96A5}
.st{font-size:11px;font-weight:500}
.legend{display:flex;gap:16px;font-size:12px;color:#B7C0CC;flex-wrap:wrap}.legend span{display:flex;align-items:center;gap:6px}
.list{display:flex;flex-direction:column}
.li{display:grid;grid-template-columns:86px 120px minmax(0,1fr) 64px 70px 74px 74px;gap:10px;padding:10px 0;border-bottom:1px solid #1F262F;align-items:center;font-size:13px}
.msg{display:flex;flex-direction:column;gap:4px;padding:10px 12px;background:#1C222B;border-radius:8px;max-width:92%}
.msg.me{background:#2A2019;align-self:flex-end}.msg small{font-size:12px;color:#8B96A5}
.thread{display:flex;flex-direction:column;gap:10px;max-height:340px;overflow:auto}
label.f{display:flex;flex-direction:column;gap:6px;font-size:12px;color:#8B96A5;letter-spacing:.04em}
input[type=text],input[type=date],input[type=password],input[type=search],select,textarea{background:#0E1217;border:1px solid #262E39;border-radius:8px;color:#E8EBF0;padding:0 12px;height:44px;font:inherit;font-size:14px;width:100%}
textarea{height:auto;padding:12px;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.55;resize:vertical}
input:focus,select:focus,textarea:focus,.btn:focus-visible,a:focus-visible{outline:2px solid #F08A4B;outline-offset:1px}
.form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.check{display:flex;align-items:center;gap:10px;min-height:40px;font-size:14px;color:#E8EBF0;letter-spacing:0}
.check input{width:18px;height:18px;accent-color:#F08A4B}
.flash{padding:12px 16px;border-radius:8px;background:#16211D;border:1px solid #2B4A3E;color:#6FD3A8}
.flash.err{background:#231818;border-color:#5A2C22;color:#F2A08A}
a.li:hover{background:#1A2029;color:#E8EBF0}.sport{font-size:11px;font-weight:500;padding:3px 8px;border-radius:10px;border:1px solid;justify-self:start;white-space:nowrap}
.sbar{height:10px;border-radius:3px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{height:36px;padding:0 12px;background:#1C222B;border:1px solid #262E39;border-radius:6px;color:#E8EBF0;font:inherit;font-size:12px;cursor:pointer}
.copy{font-family:'IBM Plex Mono',monospace;font-size:12px;background:#0E1217;border:1px solid #262E39;border-radius:6px;padding:8px 10px;word-break:break-all}
@media (max-width:1100px){.aside{width:100%}.cols{flex-direction:column}.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.row{grid-template-columns:2fr 56px 56px 64px 1fr}.row .hide{display:none}.side{display:none}}
`;

const ATHLETE_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#F4F1EA;color:#17191D;font-family:'IBM Plex Sans',system-ui,sans-serif}
a{color:#B8461A;text-decoration:none}a:hover{color:#8F3412}
.num{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums}
.muted{color:#5E6168}
.wrap{max-width:480px;margin:0 auto;padding:24px 20px 100px;display:flex;flex-direction:column;gap:16px}
h1{margin:0;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:32px;line-height:1.05}
h2{margin:0;font-size:20px;font-weight:600}
.card{background:#fff;border:1px solid #E3DED3;border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.dark{background:#17191D;color:#F4F1EA;border:0}
.kicker{font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#B8461A}
.dark .kicker{color:#C9C3B6}
.big{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:44px;line-height:1}
.dots{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.dots div{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:#5E6168}
.d{width:14px;height:14px;border-radius:50%;background:#EDE8DD}.d.done{background:#D9541E}.d.today{border:3px solid #D9541E;background:transparent}.d.missed{background:#C9C3B6}.d.rest{height:4px;margin:5px 0;border-radius:2px;background:#D8D2C4}
.tabs{position:fixed;left:0;right:0;bottom:0;height:72px;background:#fff;border-top:1px solid #E3DED3;display:flex;justify-content:center}
.tabs nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;max-width:480px}
.tabs a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font-size:11px;color:#5E6168}
.tabs a.on{color:#B8461A;font-weight:600}
pre.w{margin:0;white-space:pre-wrap;font-family:'IBM Plex Mono',monospace;font-size:13px;line-height:1.55;color:#45484F;background:#F8F6F1;border-radius:10px;padding:12px}
.btn{height:48px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 18px;background:#17191D;color:#F4F1EA;border:0;border-radius:24px;font:inherit;font-weight:500;cursor:pointer}
.btn:hover{color:#fff;background:#2B2E33}
textarea,input[type=file]{width:100%;font:inherit;font-size:15px;border:1px solid #D8D2C4;border-radius:12px;padding:12px;background:#fff}
.msg{padding:10px 12px;border-radius:12px;background:#F4F1EA;display:flex;flex-direction:column;gap:3px;max-width:88%}
.msg.me{background:#FBE3D5;align-self:flex-end}.msg small{font-size:12px;color:#5E6168}
.step{display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.5}
.step b{width:26px;height:26px;border-radius:50%;background:#17191D;color:#F4F1EA;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px}
.flash{padding:12px 16px;border-radius:12px;background:#E4EEE7;color:#1F4A36}
.flash.err{background:#F8E1DA;color:#7A2A14}
.bars{display:flex;gap:3px;height:28px;align-items:flex-end}
`;

const icon = {
  panel: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .7 3.2 2.5 3.6 5.2"/></svg>',
  bars: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 20V14h4v6M10 20V6h4v14M17 20v-9h4v9"/></svg>',
  folder: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/></svg>',
  sync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 13a8 8 0 0 0 14.5 4.5L20 16"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
  out: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
  chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  watch: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6V3h6v3M9 18v3h6v-3M12 10v2.5l1.5 1"/></svg>',
};

function coachPage(title, active, body, { unread = 0 } = {}) {
  const nav = [
    ['/coach', 'panel', 'Panel', icon.panel],
    ['/coach/atletas/nuevo', 'nuevo', 'Agregar atleta', icon.users],
    ['/coach/workouts/nuevo', 'workouts', 'Nuevo workout', icon.bars],
    ['/coach/biblioteca', 'biblioteca', 'Biblioteca', icon.folder],
  ].map(([h, k, t, i]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${i}${t}${k === 'panel' && unread ? `<span class="badge num">${unread}</span>` : ''}</a>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · HyT</title>${FONTS}<style>${COACH_CSS}</style></head><body><div class="app">
<nav class="side" aria-label="Principal"><div class="logo"><b>HyT</b><span>Entrenamiento</span></div><div class="nav">${nav}</div>
<div style="margin-top:auto" class="nav">
<form method="post" action="/coach/sync"><button class="btn ghost" style="width:100%">${icon.sync}Sincronizar todo</button></form>
<form method="post" action="/logout"><button class="btn ghost" style="width:100%;border:0;color:#8B96A5">${icon.out}Salir</button></form></div></nav>
<main class="main">${body}</main></div></body></html>`;
}

function athletePage(title, token, active, body) {
  const t = encodeURIComponent(token);
  const tabs = [[`/a/${t}`, 'inicio', 'Inicio', icon.home], [`/a/${t}/mensajes`, 'mensajes', 'Coach', icon.chat], [`/a/${t}/conectar`, 'conectar', 'Dispositivos', icon.watch]]
    .map(([h, k, l, i]) => `<a href="${h}" class="${active === k ? 'on' : ''}">${i}${l}</a>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#F4F1EA"><title>${esc(title)} · HyT</title>${FONTS}<style>${ATHLETE_CSS}</style></head><body>
<div class="wrap">${body}</div><div class="tabs"><nav aria-label="Navegación">${tabs}</nav></div></body></html>`;
}

function barePage(title, body) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>${FONTS}<style>${COACH_CSS}</style></head><body>${body}</body></html>`;
}

module.exports = { coachPage, athletePage, barePage, icon };
