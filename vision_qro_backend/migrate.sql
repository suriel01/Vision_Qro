-- ============================================================
-- Vision Qro — Migración para bases de datos EXISTENTES
-- Agrega columnas nuevas sin borrar datos existentes.
-- Ejecutar con: docker exec -i vision_qro_db psql -U <USER> -d <DB> < migrate.sql
-- ============================================================

-- Columna de timestamp (fecha del reporte)
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Columna para la URL de la foto enviada por Telegram
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS foto_url TEXT;

-- Columna para la confianza del modelo YOLO
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS confianza DOUBLE PRECISION;

-- Columna para descripción adicional (enviada por n8n)
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Datos del usuario de Telegram
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);

-- Columnas usadas por el workflow de n8n (máquina de estados por chat)
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS chat_id BIGINT;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS foto_id TEXT;
ALTER TABLE reportes ADD COLUMN IF NOT EXISTS estado VARCHAR(50);

-- El reporte nace con la foto; la ubicación llega después
ALTER TABLE reportes ALTER COLUMN latitud DROP NOT NULL;
ALTER TABLE reportes ALTER COLUMN longitud DROP NOT NULL;

-- Índice por fecha (si no existe)
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes (created_at DESC);

-- Un solo reporte "esperando ubicación" por chat (evita duplicados por carreras).
-- Si ya existieran duplicados, esta sentencia falla: límpialos antes de volver a correrla.
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
-- Candidatos que vio el modelo (para el selector de objeto del bot)
ALTER TABLE predicciones ADD COLUMN IF NOT EXISTS candidatos JSONB;

-- Solo reportes ya revisados por una persona (validado o corregido), con su etiqueta final.
CREATE OR REPLACE VIEW v_muestras_entrenamiento AS
SELECT p.id AS prediccion_id, p.reporte_id, p.foto_path, p.modelo,
       p.clase AS clase_modelo, p.categoria AS categoria_modelo, p.confianza,
       r.subclase AS categoria_final, r.estado, r.created_at
FROM predicciones p
JOIN reportes r ON r.id = p.reporte_id
WHERE r.estado IN ('validado', 'corregido_por_humano') AND r.subclase IS NOT NULL;

SELECT 'Migración completada correctamente.' AS resultado;
