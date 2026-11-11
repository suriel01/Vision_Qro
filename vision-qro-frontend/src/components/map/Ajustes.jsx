import { useEffect, useRef } from 'react';
import { X, LogOut, RotateCcw } from 'lucide-react';
import { MAP_THEMES } from './marcadores';

const Opciones = ({ etiqueta, valor, opciones, onElegir }) => (
    <div className="seg" role="group" aria-label={etiqueta}>
        {opciones.map((o) => (
            <button type="button" key={o.id} className="seg__btn" aria-pressed={valor === o.id} onClick={() => onElegir(o.id)}>{o.label}</button>
        ))}
    </div>
);

const Fila = ({ titulo, ayuda, children }) => (
    <div className="ajustes__fila">
        <div>
            <h3 className="ajustes__titulo">{titulo}</h3>
            {ayuda && <p className="ajustes__ayuda">{ayuda}</p>}
        </div>
        {children}
    </div>
);

/** Ventana de ajustes: apariencia, mapa base, vista inicial, animaciones y vibración. Todo se guarda en este navegador. */
export default function Ajustes({ ajustes, onCambiar, onMapa, onRestablecer, onSalir, onCerrar }) {
    const cerrar = useRef(null);

    useEffect(() => {
        cerrar.current?.focus();
        const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [onCerrar]);

    const hayVibracion = typeof navigator !== 'undefined' && 'vibrate' in navigator;

    return (
        <div className="ajustes__fondo" onClick={onCerrar}>
            <div className="ajustes" role="dialog" aria-modal="true" aria-labelledby="ajustes-titulo" onClick={(e) => e.stopPropagation()}>
                <div className="ajustes__cabecera">
                    <h2 id="ajustes-titulo">Ajustes</h2>
                    <button ref={cerrar} type="button" className="iconbtn" aria-label="Cerrar ajustes" onClick={onCerrar}><X size={18} /></button>
                </div>

                <div className="ajustes__cuerpo">
                    <Fila titulo="Tema" ayuda="Automático sigue la configuración de tu dispositivo.">
                        <Opciones
                            etiqueta="Tema" valor={ajustes.tema} onElegir={(v) => onCambiar({ tema: v })}
                            opciones={[{ id: 'auto', label: 'Automático' }, { id: 'claro', label: 'Claro' }, { id: 'oscuro', label: 'Oscuro' }]}
                        />
                    </Fila>

                    <Fila titulo="Mapa base" ayuda="Automático usa Calles con tema claro y Noche con tema oscuro.">
                        <Opciones
                            etiqueta="Mapa base" valor={ajustes.mapa} onElegir={onMapa}
                            opciones={[{ id: 'auto', label: 'Automático' }, ...Object.values(MAP_THEMES)]}
                        />
                    </Fila>

                    <Fila titulo="Vista al abrir el mapa">
                        <Opciones
                            etiqueta="Vista al abrir" valor={ajustes.vista} onElegir={(v) => onCambiar({ vista: v })}
                            opciones={[{ id: 'puntos', label: 'Puntos' }, { id: 'calor', label: 'Mapa de calor' }]}
                        />
                    </Fila>

                    <Fila titulo="Animaciones" ayuda="Reducirlas ayuda si te marean o quieres ahorrar batería.">
                        <Opciones
                            etiqueta="Animaciones" valor={ajustes.animaciones} onElegir={(v) => onCambiar({ animaciones: v })}
                            opciones={[{ id: 'normal', label: 'Normales' }, { id: 'reducida', label: 'Reducidas' }]}
                        />
                    </Fila>

                    {hayVibracion && (
                        <Fila titulo="Vibración" ayuda="Un toque breve al elegir un reporte.">
                            <Opciones
                                etiqueta="Vibración" valor={ajustes.vibracion ? 'si' : 'no'} onElegir={(v) => onCambiar({ vibracion: v === 'si' })}
                                opciones={[{ id: 'si', label: 'Activada' }, { id: 'no', label: 'Desactivada' }]}
                            />
                        </Fila>
                    )}
                </div>

                <div className="ajustes__pie">
                    <button type="button" className="btn" onClick={onRestablecer}><RotateCcw size={15} /> Restablecer</button>
                    <button type="button" className="btn btn--danger" onClick={onSalir}><LogOut size={15} /> Cerrar sesión</button>
                </div>
                <p className="ajustes__nota">Tus ajustes se guardan solo en este navegador. <a href="/privacidad.html" target="_blank" rel="noreferrer">Aviso de privacidad</a></p>
            </div>
        </div>
    );
}
