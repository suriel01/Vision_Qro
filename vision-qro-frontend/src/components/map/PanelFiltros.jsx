import { X } from 'lucide-react';
import { ESTADOS, FILTROS, MAP_THEMES } from './marcadores';
import { CAPAS } from './capasMapa';

const Segmento = ({ opciones, valor, onElegir, etiqueta }) => (
    <div className="seg" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
            <button type="button" key={o.id} className="seg__btn" aria-pressed={valor === o.id} onClick={() => onElegir(o.id)}>{o.label}</button>
        ))}
    </div>
);

/** Panel derecho: mapa base, vista (puntos o calor), estado y categorías. */
export default function PanelFiltros({
    mostrar, onAlternar, mapTheme, onTheme, capas, onCapa, showHeatmap, onHeatmap,
    estadoFiltro, onEstado, activeFilters, onToggle, onToggleAll,
}) {
    if (!mostrar) {
        return <button type="button" className="panel__reopen panel__reopen--right" onClick={onAlternar}>Capas y filtros</button>;
    }
    const todos = activeFilters.size === FILTROS.length;
    return (
        <aside className="panel panel--right" aria-label="Capas y filtros">
            <div className="panel__head">
                <span>Capas y filtros</span>
                <button type="button" className="iconbtn" aria-label="Ocultar filtros" onClick={onAlternar}><X size={16} /></button>
            </div>
            <div className="panel__body">
                <div>
                    <h3 className="sect-title">Mapa base</h3>
                    <Segmento etiqueta="Mapa base" opciones={Object.values(MAP_THEMES)} valor={mapTheme} onElegir={onTheme} />
                </div>
                <div>
                    <h3 className="sect-title">Detalles del mapa</h3>
                    <div className="checks">
                        {CAPAS.map((c) => (
                            <label className="check" key={c.id}>
                                <input type="checkbox" checked={capas[c.id] !== false} onChange={() => onCapa(c.id)} />
                                <span>{c.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <h3 className="sect-title">Vista</h3>
                    <Segmento
                        etiqueta="Vista" valor={showHeatmap ? 'calor' : 'puntos'} onElegir={(v) => onHeatmap(v === 'calor')}
                        opciones={[{ id: 'puntos', label: 'Puntos' }, { id: 'calor', label: 'Mapa de calor' }]}
                    />
                </div>
                <div>
                    <h3 className="sect-title">Estado</h3>
                    <Segmento
                        etiqueta="Estado" valor={estadoFiltro} onElegir={onEstado}
                        opciones={[{ id: 'todos', label: 'Todos' }, ...ESTADOS.map((e) => ({ id: e.id, label: e.label }))]}
                    />
                </div>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <h3 className="sect-title" style={{ margin: 0 }}>Categorías</h3>
                        <button type="button" className="link-btn" onClick={onToggleAll}>{todos ? 'Desmarcar todo' : 'Marcar todo'}</button>
                    </div>
                    <div className="checks">
                        {FILTROS.map((f) => (
                            <label className="check" key={f.id} style={{ '--c': f.color }}>
                                <input type="checkbox" checked={activeFilters.has(f.id)} onChange={() => onToggle(f.id)} />
                                <span>{f.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}
