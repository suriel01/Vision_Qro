// Configuración compartida del frontend.
export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
