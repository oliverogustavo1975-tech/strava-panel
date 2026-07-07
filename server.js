require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const DATA_FILE = path.join(__dirname, 'data', 'athletes.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

function readAthletes() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveAthletes(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.get('/auth/strava', (req, res) => {
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&approval_prompt=auto&scope=read,activity:read_all,profile:read_all`;
  res.redirect(authUrl);
});

app.get('/auth/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.send('<h2>No se completo la conexion. Podes cerrar esta ventana e intentar de nuevo.</h2>');
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await response.json();

    if (tokenData.errors) {
      console.error(tokenData);
      return res.send('<h2>Hubo un error conectando con Strava. Avisale a tu entrenador.</h2>');
    }

    const athlete = tokenData.athlete;
    const athletes = readAthletes();

    athletes[athlete.id] = {
      name: `${athlete.firstname} ${athlete.lastname}`,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      connected_at: new Date().toISOString()
    };

    saveAthletes(athletes);

    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Conectado</title>
        <style>body{font-family:sans-serif;text-align:center;padding:60px;background:#fc4c02;color:white}</style>
        </head>
        <body>
          <h1>Listo, ${athlete.firstname}!</h1>
          <p>Tu cuenta de Strava quedo conectada. Tu entrenador ya puede ver tus entrenamientos.</p>
          <p>Ya podes cerrar esta ventana.</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error de servidor');
  }
});

app.get('/api/athletes', (req, res) => {
  const athletes = readAthletes();
  const list = Object.entries(athletes).map(([id, a]) => ({
    id,
    name: a.name,
    connected_at: a.connected_at
  }));
  res.json(list);
});

async function getValidAccessToken(athleteId) {
  const athletes = readAthletes();
  const athlete = athletes[athleteId];
  if (!athlete) return null;

  const now = Math.floor(Date.now() / 1000);
  if (athlete.expires_at > now + 60) {
    return athlete.access_token;
  }

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: athlete.refresh_token
    })
  });

  const data = await response.json();
  if (data.access_token) {
    athlete.access_token = data.access_token;
    athlete.refresh_token = data.refresh_token;
    athlete.expires_at = data.expires_at;
    athletes[athleteId] = athlete;
    saveAthletes(athletes);
    return data.access_token;
  }
  return null;
}

app.get('/api/athlete/:id/activities', async (req, res) => {
  try {
    const token = await getValidAccessToken(req.params.id);
    if (!token) return res.status(401).json({ error: 'No se pudo autenticar al atleta' });

    const after = Math.floor(Date.now() / 1000) - (90 * 24 * 60 * 60);
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const activities = await response.json();
    res.json(activities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error trayendo actividades' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
