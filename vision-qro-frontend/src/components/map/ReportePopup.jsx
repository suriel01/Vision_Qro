import { useEffect, useState } from 'react';
import { X, Maximize2, Navigation } from 'lucide-react';
import { API_BASE_URL } from '../../config';
import { ESTADOS, getEstado, getTipo, formatFecha, traducirObjeto } from './marcadores';

// Foto del reporte: pública si el servidor lo permite; si no, solo la descarga el administrador con su clave.
function useFotoSrc(info, token, fotosPublicas, esAdmin) {
    // El resultado se guarda con la clave del reporte que lo produjo: un resultado viejo nunca se muestra en otra ficha.
    const [res, setRes] = useState({ clave: null, src: null, error: false });
    const clave = `${info.id}|${token ?? ''}`;
    const hayFoto = !!info.tiene_foto;
    const necesitaFetch = hayFoto && !fotosPublicas && esAdmin && !!token;
    const idReporte = info.id;

    useEffect(() => {
        if (!necesitaFetch) return undefined;
        let objectUrl = null;
        let cancelado = false;
        fetch(`${API_BASE_URL}/api/v1/foto/${idReporte}`, { headers: { 'X-API-Key': token } })
            .then((r) => { if (!r.ok) throw new Error('sin acceso'); return r.blob(); })
            .then((blob) => { if (cancelado) return; objectUrl = URL.createObjectURL(blob); setRes({ clave, src: objectUrl, error: false }); })
            .catch(() => { if (!cancelado) setRes({ clave, src: null, error: true }); });
        return () => { cancelado = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [necesitaFetch, idReporte, token, clave]);

    const actual = res.clave === clave ? res : { src: null, error: false };
    const publica = hayFoto && fotosPublicas ? `${API_BASE_URL}/api/v1/foto/${idReporte}` : null;
    return { src: publica ?? actual.src, error: actual.error, setError: (e) => setRes({ clave, src: actual.src, error: e }) };
}

/** Ficha de un reporte. El público ve lo esencial; el administrador, además, los datos técnicos y los controles de gestión. */
export default function ReportePopup({ info, esAdmin, token, fotosPublicas, onClose, onDelete, onCambiarEstado, onExpandImage }) {
    const tipo = getTipo(info.tipo);
    const estado = getEstado(info.estado_gestion);
    const { src, error: fotoError, setError: setFotoError } = useFotoSrc(info, token, fotosPublicas, esAdmin);
    const fotoSrc = fotoError ? null : src;
    const [aviso, setAviso] = useState('');
    const [cambiando, setCambiando] = useState(false);
    const manual = info.confianza == null;

    useEffect(() => {
        const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onClose]);

    const cambiar = async (id) => {
        setCambiando(true);
        setAviso('');
        try {
            const r = await onCambiarEstado(info.id, id);
            setAviso(id === 'nuevo' ? '' : (r.notificado ? 'Se avisó a la persona por Telegram.' : 'Estado guardado. No se pudo avisar por Telegram.'));
        } catch (err) {
            setAviso(err.message);
        } finally {
            setCambiando(false);
        }
    };

    return (
        <div className="popup" role="dialog" aria-label={`Reporte: ${tipo.etiqueta}`} style={{ '--c': tipo.color }}>
            <button type="button" className="iconbtn popup__close" aria-label="Cerrar ficha" onClick={onClose}><X size={16} /></button>

            {fotoSrc && (
                <div className="popup__photo">
                    <img src={fotoSrc} alt="Foto del reporte" onError={() => setFotoError(true)} />
                    <button type="button" className="iconbtn popup__expand" aria-label="Ampliar foto" onClick={() => onExpandImage(fotoSrc)}><Maximize2 size={15} /></button>
                </div>
            )}

            <div className="popup__body">
                <div className="popup__head">
                    <h2 className="popup__title">{tipo.etiqueta}</h2>
                    <span className="chip" style={{ '--c': estado.color }}>{estado.label}</span>
                </div>

                <dl className="dl">
                    <dt>Fecha</dt><dd>{formatFecha(info.created_at) ?? 'Sin fecha'}</dd>
                    <dt>Reporte</dt><dd>#{info.id}</dd>
                    {info.objeto_detectado && <><dt>Objeto</dt><dd style={{ textTransform: 'capitalize' }}>{traducirObjeto(info.objeto_detectado)}</dd></>}
                    <dt>Clasificación</dt><dd>{manual ? 'Manual' : `Automática · ${info.confianza.toFixed(1)} % de confianza`}</dd>
                    <dt>Ubicación</dt><dd>{info.lat?.toFixed(6)}, {info.lng?.toFixed(6)}</dd>
                </dl>

                {info.tiene_foto && fotoError && <p className="popup__note">No se pudo cargar la foto.</p>}

                <div className="popup__actions">
                    <a className="btn" href={`https://www.google.com/maps/dir/?api=1&destination=${info.lat},${info.lng}`} target="_blank" rel="noopener noreferrer">
                        <Navigation size={14} /> Cómo llegar
                    </a>

                    {esAdmin && (
                        <>
                            <div>
                                <p className="field-label">Estado del reporte</p>
                                <div className="seg status-seg" role="group" aria-label="Estado del reporte">
                                    {ESTADOS.map((e) => (
                                        <button
                                            type="button" key={e.id} className="seg__btn" style={{ '--c': e.color }}
                                            aria-pressed={e.id === (info.estado_gestion || 'nuevo')}
                                            disabled={cambiando} onClick={() => cambiar(e.id)}
                                        >
                                            {e.label}
                                        </button>
                                    ))}
                                </div>
                                {aviso && <p className="popup__note" style={{ marginTop: 6 }} role="status">{aviso}</p>}
                            </div>
                            <button
                                type="button" className="btn btn--danger"
                                onClick={() => { if (window.confirm('¿Eliminar este reporte de forma permanente?')) onDelete(info.id); }}
                            >
                                Eliminar reporte
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
