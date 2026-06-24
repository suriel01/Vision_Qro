import { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { Marker, Popup, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Trash2, RefreshCw, X, MapPin, Clock, Zap, Image, Layers, Activity, CheckSquare, Square, Moon, Sun, Mountain, BarChart3, ChevronLeft, ChevronRight, Navigation, LogOut, User, Maximize2, Download } from 'lucide-react';

const MAPBOX_TOKEN  = import.meta.env.VITE_MAPBOX_TOKEN;
const API_BASE_URL  = import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes("localhost") ? import.meta.env.VITE_API_URL : `http://${window.location.hostname}:8000`;

// ── Función Pseudo-Aleatoria Determinista ──────────────────────────────────
const pseudoRandom = (seed) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

// ── Temas del Mapa ──────────────────────────────────────────────────────────
const MAP_THEMES = {
    dark: { id: 'dark', label: 'Oscuro', url: 'mapbox://styles/mapbox/dark-v11', icon: Moon },
    light: { id: 'light', label: 'Calles', url: 'mapbox://styles/mapbox/streets-v12', icon: Sun },
    satellite: { id: 'satellite', label: 'Satélite', url: 'mapbox://styles/mapbox/satellite-v9', icon: Mountain }
};

// ── Config visual por tipo ──────────────────────────────────────────────────
const CONFIG = {
    'bache':      { bg: '#ef4444', glow: '#ef444466', label: 'Bache',         icon: AlertCircle },
    'p':          { bg: '#ef4444', glow: '#ef444466', label: 'Bache Pequeño', icon: AlertCircle },
    'm':          { bg: '#ef4444', glow: '#ef444466', label: 'Bache Mediano', icon: AlertCircle },
    'g':          { bg: '#ef4444', glow: '#ef444466', label: 'Bache Grande',  icon: AlertCircle },
    'organico':   { bg: '#22c55e', glow: '#22c55e66', label: 'Orgánico',      icon: Trash2 },
    'org':        { bg: '#22c55e', glow: '#22c55e66', label: 'Orgánico',      icon: Trash2 },
    'inorganico': { bg: '#3b82f6', glow: '#3b82f666', label: 'Inorgánico',    icon: Trash2 },
    'inorg':      { bg: '#3b82f6', glow: '#3b82f666', label: 'Inorgánico',    icon: Trash2 },
    'pendiente':  { bg: '#f59e0b', glow: '#f59e0b66', label: 'Pendiente',     icon: AlertCircle },
    'otro':       { bg: '#f59e0b', glow: '#f59e0b66', label: 'Otro',          icon: AlertCircle },
    'bolsa':      { bg: '#8b5cf6', glow: '#8b5cf666', label: 'Bolsa de basura', icon: Trash2 },
};

const getConfig = (tipo) => CONFIG[tipo?.toLowerCase()] ?? CONFIG['pendiente'];

const formatFecha = (iso) => iso
    ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

// ── Filtros Disponibles ─────────────────────────────────────────────────────
const FILTROS = [
    { id: 'inorg',   label: 'Inorgánicos',   icon: Trash2,      color: '#3b82f6', match: ['inorganico', 'inorg'] },
    { id: 'org',     label: 'Orgánicos',     icon: Trash2,      color: '#22c55e', match: ['organico', 'org'] },
    { id: 'bolsa',   label: 'Bolsas de basura', icon: Trash2,   color: '#8b5cf6', match: ['bolsa'] },
    { id: 'bache_g', label: 'Bache (Grande)',icon: AlertCircle, color: '#ef4444', match: ['g', 'bache'] },
    { id: 'bache_m', label: 'Bache (Mediano)',icon: AlertCircle, color: '#ef4444', match: ['m'] },
    { id: 'bache_p', label: 'Bache (Pequeño)',icon: AlertCircle, color: '#ef4444', match: ['p'] },
    { id: 'otros',   label: 'Otros/Pdte.',   icon: AlertCircle, color: '#f59e0b', match: ['pendiente', 'otro'] },
];

// ── Capa de Mapa de Calor ───────────────────────────────────────────────────
const heatmapLayer = {
    id: 'reportes-heatmap',
    type: 'heatmap',
    paint: {
        'heatmap-weight': 1,
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
        'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,   'rgba(0,0,0,0)',
            0.1, '#3b82f6',
            0.3, '#22c55e',
            0.5, '#eab308',
            0.7, '#f97316',
            0.9, '#ef4444',
            1,   '#b91c1c'
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 15, 45],
        'heatmap-opacity': 0.85
    }
};

