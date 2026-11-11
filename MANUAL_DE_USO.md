# Manual de Uso y Mantenimiento - Vision Qro

Este manual contiene las instrucciones necesarias para operar, administrar y mantener el sistema de **Vision Qro** en la Jetson Orin Nano de forma inalámbrica y autónoma.

## 1. Direcciones de Acceso Local (Wi-Fi)

Siempre que tu laptop y la Jetson estén conectadas a la misma red Wi-Fi:

*   **Mapa Interactivo (Frontend):** [http://192.168.1.73:5173/](http://192.168.1.73:5173/)
*   **n8n (Orquestador / Backend):** [http://192.168.1.73:5678/](http://192.168.1.73:5678/)
*   **API FastAPI (Documentación):** [http://192.168.1.73:8000/docs](http://192.168.1.73:8000/docs)

---

## 2. Acceso Inalámbrico por SSH (Sin Cables)

Para administrar la Jetson desde tu laptop sin necesidad de conectar el cable USB:

1. Abre la terminal (o PowerShell en Windows) en tu laptop.
2. Ejecuta el comando:
   ```bash
   ssh jetson@192.168.1.73
   ```
3. Introduce la contraseña del usuario `jetson`.

> [!TIP]
> **Cambio de IP:** Si la Jetson se reinicia, el módem podría asignarle otra IP (como `192.168.1.80`). Si esto ocurre:
> 1. Puedes escanear la red con apps como **Fing** en tu celular para ver la nueva IP de la Jetson.
> 2. O puedes configurar una **IP estática (DHCP Reservation)** en la página de configuración de tu módem/router para la dirección MAC de la Jetson, asegurando que siempre sea `192.168.1.73`.

---

## 3. Comandos de Administración (Docker)

El sistema corre en segundo plano y se inicia automáticamente si la Jetson se apaga y se vuelve a encender. Si necesitas administrarlo manualmente, primero conéctate por SSH y navega a la carpeta del proyecto:

```bash
cd /home/jetson/Vision_Qro/vision_qro_backend
```

### Comandos Útiles:

*   **Ver el estado de los contenedores:**
    ```bash
    docker compose ps
    ```
    *Deberías ver `vision_qro_db`, `vision_qro_n8n`, `vision_qro_tunnel`, `vision_qro_ai` y `vision_qro_frontend` en estado `Up`.*

*   **Ver logs en tiempo real de la IA (YOLO):**
    ```bash
    docker compose logs -f ai_brain
    ```

*   **Ver logs de n8n:**
    ```bash
    docker compose logs -f n8n
    ```

*   **Apagar todo el sistema:**
    ```bash
    docker compose down
    ```

*   **Encender todo el sistema en segundo plano (detached mode):**
    ```bash
    docker compose up -d
    ```

*   **Reiniciar un contenedor específico (ejemplo: la IA):**
    ```bash
    docker compose restart ai_brain
    ```

---

## 4. Estructura del Proyecto

*   `/home/jetson/Vision_Qro/vision_qro_backend`: Contiene la base de datos (Postgres/PostGIS), el orquestador n8n, el túnel de Cloudflare y el servicio de IA.
*   `/home/jetson/Vision_Qro/vision-qro-frontend`: Contiene el mapa interactivo y dashboard web.

---

## 5. Recomendaciones de Hardware para Operación 24/7

1. **Alimentación Constante:** Mantén la Jetson conectada a la toma de corriente de pared con su eliminador oficial. No intentes alimentarla únicamente por USB si la GPU estará procesando imágenes.
2. **Ventilación:** Mantén libre el disipador y ventilador de la placa para evitar sobrecalentamiento durante el procesamiento de imágenes con YOLO.
3. **Respaldo de energía (Opcional):** Si en tu zona hay cortes de energía frecuentes, se recomienda usar un No-Break (UPS) para evitar que apagones repentinos puedan corromper la base de datos Postgres.
