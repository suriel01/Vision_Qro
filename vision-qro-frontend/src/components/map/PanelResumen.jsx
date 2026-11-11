import Contador from '../Contador';
import { X } from 'lucide-react';
import { ESTADOS, getTipo, tiempoRelativo } from './marcadores';

const fila = (etiqueta, n, pct, color) => (
    <li className="bars__row" key={etiqueta} style={{ '--c': color }}>
        <span>{etiqueta}</span>
        <span className="bars__val">{n}{pct != null ? ` · ${Math.round(pct)} %` : ''}</span>
        <span className="bars__track"><span className="bars__fill" style={{ width: `${pct ?? 0}%` }} /></span>
    </li>
);

/** Panel izquierdo: totales, desglose por categoría y estado, y los últimos reportes. */
export default function PanelResumen({ mostrar, onAlternar, stats, porEstado, ultimos, onSeleccionar }) {
    const totalEstados = ESTADOS.reduce((s, e) => s + (porEstado[e.id] || 0), 0);
    // El panel y su botón se quedan montados y solo cambian de clase, para que plegar y desplegar se anime
    return (
        <>
        <button type="button" className={`panel__reopen panel__reopen--left${mostrar ? ' panel__reopen--oculto' : ''}`} onClick={onAlternar} tabIndex={mostrar ? -1 : 0} aria-hidden={mostrar}>Resumen</button>
        <aside className={`panel panel--left${mostrar ? '' : ' panel--oculto'}`} aria-label="Resumen de reportes" aria-hidden={!mostrar} inert={!mostrar}>
            <div className="panel__head">
                <span>Resumen</span>
                <button type="button" className="iconbtn" aria-label="Ocultar resumen" onClick={onAlternar}><X size={16} /></button>
            </div>
            <div className="panel__body">
                <div>
                    <div className="big-num num"><Contador texto={String(stats.total)} duracion={600} /><small>reportes con los filtros actuales</small></div>
                </div>

                <div>
                    <h3 className="sect-title">Por categoría</h3>
                    <ul className="bars">
                        {fila('Basura inorgánica', stats.inorg.count, stats.inorg.pct, 'var(--cat-inorganica)')}
                        {fila('Basura orgánica', stats.org.count, stats.org.pct, 'var(--cat-organica)')}
                        {fila('Baches', stats.baches.count, stats.baches.pct, 'var(--cat-bache)')}
                        {fila('Otros o pendientes', stats.otros.count, stats.otros.pct, 'var(--cat-otros)')}
                    </ul>
                </div>

                <div>
                    <h3 className="sect-title">Por estado</h3>
                    <ul className="bars">
                        {ESTADOS.map((e) => fila(e.label, porEstado[e.id] || 0, totalEstados ? ((porEstado[e.id] || 0) / totalEstados) * 100 : 0, e.color))}
                    </ul>
                </div>

                <div>
                    <h3 className="sect-title">Últimos reportes</h3>
                    {ultimos.length === 0 ? (
                        <p className="empty">No hay reportes con los filtros actuales.</p>
                    ) : (
                        <div className="recent">
                            {ultimos.map((r) => {
                                const t = getTipo(r.tipo);
                                return (
                                    <button type="button" key={r.id} className="recent__item" style={{ '--c': t.color }} onClick={() => onSeleccionar(r)}>
                                        <span className="recent__dot" aria-hidden="true" />
                                        <span>{t.etiqueta}</span>
                                        <span className="recent__meta">{tiempoRelativo(r.created_at)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </aside>
        </>
    );
}
