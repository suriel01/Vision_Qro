import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertCircle, Trash2, X } from 'lucide-react';
import { API_BASE_URL, MAPBOX_TOKEN } from '../../config';
import LoginScreen from '../auth/LoginScreen';
import TopBar from './TopBar';
import Ajustes from './Ajustes';
import { aplicarCapas, afinarNoche, CAPAS_PREDETERMINADAS } from './capasMapa';
import { useAjustes, mapaEfectivo, temaEfectivo } from '../../ajustes';
import PanelResumen from './PanelResumen';
import PanelFiltros from './PanelFiltros';
import ReportePopup from './ReportePopup';
import { FILTROS, MAP_THEMES, getEstado, getTipo, heatmapLayer, pseudoRandom } from './marcadores';
import './mapa.css';

// El tablero de análisis se carga solo cuando se abre (no pesa en la primera carga del mapa)
const Analitica = lazy(() => import('../analytics/Analitica'));

function Marcador({ reporte, onClick }) {
    const tipo = getTipo(reporte.tipo);
    const estado = reporte.estado_gestion || 'nuevo';
    const Icono = tipo.grupo === 'bache' ? AlertCircle : Trash2;
    const descripcion = `${tipo.etiqueta}, ${getEstado(estado).label.toLowerCase()}`;
    return (
        <button
            type="button"
            className={`marker marker--${tipo.grupo === 'bache' ? 'bache' : 'basura'} marker--${estado}`}
            style={{ '--c': tipo.color }}
            title={descripcion}
            aria-label={descripcion}
            onClick={(e) => { e.stopPropagation(); onClick(reporte); }}
        >
            <Icono size={14} aria-hidden="true" />
        </button>
    );
}

