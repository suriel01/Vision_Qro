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

-- Índice por fecha (si no existe)
CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes (created_at DESC);

SELECT 'Migración completada correctamente.' AS resultado;
