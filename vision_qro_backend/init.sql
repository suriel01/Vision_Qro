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
