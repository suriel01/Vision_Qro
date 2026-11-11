// Preferencias del usuario (tema, mapa base, vista, animaciones, vibración). Se guardan en este navegador.
import { useCallback, useEffect, useState } from 'react';
import { CAPAS_PREDETERMINADAS } from './components/map/capasMapa';

const CLAVE = 'visionqro.ajustes';
export const PREDETERMINADOS = { tema: 'auto', mapa: 'auto', vista: 'puntos', animaciones: 'normal', vibracion: true, capas: { ...CAPAS_PREDETERMINADAS } };

function leer() {
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE) || '{}');
        return { ...PREDETERMINADOS, ...g, capas: { ...CAPAS_PREDETERMINADAS, ...(g.capas || {}) } };
    } catch {
        return { ...PREDETERMINADOS };
    }
}

const sistemaOscuro = () => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** 'claro' | 'oscuro': lo que realmente se ve, resolviendo "automático" con la preferencia del sistema */
export const temaEfectivo = (a) => (a.tema === 'auto' ? (sistemaOscuro() ? 'oscuro' : 'claro') : a.tema);

/** Mapa base que se muestra: en "automático" sigue al tema de la app */
export const mapaEfectivo = (a) => (a.mapa === 'auto' ? (temaEfectivo(a) === 'oscuro' ? 'noche' : 'calles') : a.mapa);

function aplicar(a) {
    const oscuro = temaEfectivo(a) === 'oscuro';
    const raiz = document.documentElement;
    raiz.dataset.theme = oscuro ? 'dark' : 'light';
    raiz.dataset.motion = a.animaciones;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0d0f13' : '#eceff4');
}

// Se aplica al cargar el módulo, antes del primer render, para que no parpadee el tema equivocado
aplicar(leer());

export function useAjustes() {
    const [ajustes, setAjustes] = useState(leer);

    const cambiar = useCallback((parcial) => {
        setAjustes((previo) => {
            const nuevo = { ...previo, ...parcial };
            try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* sin almacenamiento: el cambio vale solo en esta sesión */ }
            return nuevo;
        });
    }, []);

    const restablecer = useCallback(() => {
        try { localStorage.removeItem(CLAVE); } catch { /* idem */ }
        setAjustes({ ...PREDETERMINADOS, capas: { ...CAPAS_PREDETERMINADAS } });
    }, []);

    useEffect(() => {
        aplicar(ajustes);
        if (ajustes.tema !== 'auto') return undefined;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const alCambiar = () => aplicar(ajustes);
        mq.addEventListener('change', alCambiar);
        return () => mq.removeEventListener('change', alCambiar);
    }, [ajustes]);

    return { ajustes, cambiar, restablecer };
}
