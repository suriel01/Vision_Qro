# Manual de Uso y Mantenimiento - Vision Qro

Instrucciones para operar, administrar y mantener Vision Qro en la Jetson Orin Nano.
Última revisión: 10 de noviembre de 2026.

> **Importante:** en este manual `<IP_JETSON>` es la IP local de la Jetson (ver sección 2). No guardes
> contraseñas ni tokens en este archivo: el repositorio es público.

## 1. Direcciones de acceso

### Desde internet (Cloudflare Tunnel)

| Qué | URL |
|---|---|
| Mapa | `https://map.comcloudhosting.net/` |
| API | `https://api.comcloudhosting.net/` |
| Política de privacidad | `https://map.comcloudhosting.net/privacidad.html` |
| Webhook de Telegram | `https://md.comcloudhosting.net/webhook/...` (solo esa ruta; el editor de n8n **no** es público) |

### Desde tu red local

| Qué | URL |
|---|---|
| Mapa | `http://<IP_JETSON>:5173/` |
| API (documentación) | `http://<IP_JETSON>:8000/docs` |
| Editor de n8n | `http://<IP_JETSON>:5679/` |

El editor de n8n usa el puerto **5679** en la Jetson, porque el 5678 lo ocupa otro stack (`yolo_n8n`).

`/predict` (análisis de imágenes) solo responde a llamadas internas de n8n; desde internet devuelve 403.

## 2. Acceso por SSH

```bash
ssh jetson@<IP_JETSON>
```

- Por el cable USB, la Jetson suele responder en `192.168.55.1`.
- Para ver su IP actual en la red: `hostname -I` (ejecutado en la Jetson).
- Si la IP cambia tras un reinicio, reserva una IP fija (DHCP reservation) en tu router para la MAC de la Jetson.

## 3. Dónde está el proyecto

El sistema en producción corre desde:

```bash
cd ~/Vision_Qro_bak/vision_qro_backend
```

(El nombre `Vision_Qro_bak` es histórico; es la carpeta activa. El cron de respaldos apunta a esta ruta.)

| Ruta | Contenido |
|---|---|
| `vision_qro_backend/` | `docker-compose.yml`, `.env`, `init.sql`, `migrate.sql` y `ai_service/` (FastAPI + YOLO) |
| `vision-qro-frontend/` | Mapa y panel de administración (React) |
| `utils/` | Script de respaldo y herramientas |
| `backups/` | Respaldos locales de la base de datos |

## 4. Servicios (Docker)

| Servicio | Contenedor | Puerto en la Jetson |
|---|---|---|
| `postgres` | `vision_qro_db` | interno |
| `n8n` | `vision_qro_n8n` | 5679 |
| `cloudflared` | `vision_qro_tunnel` | ninguno |
| `ai_brain` | `vision_qro_ai` | 8000 |
| `frontend` | `vision_qro_frontend` | 5173 |
| `llm` | `vision_qro_llm` | ninguno (solo red interna) |

Los contenedores arrancan solos tras un reinicio (`restart: always`).

```bash
docker compose ps                    # estado de los contenedores
docker compose logs -f ai_brain      # logs de la IA (Ctrl+C para salir)
docker compose logs -f n8n           # logs de n8n
docker compose restart ai_brain      # reiniciar un servicio
```

Para aplicar cambios del `.env` hay que **recrear** el contenedor (un `restart` no recarga el entorno):

```bash
docker compose up -d --no-deps --force-recreate ai_brain
```

> **No uses `docker compose down -v`.** La opción `-v` borra los volúmenes, es decir, la base de datos.
> `docker compose down` sin `-v` apaga los servicios pero conserva los datos.

La Jetson comparte Docker con otro proyecto (`yolo_n8n` y `yolo_postgres`). No los detengas ni los borres
al limpiar Vision Qro.

## 5. Credenciales

Están en `~/Vision_Qro_bak/vision_qro_backend/.env` (permisos `600`). Las variables que importan:

- `ADMIN_PASSWORD`: contraseña del panel de administración del mapa.
- `API_KEY`: clave interna que la API devuelve al iniciar sesión como administrador.
- `TELEGRAM_BOT_TOKEN`, `CLOUDFLARE_TUNNEL_TOKEN`, `POSTGRES_*`.

