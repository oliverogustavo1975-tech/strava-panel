require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./db");
const { resourceStatus } = require("./lib/status");
const { requireAuth, ADMIN_PASSWORD } = require("./lib/auth");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "torre-secret-dev",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 },
  })
);
app.use((req, res, next) => {
  res.locals.isAdmin = !!(req.session && req.session.isAdmin);
  next();
});

const TIPOS = ["grua", "camion", "remolque", "operario"];
const TIPO_LABEL_PL = { grua: "Grúas", camion: "Camiones", remolque: "Remolques", operario: "Operarios" };
const PAISES = ["uruguay", "argentina", "brasil"];
const PAIS_LABEL = { uruguay: "Uruguay", argentina: "Argentina", brasil: "Brasil", "": "Sin país asignado" };
const PAIS_FLAG = { uruguay: "🇺🇾", argentina: "🇦🇷", brasil: "🇧🇷", "": "❔" };

const ESTADO_JOB_LABEL = { pendiente: "Pendiente", en_curso: "En curso", finalizado: "Finalizado", cancelado: "Cancelado" };
const ESTADO_JOB_PILL = { pendiente: "mantenimiento", en_curso: "ocupado", finalizado: "disponible", cancelado: "baja" };

function buildNameMap(resources) {
  const map = {};
  for (const r of resources) map[r.id] = r.nombre;
  return map;
}

function namesFor(ids, nameMap) {
  return (ids || []).map(id => nameMap[id] || id);
}

app.get("/", (req, res) => res.redirect("/recursos"));

app.get("/login", (req, res) => {
  res.render("login", { error: null, next: req.query.next || "/recursos" });
});

app.post("/login", (req, res) => {
  const next = req.body.next || "/recursos";
  if (!ADMIN_PASSWORD) {
    return res.render("login", { error: "Todavía no se configuró la contraseña en el servidor (variable ADMIN_PASSWORD en Render).", next });
  }
  if (req.body.password && req.body.password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect(next);
  }
  res.render("login", { error: "Contraseña incorrecta", next });
});

app.post("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/recursos"));
});

app.get("/recursos", async (req, res, next) => {
  try {
    const [{ rows: resources }, { rows: jobs }] = await Promise.all([
      db.query("SELECT * FROM resources ORDER BY nombre"),
      db.query("SELECT * FROM jobs WHERE estado <> 'cancelado'"),
    ]);

    const withStatus = resources.map(r => ({ ...r, status: resourceStatus(r, jobs) }));

    const counts = {};
    for (const t of TIPOS) {
      const list = withStatus.filter(r => r.tipo === t);
      counts[t] = {
        total: list.length,
        disponible: list.filter(r => r.status.code === "disponible").length,
        ocupado: list.filter(r => r.status.code === "ocupado").length,
        mantenimiento: list.filter(r => r.status.code === "mantenimiento").length,
        baja: list.filter(r => r.status.code === "baja").length,
      };
    }

    const byPais = [...PAISES, ""].map(pais => {
      const inPais = withStatus.filter(r => (r.pais || "") === pais);
      return { pais, label: PAIS_LABEL[pais], flag: PAIS_FLAG[pais], resources: inPais };
    }).filter(g => g.resources.length);

    res.render("recursos", { TIPOS, TIPO_LABEL_PL, counts, byPais, generatedAt: new Date() });
  } catch (err) {
    next(err);
  }
});
app.use("/recursos", require("./routes/recursos"));

app.get("/trabajos", async (req, res, next) => {
  try {
    const [{ rows: jobs }, { rows: resources }] = await Promise.all([
      db.query("SELECT * FROM jobs ORDER BY fecha_inicio DESC"),
      db.query("SELECT id, nombre FROM resources"),
    ]);
    const nameMap = buildNameMap(resources);

    const withNames = jobs.map(j => ({
      ...j,
      estadoLabel: ESTADO_JOB_LABEL[j.estado] || j.estado,
      estadoPill: ESTADO_JOB_PILL[j.estado] || "mantenimiento",
      gruasNombres: namesFor(j.gruas, nameMap),
      camionesNombres: namesFor(j.camiones, nameMap),
      remolquesNombres: namesFor(j.remolques, nameMap),
      operariosNombres: namesFor(j.operarios, nameMap),
    }));

    const activos = withNames.filter(j => j.estado === "pendiente" || j.estado === "en_curso");
    const cerrados = withNames.filter(j => j.estado === "finalizado" || j.estado === "cancelado");

    res.render("trabajos", { activos, cerrados, generatedAt: new Date() });
  } catch (err) {
    next(err);
  }
});
app.use("/trabajos", require("./routes/trabajos"));

app.get("/fletes", async (req, res, next) => {
  try {
    const [{ rows: fletes }, { rows: resources }, { rows: jobs }] = await Promise.all([
      db.query("SELECT * FROM fletes ORDER BY fecha DESC NULLS FIRST, created_at DESC"),
      db.query("SELECT id, nombre FROM resources"),
      db.query("SELECT id, titulo FROM jobs"),
    ]);
    const nameMap = buildNameMap(resources);
    const jobMap = {};
    for (const j of jobs) jobMap[j.id] = j.titulo;

    const withNames = fletes.map(f => ({
      ...f,
      camionNombre: f.camion_id ? (nameMap[f.camion_id] || f.camion_id) : null,
      remolqueNombre: f.remolque_id ? (nameMap[f.remolque_id] || f.remolque_id) : null,
      choferNombre: f.chofer_id ? (nameMap[f.chofer_id] || f.chofer_id) : null,
      gruaNombre: f.grua_id ? (nameMap[f.grua_id] || f.grua_id) : null,
      trabajoTitulo: f.trabajo_id ? (jobMap[f.trabajo_id] || f.trabajo_id) : null,
      llegado: !!f.fecha_llegada,
    }));

    res.render("fletes", { fletes: withNames, generatedAt: new Date() });
  } catch (err) {
    next(err);
  }
});
app.use("/fletes", require("./routes/fletes"));

app.get("/deposito", async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM deposito ORDER BY fecha_ingreso DESC NULLS LAST, created_at DESC");
    const dentro = rows.filter(d => !d.fecha_egreso);
    const salidos = rows.filter(d => d.fecha_egreso);
    res.render("deposito", { dentro, salidos, generatedAt: new Date() });
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Error del servidor: " + err.message);
});

app.listen(PORT, () => {
  console.log(`Torre corriendo en http://localhost:${PORT}`);
});
