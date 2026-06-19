# Usar una imagen oficial de Python ligera
FROM python:3.10-slim

# Instalar dependencias del sistema para OpenCV/PIL
RUN apt-get update && apt-get install -y libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar e instalar dependencias Python primero (caching de capas)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Crear directorio para el modelo YOLO (persistido en volumen Docker)
RUN mkdir -p /app/models

# Copiar el resto del código
COPY . .

# Exponer el puerto de FastAPI
EXPOSE 8000

# Ejecutar la API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]