# Usar la imagen de PyTorch optimizada para Jetson Orin (L4T r36.4.0)
FROM dustynv/pytorch:2.7-r36.4.0

# Corregir URLs de repositorios de jetson-ai-lab (.dev -> .io)
ENV PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_EXTRA_INDEX_URL=https://pypi.jetson-ai-lab.io/jp6/cu126
ENV TAR_INDEX_URL=https://apt.jetson-ai-lab.io/jp6/cu126

# Instalar dependencias del sistema para OpenCV/PIL
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 && rm -rf /var/lib/apt/lists/*

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