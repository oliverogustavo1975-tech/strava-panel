# Torre

Plataforma de logística y gestión de flota (grúas, camiones, remolques, operarios).
Arranca como espejo mejorado de "Torre de Control" (el artifact de Claude): por ahora
solo lectura de recursos y disponibilidad, con datos reales migrados.

Stack: Node.js + Express + EJS + Postgres (sin ORM, SQL directo con `pg`) — mismo
stack que ya usás en `strava-panel`, pero con Postgres desde el arranque para no
repetir el problema del disco efímero (perder `athletes.json` al dormir/redeploy).

## Estructura

```
db/schema.sql     esquema de la base (tablas: resources, jobs, fletes, deposito)
db/migrate.js     aplica schema.sql (correr una vez, y de nuevo si cambia el esquema)
db/seed.js        carga db/seed-data.json (snapshot de Torre de Control) en la base
db/seed-data.json snapshot de datos: 119 recursos, 18 trabajos, 7 fletes, 13 depósito
src/server.js     servidor Express
src/db.js         conexión a Postgres
src/lib/status.js lógica de estado disponible/ocupado/mantenimiento/baja
src/views/        vistas EJS
public/           CSS estático
```

## Desarrollo local

Necesitás Node 18+ y Postgres corriendo localmente (o cualquier Postgres accesible).

```bash
npm install
cp .env.example .env        # ajustá DATABASE_URL si hace falta
node db/migrate.js          # crea las tablas
node db/seed.js             # carga los datos de ejemplo (snapshot de Torre de Control)
npm run dev                 # http://localhost:3000
```

## Desplegar en Render

1. En Render: **New → PostgreSQL** — creá una base (plan gratuito o el que prefieras).
   Copiá su **Internal Database URL**.
2. En Render: **New → Web Service**, conectado a este repo de GitHub.
   - Build command: `npm install`
   - Start command: `node db/migrate.js && npm start`
     (así cada deploy aplica el esquema solo si hace falta — es idempotente)
   - Variable de entorno `DATABASE_URL` = la Internal Database URL del paso 1
3. Primera carga de datos: desde tu máquina, con la **External Database URL** de Render
   en `DATABASE_URL`, corré `node db/seed.js` una sola vez para poblar la base en
   producción con el snapshot inicial. Los datos que cargues después ya quedan ahí
   (Postgres no es efímero como el disco de Render).

## Qué sigue (en orden)

1. ~~Esqueleto + base de datos + vista de recursos (solo lectura)~~ ← estamos acá
2. Vista de trabajos/calendario y fletes (solo lectura), igual que en Torre de Control
3. Login básico y edición (alta/baja de recursos, asignación a trabajos)
4. GPS: integrar Traccar Client (celular del chofer) + soporte GPS propio del camión
5. Asistente de IA para alertas y sugerencias
6. Identidad visual: logo y siluetas de equipos de fondo (grúas, camiones, puerto)