Si faltan `ADMIN_PASSWORD` o `API_KEY`, las funciones de administración responden 503 (no hay valores por defecto).

**Cambiar la contraseña de administrador** (te la pide sin mostrarla; evita `$` y `#`):

```bash
python3 -c 'import getpass,re,os;p=getpass.getpass("Nueva contraseña de admin: ");f=os.path.expanduser("~/Vision_Qro_bak/vision_qro_backend/.env");s=open(f).read();s=re.sub(r"(?m)^ADMIN_PASSWORD=.*$",lambda m:"ADMIN_PASSWORD="+p,s);open(f,"w").write(s)'
```

**Generar una API_KEY nueva** (no se imprime):

```bash
sed -i "s|^API_KEY=.*|API_KEY=$(openssl rand -hex 32)|" .env
```

Después de cualquiera de los dos, recrea `ai_brain` (sección 4).

**Límite de intentos del login.** Tras 5 contraseñas incorrectas desde el mismo cliente (o 30 en total) en 5 minutos,
`/api/v1/auth` responde 429 y el panel lo avisa. Se libera solo a los 5 minutos; recrear `ai_brain` borra los contadores.
Si alguien llegara a conocer la contraseña, el límite no ayuda: cámbiala.

**Borrar todos los reportes** desde el panel (icono rojo) es irreversible: borra también sus predicciones y las copias de fotos.
Haz un respaldo antes (sección 6).

## 6. Respaldos

Cada día a las **03:00** el cron ejecuta `utils/backup_db.sh`:

- Genera un volcado comprimido de la base (incluye también el estado de n8n) en `backups/`.
- Lo sube **cifrado** a Google Drive con `rclone` (remoto `gdrive-crypt:db`).
- Conserva 14 días, local y en Drive.
- El registro queda en `backups/backup.log`.

**Cómo funcionan.** Cada respaldo es una copia completa de la base en ese momento, no un espejo. Si borras un reporte
después, **sigue en los respaldos anteriores hasta que caducan (14 días)**; no se puede quitar una fila de un respaldo.
Restaurar reemplaza toda la base; para recuperar un solo reporte se carga el respaldo en una base temporal y se copia esa fila.
Las fotos de entrenamiento no van en los respaldos. La hora del cron es la de la Jetson (hoy UTC+8: las 03:00 son las 13:00 en Querétaro).
Los respaldos subidos con un `client_id` de rclone anterior no se ven ni se borran solos: elimínalos a mano en Drive.

**Hacer un respaldo ahora:**

```bash
RCLONE_REMOTE=gdrive-crypt:db PATH=$HOME/.local/bin:$PATH ../utils/backup_db.sh
```

**Descargar un respaldo desde Drive:**

```bash
~/.local/bin/rclone lsl gdrive-crypt:db
~/.local/bin/rclone copyto gdrive-crypt:db/ARCHIVO.sql.gz ./ARCHIVO.sql.gz
```

**Restaurar** (esto **reemplaza** la base actual; solo si de verdad la necesitas):

```bash
P='PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER'
docker exec vision_qro_db sh -c "$P -d postgres -c 'DROP DATABASE IF EXISTS \"'\$POSTGRES_DB'\" WITH (FORCE)' -c 'CREATE DATABASE \"'\$POSTGRES_DB'\"'"
zcat ARCHIVO.sql.gz | docker exec -i vision_qro_db sh -c "$P -d \$POSTGRES_DB -q"
docker exec -i vision_qro_db sh -c "$P -d \$POSTGRES_DB -q" < migrate.sql
```

Espera a que Postgres acepte conexiones antes de restaurar. Puede mostrar dos errores de políticas de
`pg_cron`; son inofensivos.

**Requisitos para que la subida a Drive siga funcionando**

- La app de Google Cloud debe estar en estado **In production** (en *Testing* el permiso caduca a los 7 días).
- Guarda en tu gestor de contraseñas las dos claves del cifrado (`rclone config show gdrive-crypt`).
  Sin ellas, los respaldos en Drive no se pueden descifrar si la Jetson se daña.

