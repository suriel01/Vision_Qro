// Configuración y utilidades compartidas del mapa: categorías, estados y formatos.
// Los colores salen de los tokens de diseño (styles/tokens.css) para que sigan el tema claro/oscuro.

const BACHE = { grupo: 'bache', color: 'var(--cat-bache)' };
const INORG = { grupo: 'basura', color: 'var(--cat-inorganica)' };
const ORG   = { grupo: 'basura', color: 'var(--cat-organica)' };
const BOLSA = { grupo: 'basura', color: 'var(--cat-bolsas)' };
const OTRO  = { grupo: 'otro',   color: 'var(--cat-otros)' };

const TIPOS = {
    bache:      { ...BACHE, etiqueta: 'Bache' },
    p:          { ...BACHE, etiqueta: 'Bache pequeño' },
    m:          { ...BACHE, etiqueta: 'Bache mediano' },
    g:          { ...BACHE, etiqueta: 'Bache grande' },
    organico:   { ...ORG,   etiqueta: 'Basura orgánica' },
    org:        { ...ORG,   etiqueta: 'Basura orgánica' },
    inorganico: { ...INORG, etiqueta: 'Basura inorgánica' },
    inorg:      { ...INORG, etiqueta: 'Basura inorgánica' },
    bolsa:      { ...BOLSA, etiqueta: 'Bolsa de basura' },
    pendiente:  { ...OTRO,  etiqueta: 'Pendiente de clasificar' },
    otro:       { ...OTRO,  etiqueta: 'Otro' },
};

export const getTipo = (tipo) => TIPOS[String(tipo ?? '').toLowerCase()] ?? TIPOS.pendiente;

// Filtros del panel (misma lógica que antes, con colores de los tokens)
export const FILTROS = [
    { id: 'inorg',   label: 'Basura inorgánica', color: 'var(--cat-inorganica)', match: ['inorganico', 'inorg'] },
    { id: 'org',     label: 'Basura orgánica',   color: 'var(--cat-organica)',   match: ['organico', 'org'] },
    { id: 'bolsa',   label: 'Bolsas de basura',  color: 'var(--cat-bolsas)',     match: ['bolsa'] },
    { id: 'bache_g', label: 'Bache grande',      color: 'var(--cat-bache)',      match: ['g', 'bache'] },
    { id: 'bache_m', label: 'Bache mediano',     color: 'var(--cat-bache)',      match: ['m'] },
    { id: 'bache_p', label: 'Bache pequeño',     color: 'var(--cat-bache)',      match: ['p'] },
    { id: 'otros',   label: 'Otros o pendientes', color: 'var(--cat-otros)',     match: ['pendiente', 'otro'] },
];

// Estados de gestión del reporte
export const ESTADOS = [
    { id: 'nuevo',      label: 'Nuevo',      color: 'var(--st-nuevo)' },
    { id: 'en_proceso', label: 'En proceso', color: 'var(--st-proceso)' },
    { id: 'resuelto',   label: 'Resuelto',   color: 'var(--st-resuelto)' },
];
export const getEstado = (id) => ESTADOS.find((e) => e.id === id) ?? ESTADOS[0];

// Nombres en español de los objetos que detecta el modelo
const OBJETOS_ES = {
    'bottle': 'botella', 'cup': 'taza', 'wine glass': 'copa', 'cell phone': 'celular', 'laptop': 'laptop', 'keyboard': 'teclado',
    'mouse': 'ratón', 'remote': 'control remoto', 'book': 'libro', 'scissors': 'tijeras', 'toothbrush': 'cepillo de dientes',
    'vase': 'florero', 'fork': 'tenedor', 'knife': 'cuchillo', 'spoon': 'cuchara', 'bowl': 'tazón', 'backpack': 'mochila',
    'handbag': 'bolsa de mano', 'suitcase': 'maleta', 'umbrella': 'paraguas', 'tie': 'corbata', 'frisbee': 'frisbee',
    'skateboard': 'patineta', 'surfboard': 'tabla de surf', 'tennis racket': 'raqueta de tenis', 'baseball bat': 'bate de béisbol',
    'baseball glove': 'guante de béisbol', 'sports ball': 'pelota', 'banana': 'plátano', 'apple': 'manzana', 'sandwich': 'sándwich',
    'orange': 'naranja', 'broccoli': 'brócoli', 'carrot': 'zanahoria', 'hot dog': 'hot dog', 'pizza': 'pizza', 'donut': 'dona', 'cake': 'pastel',
};
export const traducirObjeto = (n) => OBJETOS_ES[String(n ?? '').toLowerCase()] ?? n;

export const formatFecha = (iso) => (iso
    ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : null);

// "hace 5 min", "hace 3 h", "hace 2 d" y, pasada una semana, la fecha corta
export function tiempoRelativo(iso, ahora = Date.now()) {
    if (!iso) return '';
    const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000));
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    if (d < 8) return `hace ${d} d`;
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Desplazamiento visual determinista para que los puntos casi idénticos no se tapen entre sí.
// Es solo visual: la API entrega las coordenadas exactas.
export const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// Capa de calor: sobre mapa claro va de turquesa a azul marino; sobre mapa oscuro o satélite, de azul a blanco
export const heatmapLayer = (oscuro) => ({
    id: 'reportes-heatmap',
    type: 'heatmap',
    paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
        'heatmap-color': oscuro
            ? ['interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(47,111,228,0)', 0.2, 'rgba(47,111,228,0.45)', 0.5, 'rgba(61,170,255,0.7)',
                0.8, 'rgba(150,220,255,0.9)', 1, 'rgba(255,255,255,0.95)']
            : ['interpolate', ['linear'], ['heatmap-density'],
                0, 'rgba(40,176,202,0)', 0.2, 'rgba(40,176,202,0.35)', 0.5, 'rgba(32,128,160,0.6)',
                0.8, 'rgba(24,72,128,0.8)', 1, 'rgba(18,40,86,0.92)'],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 15, 45],
        'heatmap-opacity': 0.85,
    },
});

// Mapas base. "Calles" y "Noche" son los de mayor contraste en calles y nombres; "Minimal" es el más sobrio.
export const MAP_THEMES = {
    calles:   { id: 'calles',   label: 'Calles',    oscuro: false, url: 'mapbox://styles/mapbox/streets-v12' },
    noche:    { id: 'noche',    label: 'Noche',     oscuro: true,  url: 'mapbox://styles/mapbox/navigation-night-v1' },
    claro:    { id: 'claro',    label: 'Minimal',   oscuro: false, url: 'mapbox://styles/mapbox/light-v11' },
    satelite: { id: 'satelite', label: 'Satélite',  oscuro: true,  url: 'mapbox://styles/mapbox/satellite-streets-v12' },
};
