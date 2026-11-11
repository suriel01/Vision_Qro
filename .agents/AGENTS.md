# Reglas y Pautas del Agente (Vision Qro)

Este archivo define las reglas de desarrollo, restricciones del sistema y pautas operativas que deben seguir todos los agentes de IA al modificar el código o infraestructura de **Vision Qro**.

---

## 🚨 1. Regla de Oro: Estabilidad y Compatibilidad ("NO ROMPAS NADA")
El proyecto se encuentra activo y en producción en una placa Jetson Orin Nano. 
*   Cualquier cambio de backend o frontend debe verificarse minuciosamente.
*   No rompas flujos existentes de n8n, esquemas de bases de datos o integraciones con Telegram.
*   Cualquier migración o alteración de base de datos debe ser retrocompatible (por ejemplo, permitir campos vacíos mientras n8n completa el workflow).

---

## 🐳 2. Infraestructura de Contenedores (Docker)
*   **Imagen Base de IA:** El contenedor de IA (`ai_service`) **debe** utilizar siempre la imagen optimizada para Jetson Orin (`dustynv/pytorch:2.7-r36.4.0` o superior compatible con L4T de Nvidia) para asegurar compatibilidad con CUDA. No cambies la imagen a versiones genéricas de Python.
*   **Acceso a GPU:** Se deben mantener las reservas de GPU (`nvidia` driver con capacidad `gpu` en Docker Compose) para acelerar las inferencias de YOLOv12.
*   **Frontend en Producción:** El frontend se sirve a través de un contenedor multi-stage usando Nginx en el puerto `5173`. No regreses la configuración del docker compose a usar el servidor de desarrollo de Vite en producción.

---

## 💾 3. Control de Almacenamiento (Jetson Limits)
*   **Rotación de Logs:** Todos los servicios de Docker **deben** tener habilitado el driver de logs `json-file` limitado a `max-size: "10m"` y `max-file: "3"` para evitar llenar la memoria flash de la Jetson.
*   **Pruning de n8n:** La configuración de pruning en el contenedor de n8n (`EXECUTIONS_DATA_PRUNE=true` con retención de 168 horas) **nunca** debe deshabilitarse.

---

## 🗃️ 4. Base de Datos y Copias de Seguridad (Backups)
*   **Respaldos Seguros:** El script de copia de seguridad se encuentra en [utils/backup_db.sh](file:///home/jetson/Vision_Qro/utils/backup_db.sh).
*   **Autenticación en Scripts:** Al ejecutar respaldos (`pg_dump`) dentro del contenedor Postgres, usa la flag `-u postgres` en `docker exec`. Esto permite la autenticación mediante sockets sin exponer contraseñas en texto plano.
*   **Ruta de Backups:** Los respaldos se almacenan localmente en `/home/jetson/Vision_Qro/backups/`. Esta carpeta está excluida en `.gitignore` para evitar subir archivos SQL pesados al repositorio.

---

## 🔒 5. Seguridad y Autenticación
*   **Protección de Endpoints:** Todas las operaciones de eliminación (`DELETE /api/v1/reportes/{id}`) y exportación de archivos (`GET /api/v1/reportes/exportar`) **deben** estar protegidas en el backend FastAPI y requerir el token API Key en el header `X-API-Key`.
*   **Token de Telegram:** El Bot Token de Telegram (`TELEGRAM_BOT_TOKEN`) no debe exponerse en las peticiones del frontend. Las fotos deben solicitarse mediante el endpoint proxy `/api/v1/foto/{id}` en el backend FastAPI.

---

## 📡 6. Comunicación y Exposición Segura en Internet
*   **Aislamiento y CORS Estricto:** La exposición pública del Dashboard a través de dominios en la nube (ej. túneles de Cloudflare) debe usar dos subdominios separados (Frontend y API). El backend debe forzar la política CORS de manera estricta usando la variable de entorno `CORS_ORIGINS`, rechazando peticiones que no vengan exclusivamente del frontend oficial.
*   **Resolución Dinámica de API:** El frontend debe recibir la URL pública de la API de forma dinámica mediante una inyección de variables (ej. `VITE_API_URL` vía `docker build args`) en tiempo de construcción, para mantener el control de acceso.

---

## 📁 7. Organización del Proyecto
Cualquier archivo de script, parche o JSON debe organizarse en su respectivo directorio:
*   Scripts y parches: `/home/jetson/Vision_Qro/utils/`
*   Respaldos de flujos de trabajo de n8n: `/home/jetson/Vision_Qro/n8n/`
*   No coloques archivos basura en la raíz del proyecto.