## 7. Actualizar el workflow de n8n

El workflow vive en `n8n_Telegram.json` (raíz del repositorio). Importarlo con la CLI de n8n, que no necesita API key:

1. Respalda el actual:
   ```bash
   docker exec vision_qro_n8n n8n export:workflow --id=oG1jgSR0nhEvfE9l --output=/home/node/.n8n/backup_workflow.json
   ```
2. Copia e importa el archivo nuevo, y actívalo:
   ```bash
   docker cp workflow.json vision_qro_n8n:/tmp/workflow.json
   docker exec vision_qro_n8n n8n import:workflow --input=/tmp/workflow.json
   docker exec vision_qro_n8n n8n update:workflow --id=oG1jgSR0nhEvfE9l --active=true
   docker restart vision_qro_n8n
   ```
3. Antes de importar, el archivo debe usar el **ID del workflow** y los **IDs de credenciales** de la instancia de n8n
   de la Jetson. El `n8n_Telegram.json` del repositorio trae IDs de otra instalación, así que hay que reemplazarlos
   en una copia (no son secretos):

   | Qué | ID en el repositorio | ID en la Jetson |
   |---|---|---|
   | Workflow `Telegram_n8n` | `oPyUlGi7WOAKaQA3` | `oG1jgSR0nhEvfE9l` |
   | Credencial `Telegram account` | `XaFnB0RjU5Z7dSO9` | `1L9EcHJ5wXGTjVPd` |
   | Credencial `Postgres account` | `326GbKP8LulCptUD` | `ZBoM0evuZghn6lKP` |

   Si no los cambias, el import crea un workflow nuevo o deja los nodos sin credencial.

## 8. Problemas frecuentes

**El bot no responde**
1. `docker compose logs --since 10m n8n` y revisa si hay ejecuciones nuevas.
2. Pregunta a Telegram qué ve. Desde la Jetson, sin imprimir el token:
   ```bash
   docker exec vision_qro_ai sh -c 'curl -s https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo'
   ```
   Si `last_error_message` dice `403 Forbidden` y n8n responde `"Provided secret is not valid"`, Telegram conserva un
   secreto viejo del webhook. Bórralo y reinicia n8n para que lo registre de nuevo:
   ```bash
   docker exec vision_qro_ai sh -c 'curl -s https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/deleteWebhook'
   docker restart vision_qro_n8n
   ```
   (`deleteWebhook` sin `drop_pending_updates` conserva los mensajes pendientes.)

**El bot avisa "no pude analizar la imagen"**
`ai_brain` no respondió. El reporte queda guardado como `pendiente_manual` y aparece en el mapa como pendiente.
Revisa `docker compose ps` y `docker compose logs ai_brain`.

**El mapa carga pero sin puntos**
Comprueba `https://api.comcloudhosting.net/api/v1/reportes-mapa`. Si responde 200 con `[]`, la base está vacía o se restauró mal.
Si no responde, revisa `vision_qro_ai` y el túnel (`docker compose logs cloudflared`).

**La Jetson se queda sin disco**
Ve el uso con `df -h /` y `docker system df`. Limpieza segura (solo imágenes sin etiqueta y caché de build):

```bash
docker image prune -f
docker builder prune -f
```

No uses `docker system prune -a` ni borres volúmenes: podrías eliminar imágenes de otros proyectos o la base de datos.

## 9. Muestras para mejorar el modelo

Cada foto que n8n envía a `/predict` se guarda con lo que predijo el modelo:

- Archivo: `uploads_data` → `/app/uploads/entrenamiento/<reporte>_<fecha>.jpg` (dentro del contenedor `vision_qro_ai`).
- Fila en la tabla `predicciones` (modelo, clase, confianza, categoría y ruta del archivo).
- La vista `v_muestras_entrenamiento` une cada foto con su etiqueta final, **solo** de reportes que una persona
  ya validó o corrigió.

