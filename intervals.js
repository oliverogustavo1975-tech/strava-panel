// Cliente mínimo de la API de Intervals.icu usando la API key del COACH.
// Los atletas agregan al coach en Intervals.icu (Configuración → Coach) y con eso
// la key del coach puede leer sus datos y escribir en su calendario.
const BASE = process.env.INTERVALS_BASE || 'https://intervals.icu/api/v1';

function authHeader() {
  const key = process.env.INTERVALS_API_KEY;
  if (!key) throw new Error('Falta INTERVALS_API_KEY');
  return 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64');
}

async function call(method, path, { query, body, form } = {}) {
  const url = new URL(BASE + path);
  if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const headers = { Authorization: authHeader(), Accept: 'application/json' };
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(url, { method, headers, body: payload });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Intervals ${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('json') ? res.json() : res.text();
}

module.exports = {
  athlete: (id) => call('GET', `/athlete/${id}`),
  activities: (id, oldest, newest) => call('GET', `/athlete/${id}/activities`, { query: { oldest, newest } }),
  wellness: (id, oldest, newest) => call('GET', `/athlete/${id}/wellness`, { query: { oldest, newest } }),
  events: (id, oldest, newest) => call('GET', `/athlete/${id}/events`, { query: { oldest, newest } }),
  streams: (activityId, types) => call('GET', `/activity/${activityId}/streams`, { query: { types } })
    .catch(() => call('GET', `/activity/${activityId}/streams.json`, { query: { types } })),
  createEvent: (id, event) => call('POST', `/athlete/${id}/events`, { body: event }),
  uploadFile: (id, buffer, filename) => {
    const form = new FormData();
    form.append('file', new Blob([buffer]), filename);
    return call('POST', `/athlete/${id}/activities`, { form });
  },
};
