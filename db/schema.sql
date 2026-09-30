-- Esquema de datos de Torre — Postgres desde el día uno (Render Postgres en
-- producción), para no repetir el problema de almacenamiento efímero que tuvo
-- strava-panel con su athletes.json.
--
-- Enfoque: núcleo relacional (tipo, nombre, estado, fechas) + columnas JSONB
-- para listas flexibles (recursos asignados a un trabajo, adjuntos, acoples).
-- Es el mismo modelo que ya viene probado en Torre de Control; más adelante,
-- si hace falta, esas columnas JSONB se pueden normalizar en tablas propias.

CREATE TABLE IF NOT EXISTS resources (
  id                 text PRIMARY KEY,
  tipo               text NOT NULL CHECK (tipo IN ('grua','camion','remolque','operario')),
  nombre             text NOT NULL,
  identificador      text,
  pais               text,                       -- 'uruguay' | 'argentina' | 'brasil' | null
  estado_base        text NOT NULL DEFAULT 'activo'
                       CHECK (estado_base IN ('activo','mantenimiento','baja','licencia','licencia_medica','seguro')),

  -- grúa / camión
  capacidad_ton      double precision,
  tara_ton           double precision,

  -- remolque
  tipo_remolque      text,
  largo_m            double precision,

  -- operario
  especialidad       text,

  -- ubicación física del equipo (nombre primero, coordenadas/link secundario)
  ubicacion_texto    text,
  ubicacion_maps_url text,
  ubicacion_fecha    timestamptz,

  -- GPS (Traccar / GPS propio del camión / proveedor externo)
  gps_fuente         text,
  gps_imei           text,
  gps_proveedor      text,
  gps_unidad         text,

  notas              text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resources_tipo ON resources (tipo);
CREATE INDEX IF NOT EXISTS idx_resources_pais ON resources (pais);

CREATE TABLE IF NOT EXISTS jobs (
  id                         text PRIMARY KEY,
  titulo                     text NOT NULL,
  cliente                    text,
  solicitante                text,
  solicitante_contacto       text,
  ubicacion                  text,
  ubicacion_maps_url         text,
  fecha_inicio               timestamptz NOT NULL,
  fecha_fin                  timestamptz,
  estado                     text NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente','en_curso','finalizado','cancelado')),

  distancia_km               double precision,
  tonelaje_requerido         double precision,
  tipo_grua_requerida        text,
  viajes_movilizacion_total  integer,
  notas_tecnicas             text,

  tareas_total               integer,
  tareas_hechas              integer,
  tareas_unidad              text,

  gruas                      jsonb NOT NULL DEFAULT '[]',
  camiones                   jsonb NOT NULL DEFAULT '[]',
  remolques                  jsonb NOT NULL DEFAULT '[]',
  operarios                  jsonb NOT NULL DEFAULT '[]',
  acoples                    jsonb NOT NULL DEFAULT '[]',

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_estado ON jobs (estado);

CREATE TABLE IF NOT EXISTS fletes (
  id                          text PRIMARY KEY,
  cliente                     text,
  solicitante                 text,
  solicitante_contacto        text,
  componente                  text,
  numero_serie                text,
  fecha                       timestamptz,

  camion_id                   text,
  remolque_id                 text,
  chofer_id                   text,
  trabajo_id                  text REFERENCES jobs (id) ON DELETE SET NULL,

  -- origen/destino: nombre de lugar primero, coordenadas/link secundario
  origen_texto                text,
  origen_maps_url             text,
  destino_texto                text,
  destino_maps_url            text,

  peso_carga_t                double precision,
  medida_ancho_m               double precision,
  medida_largo_m               double precision,
  necesita_grua                boolean NOT NULL DEFAULT false,
  grua_id                      text,
  distancia_km                 double precision,
  viajes_movilizacion_total    integer,

  fecha_llegada                timestamptz,
  llegada_nota                  text,

  fotos                        jsonb NOT NULL DEFAULT '[]',
  placa                        jsonb NOT NULL DEFAULT '[]',
  remito                       jsonb NOT NULL DEFAULT '[]',

  notas                        text,

  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fletes_trabajo ON fletes (trabajo_id);

CREATE TABLE IF NOT EXISTS deposito (
  id             text PRIMARY KEY,
  componente     text,
  numero_serie   text,
  cliente        text,
  fecha_ingreso  timestamptz,
  procedencia    text,
  fecha_egreso   timestamptz,
  destino        text,

  fotos          jsonb NOT NULL DEFAULT '[]',
  placa          jsonb NOT NULL DEFAULT '[]',

  notas          text,

  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Vínculo fletes <-> depósito (ingreso/egreso automático)
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS a_deposito boolean NOT NULL DEFAULT false;
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS deposito_ingreso_id text;
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS desde_deposito_id text;
ALTER TABLE deposito ADD COLUMN IF NOT EXISTS flete_ingreso_id text;
ALTER TABLE deposito ADD COLUMN IF NOT EXISTS flete_egreso_id text;

-- Horas y días de trabajo del personal
CREATE TABLE IF NOT EXISTS horas (
  id          text PRIMARY KEY,
  persona_id  text NOT NULL,
  fecha       date NOT NULL,
  horas       numeric(5,2) NOT NULL DEFAULT 0,
  horas_extra numeric(5,2) NOT NULL DEFAULT 0,
  trabajo_id  text,
  flete_id    text,
  notas       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS horas_fecha_idx ON horas(fecha);
CREATE INDEX IF NOT EXISTS horas_persona_idx ON horas(persona_id);

-- Combustible y kilómetros por flete (opcionales)
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS km_recorridos numeric;
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS combustible_litros numeric;
ALTER TABLE fletes ADD COLUMN IF NOT EXISTS combustible_costo numeric;

-- ===== Costos, mantenimiento y vencimientos =====
CREATE TABLE IF NOT EXISTS tarifas (
  recurso_id  text PRIMARY KEY,
  costo_hora  numeric,
  costo_km    numeric,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS finanzas (
  tipo         text NOT NULL,            -- 'flete' | 'trabajo'
  ref_id       text NOT NULL,
  precio       numeric,
  otros_gastos numeric,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tipo, ref_id)
);
CREATE TABLE IF NOT EXISTS config (
  clave text PRIMARY KEY,
  valor text
);
CREATE TABLE IF NOT EXISTS vencimientos (
  id         text PRIMARY KEY,
  recurso_id text,
  concepto   text NOT NULL,
  fecha      date NOT NULL,
  notas      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS venc_fecha_idx ON vencimientos(fecha);
CREATE TABLE IF NOT EXISTS mantenimientos (
  id         text PRIMARY KEY,
  recurso_id text NOT NULL,
  fecha      date NOT NULL,
  tipo       text,
  km         numeric,
  costo      numeric,
  notas      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mant_recurso_idx ON mantenimientos(recurso_id);