```bash
# cuántas muestras hay y cuántas ya tienen etiqueta humana
docker exec -i vision_qro_db sh -c 'PGPASSWORD=$POSTGRES_PASSWORD psql -h localhost -U $POSTGRES_USER -d $POSTGRES_DB' \
  <<< "select (select count(*) from predicciones) as muestras, (select count(*) from v_muestras_entrenamiento) as etiquetadas;"

# espacio que ocupan
docker exec vision_qro_ai du -sh /app/uploads/entrenamiento

# copiar las fotos a la Jetson para llevarlas a entrenar
docker cp vision_qro_ai:/app/uploads/entrenamiento ./entrenamiento
```

- Al eliminar un reporte desde el panel (o "borrar todos"), se borran también su fila y su foto.
- Los respaldos de la base **no** incluyen estas fotos; solo viven en el volumen `uploads_data`.
- La política de privacidad ya explica este uso. Si cambias cómo se guardan o se usan las fotos, actualiza
  `vision-qro-frontend/public/privacidad.html`.

## 10. Asistente de texto (IA local)

El texto libre que no es parte del flujo de reporte lo atiende un modelo pequeño (`qwen3:1.7b`) que corre en la Jetson, en el
contenedor `vision_qro_llm`. Solo se alcanza dentro de la red de Docker. El flujo de reportes (foto, ubicación, análisis, botones)
**no depende de él**: si cae o tarda más de 40 s, el bot responde con textos fijos.

- Primera vez, o si borras el volumen `llm_models`: `docker exec vision_qro_llm ollama pull qwen3:1.7b`.
- La IA no tiene herramientas, no toca la base y nunca recibe fotos ni ubicaciones.
- Es independiente del Ollama instalado en el sistema (puerto 11434 de la Jetson), que no se usa.

**Protecciones, en este orden**

1. *Filtro previo* (sin llamar al modelo): inyección y órdenes de formato, temas ajenos, preguntas de privacidad de fotos, saludos, ayuda y
   "borrar mi reporte" reciben respuestas fijas.
2. *Límite de texto:* 10 mensajes por minuto por chat y 40 por minuto para el modelo. **No aplica a fotos, ubicaciones ni botones.**
   Para eximir a un chat del límite de texto, agrega su ID en `EXENTOS` del nodo `Clasificar texto` (un nuevo import desde el repositorio lo reinicia).
3. *Modelo con prompt restringido.*
4. *Filtro de salida:* enlaces, teléfonos, correos, promesas, consejos médicos, respuestas en inglés o sin relación con el bot se sustituyen por un texto fijo.

**Cambiar las reglas.** La fuente de verdad es `utils/asistente/guardrails.js`. No edites a mano los nodos `Clasificar texto` ni
`Filtrar respuesta`: se generan desde ese archivo.

```bash
node utils/asistente/test_guardrails.js                      # pruebas de las reglas
python3 utils/asistente/build_workflow_asistente.py          # regenera los nodos en n8n_Telegram.json
```

Prueba adversaria contra el modelo real (ejecutar en la Jetson, desde la raíz del repositorio):

```bash
docker cp utils/asistente vision_qro_n8n:/tmp/asistente && docker cp n8n_Telegram.json vision_qro_n8n:/tmp/wf.json
docker exec vision_qro_n8n node /tmp/asistente/probar_modelo.js /tmp/wf.json
```

Pasar esas pruebas no garantiza que el modelo no diga algo raro: revisa las respuestas a ojo cada vez que cambies modelo o prompt.

**Memoria.** El límite de memoria del compose no controla la que usa la GPU. Con el modelo cargado quedan unos 1.7 a 2 GB disponibles:
revisa `free -m` y, si falta memoria, `docker compose stop llm` (el bot sigue con textos fijos).
Los mensajes de texto se procesan en la Jetson; el historial técnico de n8n los conserva unos 7 días.

## 11. Selector de objeto

Si la foto trae varios objetos, `/predict` devuelve `candidatos` y `ambiguo`. El puntaje combina confianza y tamaño del objeto en la foto
(`ai_service/candidatos.py`: confianza mínima 40 %, y hay duda si el segundo candidato tiene al menos la mitad del puntaje del primero).

- Con duda, el bot pregunta con un botón por candidato y "Otra cosa". "Otra cosa" continúa en el flujo manual (nombre, bache o basura, tamaño).
- Sin duda, se preselecciona el objeto dominante y se pide confirmar, como siempre.
- Un reporte esperando elección tiene estado `esperando_objeto`; si llega otra foto, pasa a `pendiente_manual`.
- Los umbrales son una decisión de diseño: si el bot pregunta demasiado o muy poco, ajusta las constantes y vuelve a probar.

