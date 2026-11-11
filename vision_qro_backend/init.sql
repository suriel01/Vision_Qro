-- ============================================
-- Vision Qro — Schema inicial (fresh installs)
-- ============================================

-- Extensión espacial PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla principal de reportes ciudadanos
CREATE TABLE IF NOT EXISTS reportes (
    id                SERIAL PRIMARY KEY,
    latitud           DOUBLE PRECISION,
    longitud          DOUBLE PRECISION,
    clase_corregida   VARCHAR(100),
    subclase          VARCHAR(100),
    confianza         DOUBLE PRECISION,
    descripcion       TEXT,
    foto_url          TEXT,
    telegram_user_id  BIGINT,
    telegram_username VARCHAR(100),
    chat_id           BIGINT,
    foto_id           TEXT,
    estado            VARCHAR(50),
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índice por coordenadas para consultas espaciales
CREATE INDEX IF NOT EXISTS idx_reportes_coords
    ON reportes (latitud, longitud);

-- Índice por fecha (DESC) para el historial
CREATE INDEX IF NOT EXISTS idx_reportes_fecha
    ON reportes (created_at DESC);

-- Un solo reporte "esperando ubicación" por chat: evita duplicados cuando
-- llegan dos fotos casi al mismo tiempo (el workflow usa ON CONFLICT sobre este índice).
CREATE UNIQUE INDEX IF NOT EXISTS uq_reportes_chat_esperando_ubicacion
    ON reportes (chat_id) WHERE estado = 'esperando_ubicacion';

-- Muestras para mejorar el modelo: la foto guardada y lo que predijo el modelo en ese momento.
-- La etiqueta correcta sale de reportes.subclase tras la validación o corrección humana.
-- ON DELETE CASCADE: al borrar un reporte se borra su predicción (el archivo lo borra la API).
CREATE TABLE IF NOT EXISTS predicciones (
    id          SERIAL PRIMARY KEY,
    reporte_id  INTEGER NOT NULL REFERENCES reportes(id) ON DELETE CASCADE,
    modelo      VARCHAR(100),
    clase       VARCHAR(100),
    confianza   DOUBLE PRECISION,
    categoria   VARCHAR(20),
    foto_path   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_predicciones_reporte ON predicciones (reporte_id);

-- Solo reportes ya revisados por una persona (validado o corregido), con su etiqueta final.
CREATE OR REPLACE VIEW v_muestras_entrenamiento AS
SELECT p.id AS prediccion_id, p.reporte_id, p.foto_path, p.modelo,
       p.clase AS clase_modelo, p.categoria AS categoria_modelo, p.confianza,
       r.subclase AS categoria_final, r.estado, r.created_at
FROM predicciones p
JOIN reportes r ON r.id = p.reporte_id
WHERE r.estado IN ('validado', 'corregido_por_humano') AND r.subclase IS NOT NULL;