// ── Componente de Pantalla de Login Premium ─────────────────────────────────
function LoginScreen({ onLogin }) {
    const [tab, setTab] = useState('guest'); // 'guest' | 'admin'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (tab === 'admin') {
            try {
                const res = await fetch(`${API_BASE_URL}/api/v1/auth`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                if (!res.ok) throw new Error('Contraseña incorrecta');
                const data = await res.json();
                onLogin('admin', data.token);
            } catch(err) {
                setError(err.message);
            }
        } else {
            onLogin('guest', null);
        }
    };

    return (
        <div style={{
            width: '100vw', height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: 'white',
            overflow: 'hidden',
            position: 'relative'
        }}>
            {/* Brillos ambientales */}
            <div style={{
                position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)',
                top: '10%', left: '15%', filter: 'blur(40px)'
            }} />
            <div style={{
                position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                bottom: '10%', right: '15%', filter: 'blur(40px)'
            }} />

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                    width: 360,
                    background: 'rgba(17, 24, 39, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 24,
                    padding: '32px 28px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(59, 130, 246, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    zIndex: 2
                }}
            >
                {/* Logo / Título */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 28 }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                        padding: 10, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.3)'
                    }}>
                        <Layers size={28} color="white" />
                    </div>
                    <h2 style={{
                        margin: '10px 0 0', fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        textTransform: 'uppercase'
                    }}>
                        Vision Qro
                    </h2>
                    <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>
                        Sistema de Monitoreo Georreferenciado
                    </span>
                </div>

                {/* Selector de Pestaña */}
                <div style={{
                    display: 'flex', width: '100%', background: 'rgba(255, 255, 255, 0.04)',
                    padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: 24
                }}>
                    <button
                        onClick={() => { setTab('guest'); setError(''); }}
                        style={{
                            flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                            background: tab === 'guest' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: tab === 'guest' ? 'white' : '#9ca3af', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        Invitado
                    </button>
                    <button
                        onClick={() => { setTab('admin'); setError(''); }}
                        style={{
                            flex: 1, padding: '8px 0', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
                            background: tab === 'admin' ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: tab === 'admin' ? 'white' : '#9ca3af', cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        Administrador
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {tab === 'admin' && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Usuario</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="admin"
                                    required
                                    style={{
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Contraseña</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: 8, padding: '10px 12px', color: 'white', fontSize: 13, outline: 'none',
                                        transition: 'border-color 0.2s'
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                                />
                            </div>
                        </>
                    )}

                    {tab === 'guest' && (
                        <div style={{
                            padding: '16px', borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)',
                            border: '1px solid rgba(59, 130, 246, 0.15)', color: '#93c5fd', fontSize: 12,
                            textAlign: 'center', lineHeight: '1.5', margin: '8px 0'
                        }}>
                            Acceso libre y de solo lectura. Podrás explorar reportes, aplicar filtros e interactuar con el mapa.
                        </div>
                    )}

                    {error && (
                        <motion.span
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            style={{ color: '#f87171', fontSize: 12, fontWeight: 500, textAlign: 'center' }}
                        >
                            ⚠️ {error}
                        </motion.span>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        style={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
                            color: 'white', border: 'none', borderRadius: 10, padding: '12px 0',
                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                            marginTop: 10
                        }}
                    >
                        {tab === 'admin' ? 'Iniciar Sesión' : 'Entrar como Invitado'}
                    </motion.button>
                </form>
            </motion.div>
        </div>
    );
}

// ── Componente Popup Premium ────────────────────────────────────────────────
function ReportePopup({ info, onClose, userRole, onDelete, isLight, onExpandImage }) {
    const ui    = getConfig(info.tipo);
    const Icon  = ui.icon;
    const fecha = formatFecha(info.created_at);
    const [imgError, setImgError] = useState(false);
    const fotoSrc = info.tiene_foto && !imgError
        ? `${API_BASE_URL}/api/v1/foto/${info.id}`
        : null;
    const isManual = info.confianza == null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            style={{
                background:   isLight ? '#ffffff' : 'linear-gradient(145deg, #0f0f1a 0%, #111827 100%)',
                borderRadius:  16,
                overflow:     'hidden',
                width:         280,
                border:       `1px solid ${ui.bg}44`,
                boxShadow:    isLight ? `0 24px 64px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05), 0 0 40px ${ui.glow}33` : `0 24px 64px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px ${ui.glow}`,
                fontFamily:   'system-ui, -apple-system, sans-serif',
                color:        isLight ? '#1f2937' : 'white',
            }}
        >
            {/* ── FOTO / PLACEHOLDER ── */}
            <div style={{ position: 'relative', height: 220, width: '100%', overflow: 'hidden', background: isLight ? '#f3f4f6' : '#09090e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {fotoSrc ? (
                    <>
                        <img
                            src={fotoSrc}
                            alt=""
                            style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(12px) brightness(0.4)', transform: 'scale(1.2)', zIndex: 0 }}
                        />
                        <img
                            src={fotoSrc}
                            alt="Foto del reporte"
                            onError={() => setImgError(true)}
                            style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', zIndex: 1 }}
                        />
                    </>
                ) : (
                    <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        background: isLight ? `radial-gradient(ellipse at center, ${ui.bg}22 0%, #f3f4f6 70%)` : `radial-gradient(ellipse at center, ${ui.bg}22 0%, #0f0f1a 70%)`,
                        gap: 8,
                        zIndex: 1
                    }}>
                        <Image size={32} color={isLight ? `${ui.bg}aa` : `${ui.bg}88`} />
                        <span style={{ fontSize: 11, color: isLight ? '#94a3b8' : '#4b5563' }}>Sin foto</span>
                    </div>
                )}

                {/* Gradiente Oscuro de Fondo */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: isLight 
                        ? 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.2) 45%, transparent 100%)'
                        : 'linear-gradient(to top, rgba(10,10,20,0.95) 0%, rgba(10,10,20,0.3) 45%, transparent 100%)',
                    zIndex: 2,
                    pointerEvents: 'none'
                }} />

                {/* Etiqueta de Categoría */}
                <div style={{
                    position: 'absolute', bottom: 12, left: 12,
                    display: 'flex', alignItems: 'center', gap: 8,
                    zIndex: 10
                }}>
                    <div style={{
                        background:   ui.bg,
                        borderRadius: '50%',
                        padding:       7,
                        display:      'flex',
                        boxShadow:    isLight ? `0 4px 12px ${ui.bg}66` : `0 0 12px ${ui.glow}`,
                    }}>
                        <Icon size={16} color="white" />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: isLight ? '#1f2937' : 'white', textShadow: isLight ? 'none' : '0 1px 8px rgba(0,0,0,0.8)' }}>
                        {ui.label}
                    </span>
                </div>

                {/* Botón Maximizar Imagen */}
                {fotoSrc && (
                    <button
                        onClick={() => onExpandImage(fotoSrc)}
                        style={{
                            position:     'absolute', top: 10, left: 10,
                            background:   isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.55)',
                            backdropFilter: 'blur(6px)',
                            border:       isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '50%',
                            width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: isLight ? '#1f2937' : 'white',
                            zIndex: 10
                        }}
                        title="Expandir imagen"
                    >
                        <Maximize2 size={13} />
                    </button>
                )}

                {/* Botón X de Cierre */}
                <button
                    onClick={onClose}
                    style={{
                        position:     'absolute', top: 10, right: 10,
                        background:   isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(6px)',
                        border:       isLight ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '50%',
                        width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: isLight ? '#1f2937' : 'white',
                        zIndex: 10
                    }}
                >
                    <X size={13} />
                </button>
            </div>

            {/* ── CUERPO ── */}
            <div style={{ padding: '14px 16px 16px' }}>
                {!isManual && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: isLight ? '#64748b' : '#6b7280' }}>
                                <Zap size={11} />
                                <span>Confianza IA</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: ui.bg }}>
                                {info.confianza?.toFixed(1)}%
                            </span>
                        </div>
                        <div style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${info.confianza}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                                style={{ background: `linear-gradient(90deg, ${ui.bg}, ${ui.bg}cc)`, height: '100%', borderRadius: 4 }}
                            />
                        </div>
                    </div>
                )}

                <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', marginBottom: 12 }} />

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Layers size={13} color={isLight ? "#475569" : "#4b5563"} />
                    <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', fontWeight: 600 }}>
                        ID de reporte: <span style={{ color: isLight ? '#0f172a' : 'white', fontWeight: 700 }}>{info.id}</span>
                    </span>
                </div>

                {info.objeto_detectado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <Zap size={13} color={isLight ? "#475569" : "#4b5563"} />
                        <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', fontWeight: 600 }}>
                            Objeto{isManual ? '' : ' (YOLO)'}: <span style={{ color: isLight ? '#0f172a' : 'white', fontWeight: 700, textTransform: 'capitalize' }}>{info.objeto_detectado}</span>
                        </span>
                    </div>
                )}

                {info.telegram_username && info.telegram_username !== 'undefined' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <User size={13} color={isLight ? "#475569" : "#4b5563"} />
                        <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', fontWeight: 600 }}>
                            Reportado por: <span style={{ color: isLight ? '#0f172a' : 'white', fontWeight: 700 }}>@{info.telegram_username}</span>
                        </span>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <MapPin size={13} color={isLight ? "#475569" : "#4b5563"} />
                    <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
                        {info.lat?.toFixed(6)}, {info.lng?.toFixed(6)}
                    </span>
                </div>

                {/* Badges inferiores */}
                {fecha && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <Clock size={13} color={isLight ? "#475569" : "#4b5563"} />
                        <span style={{ fontSize: 12, color: isLight ? '#64748b' : '#9ca3af' }}>{fecha}</span>
                    </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{
                        display:     'inline-flex',
                        alignItems:  'center',
                        gap:          5,
                        padding:     '4px 10px',
                        borderRadius: 99,
                        background:  `${ui.bg}18`,
                        border:      `1px solid ${ui.bg}33`,
                    }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: ui.bg }} />
                        <span style={{
                            color:         ui.bg,
                            fontSize:      10,
                            fontWeight:    800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}>
                            {info.tipo}
                        </span>
                    </div>

                    <div style={{
                        display:     'inline-flex',
                        alignItems:  'center',
                        gap:          5,
                        padding:     '4px 10px',
                        borderRadius: 99,
                        background:  isManual ? 'rgba(168, 85, 247, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                        border:      isManual ? '1px solid rgba(168, 85, 247, 0.3)' : '1px solid rgba(56, 189, 248, 0.3)',
                    }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: isManual ? '#a855f7' : '#38bdf8' }} />
                        <span style={{
                            color:         isManual ? '#a855f7' : '#38bdf8',
                            fontSize:      10,
                            fontWeight:    800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}>
                            {isManual ? 'GENERADO MANUALMENTE' : 'GENERADO POR IA'}
                        </span>
                    </div>
                </div>

                {/* Botón de Google Maps GPS */}
                <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${info.lat},${info.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)', 
                        border: isLight ? `1px solid rgba(0,0,0,0.08)` : `1px solid rgba(255,255,255,0.1)`,
                        borderRadius: 8, padding: '8px 12px', 
                        color: isLight ? '#475569' : '#9ca3af', 
                        fontSize: 12,
                        textDecoration: 'none', fontWeight: 600, transition: 'all 0.2s', marginTop: 12
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
                        e.currentTarget.style.color = isLight ? '#0f172a' : 'white';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)';
                        e.currentTarget.style.color = isLight ? '#475569' : '#9ca3af';
                    }}
                >
                    <Navigation size={13} />
                    <span>Ver ruta en GPS</span>
                </a>

                {/* Botón de Eliminar Reporte (Solo Administrador) */}
                {userRole === 'admin' && (
                    <button
                        onClick={() => {
                            if (window.confirm("¿Estás seguro de que deseas eliminar este reporte permanentemente?")) {
                                onDelete(info.id);
                            }
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            background: 'rgba(239, 68, 68, 0.1)', border: `1px solid rgba(239, 68, 68, 0.3)`,
                            borderRadius: 8, padding: '8px 12px', color: '#f87171', fontSize: 12,
                            fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', marginTop: 8,
                            width: '100%'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.currentTarget.style.color = '#ef4444';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.color = '#f87171';
                        }}
                    >
                        <Trash2 size={13} />
                        <span>Eliminar Reporte</span>
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ── Componente Principal ────────────────────────────────────────────────────
export default function InteractiveMap() {
    const [userRole, setUserRole]   = useState(null); // 'admin' | 'guest' | null
    const [token, setToken]         = useState(null);
    const [reportes, setReportes]   = useState([]);
    const [popupInfo, setPopupInfo] = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);
    
    // UI States
    const [activeFilters, setActiveFilters] = useState(new Set(FILTROS.map(f => f.id)));
    const [showHeatmap, setShowHeatmap]   = useState(false);
    const [mapTheme, setMapTheme]         = useState('dark');
    const [showSidebar, setShowSidebar]   = useState(true); // Control de Panel Izquierdo
    const [showRightSidebar, setShowRightSidebar] = useState(true); // Control de Panel Derecho

    const [viewState, setViewState] = useState({
        longitude: -100.3899, latitude: 20.5888, zoom: 12, pitch: 0, bearing: 0
    });

    const cargarReportes = useCallback(() => {
        setLoading(true);
        setError(null);
        fetch(`${API_BASE_URL}/api/v1/reportes-mapa`)
            .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.json(); })
            .then(data => {
                const procesados = data.map(p => {
                    const prng = pseudoRandom(p.id || 0);
                    const prng2 = pseudoRandom((p.id || 0) + 1234);
                    return {
                        ...p,
                        lng_visual: p.lng + (prng - 0.5) * 0.00015,
                        lat_visual: p.lat + (prng2 - 0.5) * 0.00015,
                    };
                });
                
                setReportes(prev => {
                    if (prev.length === 0 && procesados.length > 0) {
                        const u = procesados[procesados.length - 1];
                        setViewState(v => ({ ...v, longitude: u.lng_visual, latitude: u.lat_visual, zoom: 15, transitionDuration: 2000 }));
                    }
                    return procesados;
                });
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (userRole) {
            cargarReportes();
            const iv = setInterval(cargarReportes, 30000);
            return () => clearInterval(iv);
        }
    }, [userRole, cargarReportes]);

    const toggleFilter = (id) => {
        setActiveFilters(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAllFilters = () => {
        if (activeFilters.size === FILTROS.length) {
            setActiveFilters(new Set()); 
        } else {
            setActiveFilters(new Set(FILTROS.map(f => f.id))); 
        }
    };

    // ── Eliminar Reporte (Admin) ──
    const eliminarReporte = useCallback((id) => {
        fetch(`${API_BASE_URL}/api/v1/reportes/${id}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': token }
        })
        .then(r => {
            if (!r.ok) throw new Error("No se pudo eliminar el reporte");
            return r.json();
        })
        .then(() => {
            setPopupInfo(null);
            cargarReportes();
        })
        .catch(err => {
            alert(`Error al eliminar: ${err.message}`);
        });
    }, [cargarReportes, token]);

    const exportarDatos = async () => {
        try {
            const r = await fetch(`${API_BASE_URL}/api/v1/reportes/exportar`, {
                headers: { 'X-API-Key': token }
            });
            if (!r.ok) throw new Error("Error al exportar");
            const blob = await r.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'reportes_vision_qro.csv';
            a.click();
        } catch(err) {
            alert(err.message);
        }
    };

    // ── Filtrado ──
    const reportesFiltrados = useMemo(() => {
        return reportes.filter(r => {
            const t = r.tipo.toLowerCase();
            return Array.from(activeFilters).some(fid => {
                const filtro = FILTROS.find(f => f.id === fid);
                return filtro && filtro.match.includes(t);
            });
        });
    }, [reportes, activeFilters]);

    // ── Métricas y Estadísticas ──
    const stats = useMemo(() => {
        let inorg = 0, org = 0, baches = 0, otros = 0;
        reportesFiltrados.forEach(r => {
            const t = r.tipo.toLowerCase();
            if (t === 'inorganico' || t === 'inorg') inorg++;
            else if (t === 'organico' || t === 'org') org++;
            else if (['g', 'm', 'p', 'bache'].includes(t)) baches++;
            else otros++;
        });
        const total = reportesFiltrados.length;
        return {
            total,
            inorg: { count: inorg, pct: total ? (inorg / total) * 100 : 0 },
            org: { count: org, pct: total ? (org / total) * 100 : 0 },
            baches: { count: baches, pct: total ? (baches / total) * 100 : 0 },
            otros: { count: otros, pct: total ? (otros / total) * 100 : 0 }
        };
    }, [reportesFiltrados]);

    // ── Últimos 5 Reportes ──
    const ultimosReportes = useMemo(() => {
        return [...reportesFiltrados]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);
    }, [reportesFiltrados]);

    // GeoJSON
    const heatmapGeoJSON = useMemo(() => {
        return {
            type: 'FeatureCollection',
            features: reportesFiltrados.map(r => ({
                type: 'Feature',
                properties: { tipo: r.tipo },
                geometry: { type: 'Point', coordinates: [r.lng, r.lat] }
            }))
        };
    }, [reportesFiltrados]);

    const isLight = mapTheme === 'light';
    const hudBg = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(10,10,20,0.88)';
    const hudText = isLight ? '#1f2937' : 'white';
    const hudBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
    const hudMuted = isLight ? '#6b7280' : '#9ca3af';

    const handleThemeChange = (themeId) => {
        if (mapTheme === themeId) return;
        setMapTheme(themeId);
        if(themeId === 'satellite') {
            setViewState(prev => ({ ...prev, pitch: 55, bearing: -10, zoom: 15 }));
        } else {
            setViewState(prev => ({ ...prev, pitch: 0, bearing: 0 }));
        }
    };

    const seleccionarReporte = useCallback((r) => {
        setViewState(prev => ({
            ...prev,
            longitude: r.lng_visual,
            latitude: r.lat_visual,
            zoom: 17,
            pitch: 45,
            transitionDuration: 1200
        }));
        setPopupInfo(r);
    }, []);

    const titleGradient = isLight 
        ? 'linear-gradient(135deg, #1e293b 0%, #4f46e5 100%)' 
        : 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)';

    // RENDER: Pantalla de Login si no hay rol asignado
    if (!userRole) {
        return <LoginScreen onLogin={(role, tkn) => { setUserRole(role); setToken(tkn); }} />;
    }

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', background: isLight ? '#f3f4f6' : '#111827', overflow: 'hidden' }}>
            
            {/* ── ESTILOS DINÁMICOS PARA CENTRAR LA NAVEGACIÓN ABAJO Y EN MEDIO ── */}
            <style>{`
                .mapboxgl-ctrl-bottom-right {
                    right: 50% !important;
                    bottom: 24px !important;
                    transform: translateX(50%) !important;
                    left: auto !important;
                    display: flex !important;
                    flex-direction: row !important;
                    gap: 6px !important;
                }
                .mapboxgl-ctrl-group {
                    display: flex !important;
                    flex-direction: row !important;
                    margin: 0 !important;
                    border: 1px solid ${hudBorder} !important;
                    background: ${hudBg} !important;
                    backdrop-filter: blur(12px) !important;
                    box-shadow: 0 4px 24px rgba(0,0,0,0.15) !important;
                    border-radius: 10px !important;
                    overflow: hidden;
                }
                .mapboxgl-ctrl-group button {
                    background: transparent !important;
                    border: none !important;
                    width: 32px !important;
                    height: 32px !important;
                    cursor: pointer;
                    display: flex !important;
                    align-items: center;
                    justify-content: center;
                }
                .mapboxgl-ctrl-group button span {
                    filter: ${isLight ? 'none' : 'invert(1)'} !important;
                }
                .mapboxgl-ctrl-group button:hover {
                    background: ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)'} !important;
                }
            `}</style>

            {/* TÍTULO CENTRADO */}
            <h1 style={{
                position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
                margin: 0, padding: 0,
                fontFamily: '"Outfit", "Inter", system-ui, sans-serif',
                fontSize: '28px', fontWeight: 900,
                letterSpacing: '-0.03em',
                color: isLight ? '#0f172a' : '#ffffff',
                textShadow: isLight 
                    ? '0 1px 2px rgba(255,255,255,0.8), 0 2px 10px rgba(0,0,0,0.15)' 
                    : '0 2px 12px rgba(0,0,0,0.95)',
                pointerEvents: 'none',
                textTransform: 'uppercase'
            }}>
                Vision Qro
            </h1>

            {/* MAPBOX */}
            <Map
                {...viewState}
                onMove={e => setViewState(e.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle={MAP_THEMES[mapTheme].url}
                mapboxAccessToken={MAPBOX_TOKEN}
                minZoom={9}
                maxZoom={20}
                terrain={mapTheme === 'satellite' ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
            >
                {/* Controles de Navegación (Centrados en bottom-middle gracias a la inyección CSS) */}
                <NavigationControl position="bottom-right" showCompass={true} showZoom={true} />

                {/* Terreno 3D */}
                {mapTheme === 'satellite' && (
                    <Source
                        id="mapbox-dem"
                        type="raster-dem"
                        url="mapbox://mapbox.mapbox-terrain-dem-v1"
                        tileSize={512}
                        maxzoom={14}
                    />
                )}

                {/* Heatmap */}
                {showHeatmap && (
                    <Source id="heatmap-source" type="geojson" data={heatmapGeoJSON}>
                        <Layer {...heatmapLayer} />
                    </Source>
                )}

                {/* Marcadores */}
                {!showHeatmap && reportesFiltrados.map((p, i) => {
                    const ui   = getConfig(p.tipo);
                    const Icon = ui.icon;
                    const esReciente = p.created_at 
                        ? (new Date() - new Date(p.created_at)) < 24 * 60 * 60 * 1000 
                        : false;

                    return (
                        <Marker key={p.id} longitude={p.lng_visual} latitude={p.lat_visual} anchor="bottom">
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {esReciente && (
                                    <motion.div
                                        animate={{ scale: [1, 1.7, 1], opacity: [0.6, 0, 0.6] }}
                                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                        style={{
                                            position: 'absolute',
                                            width: 38,
                                            height: 38,
                                            borderRadius: '50%',
                                            border: `2px dashed ${ui.bg}`,
                                            pointerEvents: 'none',
                                            zIndex: -1
                                        }}
                                    />
                                )}

                                <motion.button
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        seleccionarReporte(p); 
                                    }}
                                    title={ui.label}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: Math.min(i * 0.02, 0.5) }}
                                    whileHover={{ scale: 1.3 }}
                                    whileTap={{ scale: 0.88 }}
                                    style={{
                                        background:   ui.bg,
                                        border:       'none',
                                        borderRadius: '50%',
                                        padding:       8,
                                        cursor:       'pointer',
                                        display:      'flex',
                                        alignItems:   'center',
                                        justifyContent:'center',
                                        boxShadow:    `0 0 0 3px ${ui.bg}44, 0 4px 14px rgba(0,0,0,0.5)`,
                                    }}
                                >
                                    <Icon size={15} color="white" />
                                </motion.button>
                            </div>
                        </Marker>
                    );
                })}

                {/* Popup de detalles del reporte */}
                <AnimatePresence>
                    {popupInfo && !showHeatmap && (
                        <Popup
                            key={popupInfo.id}
                            longitude={popupInfo.lng_visual}
                            latitude={popupInfo.lat_visual}
                            anchor="center"
                            onClose={() => setPopupInfo(null)}
                            closeOnClick={true}
                            closeButton={false}
                            maxWidth="none"
                            style={{ padding: 0, background: 'transparent', border: 'none' }}
                        >
                            <ReportePopup info={popupInfo} onClose={() => setPopupInfo(null)} userRole={userRole} onDelete={eliminarReporte} isLight={isLight} onExpandImage={setExpandedImage} />
                        </Popup>
                    )}
                </AnimatePresence>
            </Map>

            {/* ── HUD PRINCIPAL ── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                    position:       'absolute', top: 16, left: 16, zIndex: 10,
                    background:     hudBg,
                    backdropFilter: 'blur(12px)',
                    borderRadius:    12,
                    padding:        '10px 16px',
                    color:          hudText,
                    fontFamily:     'system-ui, sans-serif',
                    fontSize:        13,
                    display:        'flex',
                    alignItems:     'center',
                    gap:             10,
                    border:         `1px solid ${hudBorder}`,
                    boxShadow:      '0 4px 24px rgba(0,0,0,0.15)',
                    transition:     'background 0.3s, color 0.3s'
                }}
            >
                <span style={{ color: hudMuted, fontWeight: 600 }}>
                    {loading ? 'Cargando…' : `${reportesFiltrados.length} reportes`}
                </span>
                
                {/* Actualizar */}
                <motion.button
                    onClick={cargarReportes}
                    disabled={loading}
                    whileHover={{ scale: 1.15, rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ rotate: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ 
                        background: 'none', border: 'none', cursor: 'pointer', 
                        color: loading ? '#3b82f6' : hudText, 
                        display: 'flex', padding: 0, marginLeft: 5
                    }}
                    title="Actualizar"
                >
                    <RefreshCw size={14} />
                </motion.button>

                <span style={{ opacity: 0.3 }}>|</span>

                {/* Rol de Usuario */}
                <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    color: userRole === 'admin' ? '#f87171' : '#60a5fa',
                    background: userRole === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    padding: '2px 6px', borderRadius: 4, border: `1px solid ${userRole === 'admin' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)'}`
                }}>
                    {userRole === 'admin' ? 'Admin' : 'Invitado'}
                </span>

                {/* Exportar CSV (Admin) */}
                {userRole === 'admin' && (
                    <motion.button
                        onClick={exportarDatos}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        style={{ 
                            background: 'none', border: 'none', cursor: 'pointer', 
                            color: '#10b981', 
                            display: 'flex', padding: 0, marginLeft: 4
                        }}
                        title="Exportar a CSV"
                    >
                        <Download size={14} />
                    </motion.button>
                )}

                {/* Cerrar Sesión */}
                <motion.button
                    onClick={() => {
                        if (window.confirm("¿Seguro que deseas salir del sistema?")) {
                            setUserRole(null);
                            setToken(null);
                            setPopupInfo(null);
                        }
                    }}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    style={{ 
                        background: 'none', border: 'none', cursor: 'pointer', 
                        color: '#ef4444', 
                        display: 'flex', padding: 0, marginLeft: 4
                    }}
                    title="Cerrar Sesión"
                >
                    <LogOut size={14} />
                </motion.button>

                {error && <span style={{ color: '#f87171', fontSize: 11 }}>⚠️ {error}</span>}
            </motion.div>

            {/* ── PANEL LATERAL: IZQUIERDO ── */}
            <motion.div
                initial={{ opacity: 0, x: -300 }}
                animate={{ opacity: 1, x: showSidebar ? 0 : -272 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                style={{
                    position:       'absolute', top: 76, left: 16, bottom: 24, zIndex: 10,
                    background:     hudBg,
                    backdropFilter: 'blur(12px)',
                    borderRadius:    16,
                    padding:        '16px',
                    color:          hudText,
                    fontFamily:     'system-ui, sans-serif',
                    border:         `1px solid ${hudBorder}`,
                    boxShadow:      '0 8px 32px rgba(0,0,0,0.2)',
                    display:        'flex',
                    flexDirection:  'column',
                    gap:             18,
                    width:           240,
                    transition:     'background 0.3s, color 0.3s'
                }}
            >
                {/* Botón de Colapsar Panel Izquierdo */}
                <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    style={{
                        position: 'absolute', right: -28, top: '50%', transform: 'translateY(-50%)',
                        background: hudBg, border: `1px solid ${hudBorder}`,
                        borderLeft: 'none', borderRadius: '0 8px 8px 0',
                        width: 28, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: hudText, cursor: 'pointer', boxShadow: '4px 0 12px rgba(0,0,0,0.1)',
                        transition: 'background 0.3s, color 0.3s'
                    }}
                >
                    {showSidebar ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>

                {/* Sección 1: Estadísticas Rápidas */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: hudMuted, textTransform: 'uppercase', marginBottom: 12 }}>
                        <BarChart3 size={14} /> Distribución
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Inorgánicos */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                <span style={{ fontWeight: 600 }}>Inorgánicos</span>
                                <span>{stats.inorg.count} ({stats.inorg.pct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ background: '#3b82f6', width: `${stats.inorg.pct}%`, height: '100%' }} />
                            </div>
                        </div>

                        {/* Orgánicos */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                <span style={{ fontWeight: 600 }}>Orgánicos</span>
                                <span>{stats.org.count} ({stats.org.pct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ background: '#22c55e', width: `${stats.org.pct}%`, height: '100%' }} />
                            </div>
                        </div>

                        {/* Baches */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                                <span style={{ fontWeight: 600 }}>Baches</span>
                                <span>{stats.baches.count} ({stats.baches.pct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ background: '#ef4444', width: `${stats.baches.pct}%`, height: '100%' }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }} />

                {/* Sección 2: Feed Reciente */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: hudMuted, textTransform: 'uppercase', marginBottom: 10 }}>
                        Actividad Reciente
                    </div>
                    
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, flex: 1, paddingRight: 4 }}>
                        {ultimosReportes.length === 0 ? (
                            <div style={{ fontSize: 11, color: hudMuted, textAlign: 'center', marginTop: 20 }}>
                                Sin reportes para mostrar
                            </div>
                        ) : (
                            ultimosReportes.map(r => {
                                const ui = getConfig(r.tipo);
                                const Icon = ui.icon;
                                return (
                                    <button
                                        key={r.id}
                                        onClick={() => seleccionarReporte(r)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px',
                                            borderRadius: 8, border: 'none', background: 'transparent',
                                            cursor: 'pointer', textAlign: 'left', width: '100%',
                                            transition: 'background 0.2s',
                                            color: hudText
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            background: ui.bg, borderRadius: '50%', padding: 5,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <Icon size={12} color="white" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {ui.label}
                                            </div>
                                            <div style={{ fontSize: 9, color: hudMuted }}>
                                                ID: {r.id}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── PANEL LATERAL: DERECHO ── */}
            <motion.div
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: showRightSidebar ? 0 : 252 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                style={{
                    position:       'absolute', top: 76, right: 16, zIndex: 10,
                    background:     hudBg,
                    backdropFilter: 'blur(12px)',
                    borderRadius:    16,
                    padding:        '14px',
                    color:          hudText,
                    fontFamily:     'system-ui, sans-serif',
                    border:         `1px solid ${hudBorder}`,
                    boxShadow:      '0 8px 32px rgba(0,0,0,0.2)',
                    display:        'flex',
                    flexDirection:  'column',
                    gap:             16,
                    width:           220,
                    transition:     'background 0.3s, color 0.3s'
                }}
            >
                {/* Botón de Colapsar Panel Derecho */}
                <button
                    onClick={() => setShowRightSidebar(!showRightSidebar)}
                    style={{
                        position: 'absolute', left: -28, top: '50%', transform: 'translateY(-50%)',
                        background: hudBg, border: `1px solid ${hudBorder}`,
                        borderRight: 'none', borderRadius: '8px 0 0 8px',
                        width: 28, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: hudText, cursor: 'pointer', boxShadow: '-4px 0 12px rgba(0,0,0,0.1)',
                        transition: 'background 0.3s, color 0.3s'
                    }}
                >
                    {showRightSidebar ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>

                {/* Título */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: hudMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Layers size={14} /> Panel Analítico
                    </div>
                </div>

                {/* Temas */}
                <div style={{ display: 'flex', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
                    {Object.values(MAP_THEMES).map(theme => {
                        const isSelected = mapTheme === theme.id;
                        const ThemeIcon = theme.icon;
                        return (
                            <button
                                key={theme.id}
                                onClick={() => handleThemeChange(theme.id)}
                                title={theme.label}
                                style={{
                                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isSelected ? (isLight ? 'white' : 'rgba(255,255,255,0.15)') : 'transparent',
                                    color: isSelected ? (isLight ? '#3b82f6' : 'white') : hudMuted,
                                    boxShadow: isSelected && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <ThemeIcon size={14} />
                            </button>
                        );
                    })}
                </div>

                {/* Modo de Visualización */}
                <div style={{ display: 'flex', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
                    <button
                        onClick={() => setShowHeatmap(false)}
                        style={{
                            flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            background: !showHeatmap ? (isLight ? 'white' : 'rgba(255,255,255,0.15)') : 'transparent',
                            color: !showHeatmap ? (isLight ? '#1f2937' : 'white') : hudMuted,
                            boxShadow: !showHeatmap && isLight ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        <MapPin size={14} /> Puntos
                    </button>
                    <button
                        onClick={() => { setShowHeatmap(true); setPopupInfo(null); }}
                        style={{
                            flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            background: showHeatmap ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                            color: showHeatmap ? '#ef4444' : hudMuted,
                            transition: 'all 0.2s'
                        }}
                    >
                        <Activity size={14} /> Heatmap
                    </button>
                </div>

                <div style={{ height: 1, background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }} />

                {/* Filtros */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingLeft: 4 }}>
                        <span style={{ fontSize: 11, color: hudMuted, textTransform: 'uppercase', fontWeight: 600 }}>Categorías</span>
                        <button 
                            onClick={toggleAllFilters}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 11, cursor: 'pointer', padding: 0 }}
                        >
                            {activeFilters.size === FILTROS.length ? 'Desmarcar todo' : 'Marcar todo'}
                        </button>
                    </div>

                    {FILTROS.map(f => {
                        const isActive = activeFilters.has(f.id);
                        const Icon = f.icon;
                        return (
                            <button
                                key={f.id}
                                onClick={() => toggleFilter(f.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    background: isActive ? `${f.color}15` : 'transparent',
                                    transition: 'all 0.2s',
                                    textAlign: 'left'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Icon size={14} color={isActive ? f.color : hudMuted} />
                                    <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? hudText : hudMuted }}>
                                        {f.label}
                                    </span>
                                </div>
                                <div>
                                    {isActive ? (
                                        <CheckSquare size={14} color={f.color} />
                                    ) : (
                                        <Square size={14} color={hudMuted} />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Modal de Imagen Expandida */}
            <AnimatePresence>
                {expandedImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setExpandedImage(null)}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 99999,
                            backgroundColor: 'rgba(0,0,0,0.85)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(10px)', cursor: 'pointer'
                        }}
                    >
                        <motion.img
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            src={expandedImage}
                            alt="Reporte ampliado"
                            style={{
                                width: '90vw',
                                height: '85vh',
                                borderRadius: 16,
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                                objectFit: 'contain'
                            }}
                        />
                        <button
                            onClick={() => setExpandedImage(null)}
                            style={{
                                position: 'absolute', top: 24, right: 24,
                                background: 'rgba(255,255,255,0.1)',
                                backdropFilter: 'blur(4px)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '50%', width: 40, height: 40,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                        >
                            <X size={20} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}