// Detalles del mapa base que la persona puede mostrar u ocultar (calles, nombres, lugares…).
// Se clasifican las capas del estilo de Mapbox por su id y tipo; funciona con Calles, Noche, Minimal y Satélite.

const simbolo = (c) => c.type === 'symbol';

export const CAPAS = [
    { id: 'calles',     label: 'Calles',                    prueba: (c) => /^(road|bridge|tunnel)-/.test(c.id) && !simbolo(c) },
    { id: 'nombres',    label: 'Nombres de calles',         prueba: (c) => simbolo(c) && /^(road|bridge|tunnel|motorway|turning)-.*(label|shield|number|junction|arrow)|^motorway-junction/.test(c.id) },
    { id: 'lugares',    label: 'Lugares y comercios',       prueba: (c) => simbolo(c) && /^(poi-label|airport-label|natural-label|water-point-label|water-line-label|waterway-label|landmark)/.test(c.id) },
    { id: 'transporte', label: 'Transporte',                prueba: (c) => /transit|rail|subway|aerialway|ferry/.test(c.id) },
    { id: 'colonias',   label: 'Colonias y ciudades',       prueba: (c) => simbolo(c) && /settlement|neighborhood|place-label|state-label|country-label|continent/.test(c.id) },
    { id: 'edificios',  label: 'Edificios',                 prueba: (c) => /^building/.test(c.id) },
];

export const CAPAS_PREDETERMINADAS = Object.fromEntries(CAPAS.map((c) => [c.id, true]));

/** Aplica la visibilidad al estilo cargado. Solo toca las capas cuyo estado cambia, para no disparar más eventos de estilo. */
export function aplicarCapas(mapa, visibles) {
    const estilo = mapa?.getStyle?.();
    if (!estilo?.layers) return;
    for (const capa of estilo.layers) {
        const grupo = CAPAS.find((g) => g.prueba(capa));
        if (!grupo) continue;
        const deseado = visibles[grupo.id] === false ? 'none' : 'visible';
        const actual = mapa.getLayoutProperty(capa.id, 'visibility') ?? 'visible';
        if (actual !== deseado) mapa.setLayoutProperty(capa.id, 'visibility', deseado);
    }
}
