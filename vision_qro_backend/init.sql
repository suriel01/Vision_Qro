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
