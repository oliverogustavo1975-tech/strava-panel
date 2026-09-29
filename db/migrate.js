// Aplica db/schema.sql contra DATABASE_URL. Es idempotente (CREATE TABLE IF
// NOT EXISTS / CREATE INDEX IF NOT EXISTS), así que correrlo de nuevo no rompe
// nada — se usa igual en desarrollo local y como paso de deploy en Render.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(sql);
    console.log("Migración aplicada correctamente.");
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Error al migrar:", err);
  process.exit(1);
});
