# Etapa 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Etapa 2: Producción con Nginx
FROM nginx:alpine
# Copiamos los archivos compilados del build al directorio de nginx
COPY --from=build /app/dist /usr/share/nginx/html
# Copiamos nuestro propio archivo de configuración
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