```bash
python3 -I vision_qro_backend/ai_service/test_candidatos.py   # pruebas de la lógica de candidatos
python3 utils/build_workflow_selector.py                      # regenera los nodos del selector
```

## 12. Privacidad del mapa y estados de reporte

- **Invitados** ven en el mapa: ubicación, tipo, tamaño del bache, fecha y estado. (El mapa dibuja cada punto con un pequeño desplazamiento visual, pero la API entrega las coordenadas exactas.) No ven el ID,
  la confianza de la IA, el objeto detectado, las coordenadas exactas ni la foto. La API tampoco se los entrega (`/api/v1/reportes-mapa` sin clave).
- **Administrador** (con `X-API-Key`) ve además los datos técnicos y las fotos (`/api/v1/foto/{id}` exige la clave).
- **Fotos públicas.** Por defecto no lo son. Para hacerlas públicas pon `FOTOS_PUBLICAS=true` en el `.env` y recrea `ai_brain`.
  Si lo haces, actualiza antes la política de privacidad (`vision-qro-frontend/public/privacidad.html`).
- **Estados:** `nuevo`, `en_proceso`, `resuelto` (columna `estado_gestion`, distinta del `estado` interno del bot). Se cambian desde el popup
  del reporte como administrador. Al pasar a *en proceso* o *resuelto* el ciudadano recibe un mensaje por Telegram; reabrir (*nuevo*) no avisa.
  El panel tiene un filtro por estado y los marcadores se atenúan o cambian de borde según el estado.
- Pruebas de la lógica: `python3 -B -I vision_qro_backend/ai_service/test_gestion_y_vista.py`.
- Logo y miniatura: `vision-qro-frontend/public/` (original en `docs/branding/`). La miniatura al compartir el enlace es `og-image.png`;
  Telegram y otras apps guardan la vista previa en caché y pueden tardar en actualizarla.

## 13. Análisis y métricas

La pestaña **Análisis** del mapa es un tablero pensado para presentar a una institución: indicadores del periodo (7, 30, 90 o 365 días),
reportes por día, por categoría, tamaño de bache, día de la semana y hora, estado de la gestión, antigüedad de los reportes abiertos,
zonas con más reportes, calidad de los datos y, solo para el administrador, el desempeño del clasificador automático. Tiene
botón de impresión/PDF y una sección "Cómo se calcula".

- Los datos salen de `GET /api/v1/metricas?dias=N` (público, agregado y anónimo; con la clave de administrador añade el bloque `modelo`).
  Se guarda en caché 60 segundos.
- **Privacidad:** las zonas son cuadrículas de unos 275 m y solo aparecen con 3 o más reportes; nunca se entregan coordenadas de un reporte individual.
- **Tiempo de resolución:** sale de la tabla `reportes_historial`, que registra cada cambio de estado. Los reportes que ya tenían estado antes de crearla
  se rellenaron con la fecha de su último cambio, así que su tiempo de resolución es aproximado.
- Zona horaria de los cortes por día y hora: America/Mexico_City.
- Lógica y pruebas: `vision_qro_backend/ai_service/metricas.py` y `test_metricas.py`; interfaz en `vision-qro-frontend/src/components/analytics/`.

**Sistema de diseño.** Los colores, tipografía y espacios están en `vision-qro-frontend/src/styles/tokens.css` (azul marino y turquesa del logo, tema claro y
oscuro). La interfaz usa esas variables: para cambiar un color se edita ahí, no en cada componente.

## 14. Recomendaciones de hardware para operación 24/7

1. **Alimentación constante:** conecta la Jetson a la pared con su eliminador oficial. No la alimentes solo por USB si la GPU procesa imágenes.
2. **Ventilación:** mantén libre el disipador y el ventilador para evitar sobrecalentamiento durante la inferencia con YOLO.
3. **Respaldo de energía (opcional):** un No-Break (UPS) evita que un apagón repentino corrompa la base de datos.
