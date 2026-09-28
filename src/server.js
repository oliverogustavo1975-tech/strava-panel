require("dotenv").config();
const express = require("express");
const path = require("path");
const db = require("./db");
const { resourceStatus } = require("./lib/status");

const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "..", "public")));

const TIPOS = ["grua", "camion", "remolque", "operario"];
const TIPO_LABEL_PL = { grua: "Grúas", camion: "Camiones", remolque: "Remolques", operario: "Operarios" };
const PAISES = ["uruguay", "argentina", "brasil"];
const PAIS_LABEL = { uruguay: "Uruguay", argentina: "Argentina", brasil: "Brasil", "": "Sin país asignado" };
const PAIS_FLAG = { uruguay: "🇺🇾", argentina: "🇦🇷", brasil: "🇧🇷", "": "❔" };

app.get("/", (req, res) => res.redirect("/recursos"));

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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Error del servidor: " + err.message);
});

app.listen(PORT, () => {
  console.log(`Torre corriendo en http://localhost:${PORT}`);
});
