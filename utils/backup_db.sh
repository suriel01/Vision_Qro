#!/bin/bash
# Script automatizado para respaldar la base de datos de Vision Qro
# Ejecución recomendada: Añadir al cron para correr diario a las 3:00 AM

BACKUP_DIR="/home/jetson/Vision_Qro/backups"
DB_CONTAINER="vision_qro_db"
DB_USER="postgres"
DB_NAME="vision_qro"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/vision_qro_backup_${DATE}.sql.gz"

echo "Iniciando respaldo de base de datos Vision Qro..."

# Crear el directorio de respaldos si no existe
mkdir -p "$BACKUP_DIR"

# Ejecutar pg_dump dentro del contenedor y comprimir la salida al vuelo
if docker exec -u postgres "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    echo "✅ Respaldo exitoso: $BACKUP_FILE"
    
    # Eliminar respaldos más antiguos a 30 días para no llenar el disco
    find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +30 -exec rm {} \;
    echo "🧹 Respaldos antiguos limpiados (se retienen solo los últimos 30 días)."
else
    echo "❌ Error al generar el respaldo."
    rm -f "$BACKUP_FILE"
    exit 1
fi
