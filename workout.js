// Motor de workouts HyT: lee el formato de Intervals.icu, estima duración/TSS/zonas,
// dibuja las barras y convierte texto libre ("4x8' al 95% rec 4'") al formato estructurado.
// Funciona igual en el servidor (require) y en el navegador (window.HyTWorkout).
(function (root) {
  var ZPCT = { 1: 50, 2: 68, 3: 83, 4: 98, 5: 112, 6: 130, 7: 150 };
  var ZCOL = ['#4C6A8F', '#5B9BFF', '#3FB68B', '#E8B33A', '#F08A4B', '#F2645A'];
  var ZNAME = ['Z1 Recuperación', 'Z2 Aeróbico', 'Z3 Tempo', 'Z4 Umbral', 'Z5 VO2max', 'Z6 Anaeróbico'];
  var SUFFIX = { power: { pct: '', zone: '' }, hr: { pct: ' LTHR', zone: ' HR' }, pace: { pct: ' Pace', zone: ' Pace' } };

  // Equivalencias entre zonas de potencia (%FTP), FC (%FC umbral, Coggan) y ritmo (%velocidad umbral)
  var MAPS = {
    hr: [[0, 0], [55, 68], [75, 83], [90, 94], [105, 105], [120, 110], [150, 113], [300, 120]],
    pace: [[0, 0], [55, 78], [75, 88], [90, 95], [105, 102], [120, 108], [150, 115], [300, 130]],
  };
  function interp(pts, x, inv) {
    var a = inv ? 1 : 0, b = inv ? 0 : 1;
    for (var i = 1; i < pts.length; i++) if (x <= pts[i][a]) { var p0 = pts[i - 1], p1 = pts[i]; return p0[b] + (x - p0[a]) / (p1[a] - p0[a]) * (p1[b] - p0[b]); }
    return pts[pts.length - 1][b];
  }
  function toPower(v, src) { return src === 'power' || !MAPS[src] ? v : interp(MAPS[src], v, true); }
  function fromPower(v, dst) { return dst === 'power' || !MAPS[dst] ? v : interp(MAPS[dst], v, false); }

  function zoneOf(p) { return p < 56 ? 0 : p < 76 ? 1 : p < 91 ? 2 : p < 106 ? 3 : p < 121 ? 4 : 5; }

  function durSecs(tok) {
    var t = String(tok).toLowerCase().replace(/[′’']/g, 'm').replace(/min$/, 'm');
    var hm = t.match(/^(\d+)h(\d+)$/);
    if (hm) return +hm[1] * 3600 + +hm[2] * 60;
    var m = t.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/);
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    return Math.round((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0));
  }
  function distM(tok) {
    var m = String(tok).toLowerCase().match(/^(\d+(?:\.\d+)?)(km|mtr)$/);
    return m ? (m[2] === 'km' ? +m[1] * 1000 : +m[1]) : null;
  }

  function parseStep(str, ctx, label) {
    var toks = str.trim().split(/\s+/), s = { secs: null, dist: null, lo: null, hi: null, ramp: false, cad: null, kind: 'power', label: label, notes: [] };
    toks.forEach(function (tok) {
      var m, d;
      if (/^ramp$/i.test(tok)) s.ramp = true;
      else if ((d = distM(tok)) != null) s.dist = d;
      else if ((d = durSecs(tok)) != null) s.secs = d;
      else if ((m = tok.match(/^(\d+)(?:-(\d+))?%$/))) { s.lo = +m[1]; s.hi = m[2] ? +m[2] : +m[1]; }
      else if ((m = tok.match(/^z(\d)(?:-z(\d))?$/i))) { s.lo = ZPCT[+m[1]] || 60; s.hi = ZPCT[+(m[2] || m[1])] || 60; s.zone = true; }
      else if (/^(lthr|hr)$/i.test(tok)) s.kind = 'hr';
      else if (/^pace$/i.test(tok)) s.kind = 'pace';
      else if ((m = tok.match(/^(\d+)(?:-(\d+))?rpm$/i))) s.cad = tok;
      else if ((m = tok.match(/^(\d+)(?:-(\d+))?w$/i)) && ctx.ftp) { s.lo = Math.round(+m[1] / ctx.ftp * 100); s.hi = Math.round(+(m[2] || m[1]) / ctx.ftp * 100); }
      else s.notes.push(tok);
    });
    if (s.lo == null) { s.lo = 60; s.hi = 60; s.noTarget = true; }
    else if (!s.zone && s.kind !== 'power') { s.lo = Math.round(toPower(s.lo, s.kind)); s.hi = Math.round(toPower(s.hi, s.kind)); }
    s.pct = (s.lo + s.hi) / 2;
    if (s.secs == null && s.dist != null) {
      var sport = ctx.sport || '';
      var eff = Math.max(0.5, s.pct / 100);
      if (/Swim/.test(sport)) s.secs = Math.round(s.dist / 100 * (ctx.swimSec100 || 120) / eff);
      else if (/Ride/.test(sport)) s.secs = Math.round(s.dist / 1000 / 30 * 3600);
      else if (/Walk|Hike/.test(sport)) s.secs = Math.round(s.dist / 1000 * 660);
      else s.secs = Math.round(s.dist / 1000 * (ctx.paceSecKm || 300) / eff);
    }
    if (s.secs == null) s.secs = 0;
    s.zoneIdx = zoneOf(s.pct);
    return s;
  }

  function parse(text, ctx) {
    ctx = ctx || {};
    var lines = String(text || '').replace(/\r/g, '').split('\n'), steps = [], label = null, i = 0;
    while (i < lines.length) {
      var l = lines[i].trim(), rep = l.match(/(?:^|\s)(\d+)\s*x\s*$/i);
      if (!l) { i++; continue; }
      if (rep) {
        var n = Math.min(+rep[1], 50), block = [], hdr = l.replace(/(?:^|\s)\d+\s*x\s*$/i, '').trim() || label;
        i++;
        while (i < lines.length && lines[i].trim().charAt(0) === '-') { block.push(parseStep(lines[i].trim().slice(1), ctx, hdr)); i++; }
        for (var r = 0; r < n; r++) block.forEach(function (b) { var c = {}; for (var k in b) c[k] = b[k]; c.rep = r + 1; c.reps = n; steps.push(c); });
        continue;
      }
      if (l.charAt(0) === '-') steps.push(parseStep(l.slice(1), ctx, label));
      else label = l;
      i++;
    }
    var total = 0, tss = 0, zs = [0, 0, 0, 0, 0, 0];
    steps.forEach(function (s) { total += s.secs; tss += s.secs / 3600 * Math.pow(s.pct / 100, 2) * 100; zs[s.zoneIdx] += s.secs; });
    return { steps: steps, totalSecs: total, tss: Math.round(tss), ifAvg: total ? Math.sqrt(tss / (total / 36)) : 0, zoneSecs: zs };
  }

  function bars(p, o) {
    o = o || {}; var W = o.w || 600, H = o.h || 90, max = 150;
    if (!p || !p.totalSecs) return '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"></svg>';
    var x = 0, out = '', gap = p.steps.length > 60 ? 0 : 1;
    p.steps.forEach(function (s) {
      var w = s.secs / p.totalSecs * W, y1 = H - Math.min(s.lo, max) / max * H, y2 = H - Math.min(s.hi, max) / max * H, c = ZCOL[s.zoneIdx];
      if (w > 0) {
        if (s.ramp && s.lo !== s.hi) out += '<polygon points="' + x.toFixed(1) + ',' + H + ' ' + x.toFixed(1) + ',' + y1.toFixed(1) + ' ' + (x + w - gap).toFixed(1) + ',' + y2.toFixed(1) + ' ' + (x + w - gap).toFixed(1) + ',' + H + '" fill="' + c + '"/>';
        else { var y = H - Math.min(s.pct, max) / max * H; out += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + Math.max(0.5, w - gap).toFixed(1) + '" height="' + (H - y).toFixed(1) + '" rx="1.5" fill="' + c + '"/>'; }
      }
      x += w;
    });
    var ref = H - 100 / max * H;
    return '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Perfil del workout">' +
      (o.ref !== false ? '<line x1="0" y1="' + ref + '" x2="' + W + '" y2="' + ref + '" stroke="#E8EBF0" stroke-opacity=".3" stroke-dasharray="4 4"/>' : '') + out + '</svg>';
  }

  function convertTarget(text, target) {
    target = SUFFIX[target] ? target : 'power';
    var sf = SUFFIX[target];
    return String(text || '').split('\n').map(function (l) {
      if (l.trim().charAt(0) !== '-') return l;
      return l.replace(/(\d+)(?:-(\d+))?%(?:\s+(LTHR|HR|Pace))?/gi, function (m0, a, b, suf) {
          var src = !suf ? 'power' : /pace/i.test(suf) ? 'pace' : 'hr';
          var cv = function (v) { return src === target ? +v : Math.round(fromPower(toPower(+v, src), target)); };
          var lo = cv(a), hi = b ? cv(b) : null;
          return lo + (hi != null && hi !== lo ? '-' + hi : '') + '%' + sf.pct;
        })
        .replace(/\b(Z\d(?:-Z\d)?)(?:\s+(?:HR|Pace))?/gi, function (m0, z) { return z.toUpperCase() + sf.zone; });
    }).join('\n');
  }

  // Texto libre en español → formato estructurado
  function fromFreeText(text, target, ctx) {
    ctx = ctx || {}; target = target || 'power';
    var sf = SUFFIX[target] || SUFFIX.power;
    if (/^\s*-\s*\d/m.test(text) && /\n/.test(text)) return convertTarget(text, target);
    var unitMap = function (u) { u = (u || '').toLowerCase(); return u === 'h' ? 'h' : u === 's' ? 's' : u === 'km' ? 'km' : u === 'mtr' ? 'mtr' : 'm'; };
    var durOf = function (num, unit) {
      var v = parseFloat(String(num).replace(',', '.')), u = unitMap(unit);
      if (!unit && /Swim/.test(ctx.sport || '') && v >= 25) u = 'mtr';
      if (u === 'h' && v % 1) return Math.round(v * 60) + 'm';
      if (u === 'm' && v % 1) return Math.round(v * 60) + 's';
      return (u === 'km' ? v : Math.round(v)) + u;
    };
    var intensity = function (t) {
      var m;
      if ((m = t.match(/(\d{2,3})\s*(?:-|a|al)\s*(\d{2,3})\s*%/))) return m[1] + '-' + m[2] + '%' + sf.pct;
      if ((m = t.match(/(\d{2,3})\s*%/))) return m[1] + '%' + sf.pct;
      if ((m = t.match(/\bz\s?(\d)(?:\s*-\s*z?\s?(\d))?/))) return 'Z' + m[1] + (m[2] ? '-Z' + m[2] : '') + sf.zone;
      if ((m = t.match(/(\d{2,3})\s*(?:lpm|ppm|bpm)/)) && ctx.lthr) return Math.round(+m[1] / ctx.lthr * 100) + '% LTHR';
      if ((m = t.match(/\b(\d{1,2}):(\d{2})\b/)) && ctx.paceSecKm) return Math.round(ctx.paceSecKm / (+m[1] * 60 + +m[2]) * 100) + '% Pace';
      if ((m = t.match(/(\d{2,4})\s*(?:w|watts|vatios)\b/)) && ctx.ftp) return Math.round(+m[1] / ctx.ftp * 100) + '%';
      if (/suave|regenerativ|recuper/.test(t)) return target === 'power' ? '55%' : 'Z1' + sf.zone;
      if (/tempo/.test(t)) return target === 'power' ? '80-85%' : 'Z3' + sf.zone;
      if (/umbral/.test(t)) return target === 'power' ? '95-100%' : 'Z4' + sf.zone;
      if (/vo2|fuerte|max/.test(t)) return target === 'power' ? '110-120%' : 'Z5' + sf.zone;
      return null;
    };
    var recInt = target === 'power' ? '50%' : 'Z1' + sf.zone;
    var U = "(h|min|'|s|km|mtr)?";
    var segs = String(text).replace(/\r/g, '').split(/\n|;|,(?!\d)|\s\+\s|\.\s+/).map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    segs.forEach(function (s) {
      var t = s.toLowerCase().replace(/[’′´]/g, "'").replace(/×/g, 'x')
        .replace(/minutos?|mins?\b/g, 'min').replace(/segundos?|segs?\b/g, 's').replace(/horas?|hs\b/g, 'h').replace(/metros|mts?\b/g, 'mtr');
      var cad = (t.match(/(\d{2,3}(?:-\d{2,3})?)\s*rpm/) || [])[1];
      var cadS = cad ? ' ' + cad + 'rpm' : '';
      var rep = t.match(new RegExp('(\\d+)\\s*x\\s*(\\d+(?:[.,]\\d+)?)\\s*' + U));
      if (rep) {
        var rest = t.slice(rep.index + rep[0].length);
        var rec = rest.match(new RegExp("(?:rec(?:uperaci[oó]n)?|pausa|descanso|recu)\\s*(?:de\\s*)?(\\d+(?:[.,]\\d+)?)\\s*" + U)) ||
                  rest.match(new RegExp("(\\d+(?:[.,]\\d+)?)\\s*" + U + "\\s*(?:de\\s*)?(?:rec(?:uperaci[oó]n)?|pausa|descanso|suave)"));
        var workTxt = rec ? rest.replace(rec[0], ' ') : rest;
        out.push(rep[1] + 'x');
        out.push('- ' + durOf(rep[2], rep[3]) + ' ' + (intensity(workTxt) || (target === 'power' ? '95%' : 'Z4' + sf.zone)) + cadS);
        if (rec) out.push('- ' + durOf(rec[1], rec[2]) + ' ' + recInt);
        out.push('');
        return;
      }
      var d = t.match(new RegExp('(\\d+(?:[.,]\\d+)?)\\s*' + "(h|min|'|s|km|mtr)"));
      if (!d) { if (/[a-z]/.test(t)) out.push(s); return; }
      var lbl = null, def = target === 'power' ? '65-75%' : 'Z2' + sf.zone, ramp = '';
      if (/calent|entrada en calor|activaci/.test(t)) { lbl = 'Calentamiento'; def = target === 'power' ? '50-70%' : 'Z1-Z2' + sf.zone; if (target === 'power') ramp = 'ramp '; }
      else if (/vuelta a la calma|enfri|afloj|calma/.test(t)) { lbl = 'Vuelta a la calma'; def = target === 'power' ? '50%' : 'Z1' + sf.zone; }
      var inten = intensity(t.replace(d[0], ' '));
      if (lbl) out.push(lbl);
      out.push('- ' + durOf(d[1], d[2]) + ' ' + (inten ? inten : ramp + def) + cadS);
      out.push('');
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  function fmt(secs) { var h = Math.floor(secs / 3600), m = Math.round(secs % 3600 / 60); return h ? h + 'h' + (m < 10 ? '0' : '') + m : m + '′'; }

  var api = { parse: parse, bars: bars, convertTarget: convertTarget, fromFreeText: fromFreeText, fmt: fmt, ZCOL: ZCOL, ZNAME: ZNAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HyTWorkout = api;
})(this);
