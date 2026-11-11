import { useState } from 'react';
import { API_BASE_URL } from '../../config';
import './login.css';

/**
 * Inicio de sesión. Dos modos:
 *  - Invitado: solo lectura, sin credenciales.
 *  - Administrador: contraseña (el servidor no usa "usuario", así que no se pide).
 * El logo se muestra completo y los controles van debajo (o al lado en pantallas bajas): nunca se encima uno sobre otro.
 */
export default function LoginScreen({ onLogin }) {
    const [modo, setModo] = useState('guest'); // 'guest' | 'admin'
    const [password, setPassword] = useState('');
    const [verPassword, setVerPassword] = useState(false);
    const [error, setError] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cambiarModo = (m) => { setModo(m); setError(''); };

    const enviar = async (e) => {
        e.preventDefault();
        setError('');
        if (modo === 'guest') { onLogin('guest', null); return; }
        setEnviando(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/v1/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            if (res.status === 429) {
                const info = await res.json().catch(() => ({}));
                throw new Error(info.detail || 'Demasiados intentos. Espera unos minutos.');
            }
            if (!res.ok) throw new Error('Contraseña incorrecta');
            const data = await res.json();
            onLogin('admin', data.token);
        } catch (err) {
            setError(err.message === 'Failed to fetch' ? 'No se pudo conectar con el servidor' : err.message);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <main className="login">
            <div className="login__stage">
                <img
                    className="login__logo"
                    src="/logo-1024.jpg"
                    srcSet="/logo.png 512w, /logo-1024.jpg 1024w"
                    sizes="(max-width: 640px) 88vw, 560px"
                    alt="Vision Qro, by Maxei Studios"
                />
            </div>

            <section className="login__panel" aria-labelledby="login-titulo">
                <h1 id="login-titulo" className="sr-only">Acceso a Vision Qro</h1>
                <p className="login__tagline">Mapa ciudadano de baches y basura en Querétaro</p>

                <div className="login__tabs" role="tablist" aria-label="Tipo de acceso">
                    <button type="button" role="tab" className="login__tab" aria-selected={modo === 'guest'} onClick={() => cambiarModo('guest')}>
                        Invitado
                    </button>
                    <button type="button" role="tab" className="login__tab" aria-selected={modo === 'admin'} onClick={() => cambiarModo('admin')}>
                        Administrador
                    </button>
                </div>

                <form className="login__form" onSubmit={enviar}>
                    {modo === 'guest' ? (
                        <p className="login__note">Acceso de solo lectura al mapa de reportes.</p>
                    ) : (
                        <div className="login__field">
                            <label className="login__label" htmlFor="login-password">Contraseña</label>
                            <div className="login__input-wrap">
                                <input
                                    id="login-password"
                                    className="login__input"
                                    type={verPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    autoFocus
                                />
                                <button type="button" className="login__reveal" onClick={() => setVerPassword(v => !v)} aria-pressed={verPassword}>
                                    {verPassword ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                        </div>
                    )}

                    {error && <p className="login__error" role="alert">{error}</p>}

                    <button type="submit" className="login__submit" disabled={enviando}>
                        {modo === 'admin' ? (enviando ? 'Verificando…' : 'Iniciar sesión') : 'Entrar al mapa'}
                    </button>
                </form>

                <p className="login__foot"><a href="/privacidad.html">Política de privacidad</a></p>
            </section>
        </main>
    );
}
