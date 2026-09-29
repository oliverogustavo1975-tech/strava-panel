// Autenticación simple de un solo usuario: una contraseña compartida
// (variable de entorno ADMIN_PASSWORD, configurada en Render — nunca
// hardcodeada acá porque este repo es público) guardada en la sesión del
// navegador. Alcanza para el caso de uso de Torre: una sola persona (o el
// equipo de oficina) editando datos desde la oficina.

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
}

module.exports = { requireAuth, ADMIN_PASSWORD };
