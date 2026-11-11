import { useRef } from 'react';
import { RefreshCw, Download, Upload, Trash2, LogOut } from 'lucide-react';

/** Barra superior: marca, vistas (Mapa / Análisis), conteo y acciones. Las de respaldo y borrado solo existen para el administrador. */
export default function TopBar({
    vista, onVista, total, cargando, error, onRefrescar,
    esAdmin, onExportar, onImportar, onEliminarTodo, onSalir,
}) {
    const archivo = useRef(null);
    return (
        <header className="topbar">
            <div className="topbar__brand">
                <img src="/icon-192.png" alt="" width="32" height="32" />
                <span>Vision Qro</span>
            </div>

            <div className="topbar__tabs" role="tablist" aria-label="Vista">
                <button type="button" role="tab" className="topbar__tab" aria-selected={vista === 'mapa'} onClick={() => onVista('mapa')}>Mapa</button>
                <button type="button" role="tab" className="topbar__tab" aria-selected={vista === 'analisis'} onClick={() => onVista('analisis')}>Análisis</button>
            </div>

            <div className="topbar__spacer" />

            {error && <span className="topbar__error" role="alert">{error}</span>}
            <span className="topbar__meta num">{cargando ? 'Cargando…' : `${total} ${total === 1 ? 'reporte' : 'reportes'}`}</span>

            <div className="topbar__actions">
                <button type="button" className="iconbtn" title="Actualizar datos" aria-label="Actualizar datos" onClick={onRefrescar} disabled={cargando}>
                    <RefreshCw size={16} />
                </button>

                {esAdmin && (
                    <>
                        <span className="topbar__sep" aria-hidden="true" />
                        <button type="button" className="iconbtn" title="Exportar respaldo (ZIP)" aria-label="Exportar respaldo (ZIP)" onClick={onExportar}>
                            <Download size={16} />
                        </button>
                        <input ref={archivo} type="file" accept=".zip" hidden onChange={onImportar} />
                        <button type="button" className="iconbtn" title="Importar respaldo (ZIP)" aria-label="Importar respaldo (ZIP)" onClick={() => archivo.current?.click()}>
                            <Upload size={16} />
                        </button>
                        <button type="button" className="iconbtn iconbtn--danger" title="Eliminar todos los reportes" aria-label="Eliminar todos los reportes" onClick={onEliminarTodo}>
                            <Trash2 size={16} />
                        </button>
                    </>
                )}

                <span className="topbar__sep" aria-hidden="true" />
                <span className={`badge${esAdmin ? ' badge--admin' : ''}`}>{esAdmin ? 'Administrador' : 'Invitado'}</span>
                <button type="button" className="iconbtn" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={onSalir}>
                    <LogOut size={16} />
                </button>
            </div>
        </header>
    );
}
