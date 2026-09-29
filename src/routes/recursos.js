const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../lib/auth");

const genId = () => crypto.randomBytes(10).toString("hex");
const str = v => (v === undefined || v === null || v === "" ? null : String(v));
const num = v => (v === undefined || v === null || v === "" ? null : Number(v));

router.get("/nuevo", requireAuth, (req, res) => {
  res.render("recurso-form", { r: {}, isNew: true });
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const id = genId();
    await db.query(
      `INSERT INTO resources (id, tipo, nombre, identificador, pais, estado_base,
         capacidad_ton, tara_ton, tipo_remolque, largo_m, especialidad,
         ubicacion_texto, ubicacion_maps_url, notas)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id, b.tipo, b.nombre, str(b.identificador), str(b.pais), b.estado_base || "activo",
        num(b.capacidad_ton), num(b.tara_ton), str(b.tipo_remolque), num(b.largo_m), str(b.especialidad),
        str(b.ubicacion_texto), str(b.ubicacion_maps_url), str(b.notas),
      ]
    );
    res.redirect("/recursos");
  } catch (err) {
    next(err);
  }
});

router.get("/:id/editar", requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query("SELECT * FROM resources WHERE id=$1", [req.params.id]);
    if (!rows.length) return res.status(404).send("Recurso no encontrado");
    res.render("recurso-form", { r: rows[0], isNew: false });
  } catch (err) {
    next(err);
  }
});

router.post("/:id", requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    await db.query(
      `UPDATE resources SET tipo=$2, nombre=$3, identificador=$4, pais=$5, estado_base=$6,
         capacidad_ton=$7, tara_ton=$8, tipo_remolque=$9, largo_m=$10, especialidad=$11,
         ubicacion_texto=$12, ubicacion_maps_url=$13, notas=$14, updated_at=now()
       WHERE id=$1`,
      [
        req.params.id, b.tipo, b.nombre, str(b.identificador), str(b.pais), b.estado_base || "activo",
        num(b.capacidad_ton), num(b.tara_ton), str(b.tipo_remolque), num(b.largo_m), str(b.especialidad),
        str(b.ubicacion_texto), str(b.ubicacion_maps_url), str(b.notas),
      ]
    );
    res.redirect("/recursos");
  } catch (err) {
    next(err);
  }
});

router.post("/:id/eliminar", requireAuth, async (req, res, next) => {
  try {
    await db.query("DELETE FROM resources WHERE id=$1", [req.params.id]);
    res.redirect("/recursos");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
