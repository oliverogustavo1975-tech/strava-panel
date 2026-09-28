// Misma lógica de estado que Torre de Control (el artifact): un recurso está
// "mantenimiento" si su estado_base está en la lista de ausencias, "baja" si
// está de baja, "ocupado" si hay un trabajo activo ahora mismo que lo incluye,
// y si no "disponible".

const TIPO_FIELD = { grua: "gruas", camion: "camiones", remolque: "remolques", operario: "operarios" };
const AUSENCIAS = new Set(["mantenimiento", "licencia", "licencia_medica", "seguro"]);

const ESTADO_LABEL_EQUIPO = { activo: "Activo", mantenimiento: "Mantenimiento", baja: "Baja" };
const ESTADO_LABEL_PERSONA = {
  activo: "Operativo", licencia: "Licencia", licencia_medica: "Licencia médica",
  seguro: "Seguro", baja: "Baja",
};

function estadoBaseLabel(resource) {
  const labels = resource.tipo === "operario" ? ESTADO_LABEL_PERSONA : ESTADO_LABEL_EQUIPO;
  return labels[resource.estado_base] || resource.estado_base || "Activo";
}

function currentJobFor(resource, jobs) {
  const field = TIPO_FIELD[resource.tipo];
  const now = new Date();
  const active = jobs.filter(j => {
    if (j.estado === "cancelado" || j.estado === "finalizado") return false;
    const ids = j[field] || [];
    if (!ids.includes(resource.id)) return false;
    const start = new Date(j.fecha_inicio);
    const end = j.fecha_fin ? new Date(j.fecha_fin) : null;
    return start <= now && (!end || now <= end);
  });
  active.sort((a, b) => {
    const ea = a.fecha_fin ? new Date(a.fecha_fin).getTime() : Infinity;
    const eb = b.fecha_fin ? new Date(b.fecha_fin).getTime() : Infinity;
    return ea - eb;
  });
  return active[0] || null;
}

function resourceStatus(resource, jobs) {
  if (AUSENCIAS.has(resource.estado_base)) {
    return { code: "mantenimiento", label: estadoBaseLabel(resource) };
  }
  if (resource.estado_base === "baja") {
    return { code: "baja", label: "Baja" };
  }
  const job = currentJobFor(resource, jobs);
  if (job) return { code: "ocupado", label: "Ocupado", job };
  return { code: "disponible", label: "Disponible" };
}

module.exports = { resourceStatus, estadoBaseLabel, TIPO_FIELD, AUSENCIAS };
