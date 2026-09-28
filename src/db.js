const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render Postgres pide SSL fuera de su red interna; en la Internal Database
  // URL (misma región) no hace falta. Si algún día usás la External URL,
  // descomentar la línea de abajo.
  // ssl: { rejectUnauthorized: false },
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