export default function InteractiveMap() {
    const [userRole, setUserRole] = useState(null); // 'admin' | 'guest' | null
    const [token, setToken] = useState(null);
    const esAdmin = userRole === 'admin';
    const [vista, setVista] = useState('mapa');      // 'mapa' | 'analisis'

    const [reportes, setReportes] = useState([]);
    const [popupInfo, setPopupInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);
    const [fotosPublicas, setFotosPublicas] = useState(false);

    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [panelIzq, setPanelIzq] = useState(true);
    const [panelDer, setPanelDer] = useState(true);
    const [panelMovil, setPanelMovil] = useState(null); // 'resumen' | 'filtros' | null

    const [activeFilters, setActiveFilters] = useState(new Set(FILTROS.map((f) => f.id)));
    const [estadoFiltro, setEstadoFiltro] = useState('todos');
    const { ajustes, cambiar: cambiarAjustes, restablecer } = useAjustes();
    const [showAjustes, setShowAjustes] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(ajustes.vista === 'calor');
    const mapTheme = mapaEfectivo(ajustes);
    const [viewState, setViewState] = useState({ longitude: -100.3899, latitude: 20.5888, zoom: 12, pitch: 0, bearing: 0 });
    const primeraCarga = useRef(true);
    const mapaRef = useRef(null);

    useEffect(() => {
        const alCambiar = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', alCambiar);
        return () => window.removeEventListener('resize', alCambiar);
    }, []);

    // ¿Las fotos son públicas? Lo decide el servidor (FOTOS_PUBLICAS)
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/v1/config`)
            .then((r) => (r.ok ? r.json() : null))
            .then((c) => { if (c) setFotosPublicas(!!c.fotos_publicas); })
            .catch(() => {});
    }, []);

    const cargarReportes = useCallback(() => {
        setLoading(true);
        setError(null);
        fetch(`${API_BASE_URL}/api/v1/reportes-mapa`, { headers: token ? { 'X-API-Key': token } : {} })
            .then((r) => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
            .then((data) => {
                const procesados = data.map((p) => ({
                    ...p,
                    lng_visual: p.lng + (pseudoRandom(p.id || 0) - 0.5) * 0.00015,
                    lat_visual: p.lat + (pseudoRandom((p.id || 0) + 1234) - 0.5) * 0.00015,
                }));
                setReportes(procesados);
                if (primeraCarga.current && procesados.length > 0) {
                    primeraCarga.current = false;
                    const ultimo = procesados[procesados.length - 1];
                    setViewState((v) => ({ ...v, longitude: ultimo.lng_visual, latitude: ultimo.lat_visual, zoom: 15, transitionDuration: 2000 }));
                }
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    useEffect(() => {
        if (!userRole) return undefined;
        const inicio = setTimeout(cargarReportes, 0);
        const cada30s = setInterval(cargarReportes, 30000);
        return () => { clearTimeout(inicio); clearInterval(cada30s); };
    }, [userRole, cargarReportes]);

    const toggleFilter = (id) => setActiveFilters((prev) => {
        const sig = new Set(prev);
        if (sig.has(id)) sig.delete(id); else sig.add(id);
        return sig;
    });
    const toggleAllFilters = () => setActiveFilters(activeFilters.size === FILTROS.length ? new Set() : new Set(FILTROS.map((f) => f.id)));

    // ── Acciones de administración ──
    const eliminarReporte = useCallback((id) => {
        fetch(`${API_BASE_URL}/api/v1/reportes/${id}`, { method: 'DELETE', headers: { 'X-API-Key': token } })
            .then((r) => { if (!r.ok) throw new Error('No se pudo eliminar el reporte'); return r.json(); })
            .then(() => { setPopupInfo(null); cargarReportes(); })
            .catch((err) => { alert(`Error al eliminar: ${err.message}`); });
    }, [cargarReportes, token]);

    const exportarDatos = async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/v1/reportes/exportar-zip`, { headers: { 'X-API-Key': token } });
            if (!r.ok) throw new Error('Error al exportar ZIP');
            const url = window.URL.createObjectURL(await r.blob());
            const a = document.createElement('a');
            a.href = url;
            a.download = 'respaldo_vision_qro.zip';
            a.click();
        } catch (err) {
            alert(err.message);
        }
    };

    const importarDatos = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            const r = await fetch(`${API_BASE_URL}/api/v1/reportes/importar-zip`, { method: 'POST', headers: { 'X-API-Key': token }, body: formData });
            if (!r.ok) throw new Error('Error al importar ZIP');
            alert('Reportes importados exitosamente.');
            cargarReportes();
        } catch (err) {
            alert(err.message);
        } finally {
            e.target.value = '';
        }
    };

    const eliminarTodosDatos = async () => {
        if (!window.confirm('ALERTA ROJA: ¿Estás seguro de que deseas eliminar TODOS los reportes de la base de datos de forma permanente? Asegúrate de haber exportado un respaldo primero.')) return;
        try {
            const r = await fetch(`${API_BASE_URL}/api/v1/reportes-todos`, { method: 'DELETE', headers: { 'X-API-Key': token } });
            if (!r.ok) throw new Error('Error al eliminar todos los reportes');
            alert('Todos los reportes han sido eliminados.');
            cargarReportes();
        } catch (err) {
            alert(err.message);
        }
    };

    const cambiarEstado = useCallback(async (id, estado) => {
        const r = await fetch(`${API_BASE_URL}/api/v1/reportes/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': token },
            body: JSON.stringify({ estado }),
        });
        if (!r.ok) throw new Error('No se pudo cambiar el estado');
        const data = await r.json();
        setReportes((prev) => prev.map((x) => (x.id === id ? { ...x, estado_gestion: estado } : x)));
        setPopupInfo((p) => (p && p.id === id ? { ...p, estado_gestion: estado } : p));
        return data;
    }, [token]);

    const salir = () => {
        if (!window.confirm('¿Seguro que deseas salir?')) return;
        setUserRole(null);
        setToken(null);
        setPopupInfo(null);
        setVista('mapa');
        primeraCarga.current = true;
    };

    // ── Datos derivados ──
    const reportesFiltrados = useMemo(() => reportes.filter((r) => {
        if (estadoFiltro !== 'todos' && (r.estado_gestion || 'nuevo') !== estadoFiltro) return false;
        const t = r.tipo.toLowerCase();
        return Array.from(activeFilters).some((fid) => FILTROS.find((f) => f.id === fid)?.match.includes(t));
    }), [reportes, activeFilters, estadoFiltro]);

    const stats = useMemo(() => {
        let inorg = 0, org = 0, baches = 0, otros = 0;
        reportesFiltrados.forEach((r) => {
            const t = r.tipo.toLowerCase();
            if (t === 'inorganico' || t === 'inorg') inorg++;
            else if (t === 'organico' || t === 'org') org++;
            else if (['g', 'm', 'p', 'bache'].includes(t)) baches++;
            else otros++;
        });
        const total = reportesFiltrados.length;
        const dato = (count) => ({ count, pct: total ? (count / total) * 100 : 0 });
        return { total, inorg: dato(inorg), org: dato(org), baches: dato(baches), otros: dato(otros) };
    }, [reportesFiltrados]);

    const porEstado = useMemo(() => {
        const cuenta = { nuevo: 0, en_proceso: 0, resuelto: 0 };
        reportesFiltrados.forEach((r) => { cuenta[r.estado_gestion || 'nuevo'] += 1; });
        return cuenta;
    }, [reportesFiltrados]);

    const ultimos = useMemo(
        () => [...reportesFiltrados].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
        [reportesFiltrados],
    );

    const heatmapGeoJSON = useMemo(() => ({
        type: 'FeatureCollection',
        features: reportesFiltrados.map((r) => ({ type: 'Feature', properties: { tipo: r.tipo }, geometry: { type: 'Point', coordinates: [r.lng, r.lat] } })),
    }), [reportesFiltrados]);

    // Se ejecuta cuando carga o cambia el estilo del mapa: oculta lo que la persona apagó y afina el mapa oscuro
    const ajustarEstilo = () => {
        const mapa = mapaRef.current?.getMap();
        if (MAP_THEMES[mapTheme].refuerzo) afinarNoche(mapa);
        aplicarCapas(mapa, ajustes.capas);
    };

    const alternarCapa = (id) => {
        const capas = { ...ajustes.capas, [id]: ajustes.capas[id] === false };
        cambiarAjustes({ capas });
        aplicarCapas(mapaRef.current?.getMap(), capas);
    };

    const cambiarMapa = (id) => {
        cambiarAjustes({ mapa: id });
        const nuevo = id === 'auto' ? (temaEfectivo(ajustes) === 'oscuro' ? 'noche' : 'calles') : id;
        if (nuevo === mapTheme) return;
        setViewState((prev) => ({ ...prev, pitch: 0, bearing: 0 }));
    };

    const seleccionarReporte = useCallback((r) => {
        // El centro se corre un poco al norte para que el punto quede abajo y la ficha (que se abre hacia arriba) no se pegue a la barra superior
        const zoom = 17;
        const gradosPorPixel = (360 / (512 * 2 ** zoom)) * Math.cos((r.lat_visual * Math.PI) / 180);
        setViewState((prev) => ({ ...prev, longitude: r.lng_visual, latitude: r.lat_visual + 110 * gradosPorPixel, zoom, pitch: isMobile ? 0 : 45, transitionDuration: 1200 }));
        setPopupInfo(r);
        setPanelMovil(null);
        // Un toque breve de vibración confirma la selección en el teléfono (si el dispositivo lo permite)
        if (isMobile && ajustes.vibracion) navigator.vibrate?.(8);
    }, [isMobile, ajustes.vibracion]);

    const verEnMapa = useCallback((lat, lng) => {
        setVista('mapa');
        setViewState((prev) => ({ ...prev, longitude: lng, latitude: lat, zoom: 15.5, pitch: 0, bearing: 0, transitionDuration: 1200 }));
    }, []);

    if (!userRole) {
        return <LoginScreen onLogin={(role, tkn) => { setUserRole(role); setToken(tkn); }} />;
    }

    const mostrarIzq = isMobile ? panelMovil === 'resumen' : panelIzq;
    const mostrarDer = isMobile ? panelMovil === 'filtros' : panelDer;

    return (
        <div className="app">
            <TopBar
                vista={vista} onVista={setVista} total={reportesFiltrados.length} cargando={loading} error={error}
                onRefrescar={cargarReportes} esAdmin={esAdmin}
                onExportar={exportarDatos} onImportar={importarDatos} onEliminarTodo={eliminarTodosDatos} onAjustes={() => setShowAjustes(true)}
            />

            <div className="app__body">
                <section className={`view${mostrarDer && !isMobile ? ' view--panel-der' : ''}${isMobile && panelMovil ? ' view--hoja' : ''}`} hidden={vista !== 'mapa'} aria-label="Mapa de reportes">
                    <Map
                        ref={mapaRef}
                        {...viewState}
                        onLoad={ajustarEstilo}
                        onStyleData={ajustarEstilo}
                        onMove={(e) => setViewState(e.viewState)}
                        onClick={() => { if (isMobile) setPanelMovil(null); }}
                        style={{ width: '100%', height: '100%' }}
                        mapStyle={MAP_THEMES[mapTheme].url}
                        mapboxAccessToken={MAPBOX_TOKEN}
                        minZoom={9}
                        maxZoom={20}
                    >
                        <GeolocateControl position="bottom-right" trackUserLocation showUserHeading />
                        <NavigationControl position="bottom-right" showCompass showZoom />

                        {showHeatmap && (
                            <Source id="heatmap-source" type="geojson" data={heatmapGeoJSON}>
                                <Layer {...heatmapLayer(MAP_THEMES[mapTheme].oscuro)} />
                            </Source>
                        )}

                        {!showHeatmap && reportesFiltrados.map((p) => (
                            <Marker key={p.id} longitude={p.lng_visual} latitude={p.lat_visual} anchor="center">
                                <Marcador reporte={p} onClick={seleccionarReporte} />
                            </Marker>
                        ))}

                        {popupInfo && !showHeatmap && (
                            <Popup
                                key={popupInfo.id}
                                longitude={popupInfo.lng_visual}
                                latitude={popupInfo.lat_visual}
                                anchor="bottom"
                                offset={20}
                                closeOnClick
                                closeButton={false}
                                maxWidth="none"
                                onClose={() => setPopupInfo(null)}
                            >
                                <ReportePopup
                                    info={popupInfo} esAdmin={esAdmin} token={token} fotosPublicas={fotosPublicas}
                                    onClose={() => setPopupInfo(null)} onDelete={eliminarReporte}
                                    onCambiarEstado={cambiarEstado} onExpandImage={setExpandedImage}
                                />
                            </Popup>
                        )}
                    </Map>

                    <PanelResumen
                        mostrar={mostrarIzq} onAlternar={() => (isMobile ? setPanelMovil(null) : setPanelIzq((v) => !v))}
                        stats={stats} porEstado={porEstado} ultimos={ultimos} onSeleccionar={seleccionarReporte}
                    />
                    <PanelFiltros
                        mostrar={mostrarDer} onAlternar={() => (isMobile ? setPanelMovil(null) : setPanelDer((v) => !v))}
                        mapTheme={mapTheme} onTheme={cambiarMapa} capas={ajustes.capas} onCapa={alternarCapa} showHeatmap={showHeatmap}
                        onHeatmap={(v) => { setShowHeatmap(v); if (v) setPopupInfo(null); }}
                        estadoFiltro={estadoFiltro} onEstado={setEstadoFiltro}
                        activeFilters={activeFilters} onToggle={toggleFilter} onToggleAll={toggleAllFilters}
                    />
                </section>

                {vista === 'analisis' && (
                    <section className="view view--scroll" aria-label="Análisis de reportes">
                        <Suspense fallback={<p style={{ padding: 24 }} className="empty">Cargando análisis…</p>}>
                            <Analitica token={token} esAdmin={esAdmin} onVerEnMapa={verEnMapa} />
                        </Suspense>
                    </section>
                )}
            </div>

            {isMobile && vista === 'mapa' && (
                <nav className="mobilebar" aria-label="Paneles">
                    <div className="seg" role="group" aria-label="Paneles del mapa">
                        <button type="button" className="seg__btn" aria-pressed={panelMovil === 'resumen'} onClick={() => setPanelMovil(panelMovil === 'resumen' ? null : 'resumen')}>Resumen</button>
                        <button type="button" className="seg__btn" aria-pressed={panelMovil === 'filtros'} onClick={() => setPanelMovil(panelMovil === 'filtros' ? null : 'filtros')}>Capas y filtros</button>
                    </div>
                </nav>
            )}

            {showAjustes && (
                <Ajustes
                    ajustes={ajustes} onCambiar={cambiarAjustes} onMapa={cambiarMapa} onRestablecer={() => { restablecer(); aplicarCapas(mapaRef.current?.getMap(), CAPAS_PREDETERMINADAS); }}
                    onSalir={() => { setShowAjustes(false); salir(); }} onCerrar={() => setShowAjustes(false)}
                />
            )}

            {expandedImage && (
                <div className="lightbox" role="dialog" aria-label="Foto ampliada" onClick={() => setExpandedImage(null)}>
                    <img src={expandedImage} alt="Foto del reporte ampliada" onClick={(e) => e.stopPropagation()} />
                    <button type="button" className="iconbtn" aria-label="Cerrar" onClick={() => setExpandedImage(null)}><X size={20} /></button>
                </div>
            )}
        </div>
    );
}
