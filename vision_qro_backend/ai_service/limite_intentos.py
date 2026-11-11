"""Límite de intentos fallidos de inicio de sesión (sin dependencias, se prueba aislado).

Protege la contraseña de administrador contra adivinanzas repetidas:
 - por cliente (IP): tras MAX_POR_CLIENTE fallos dentro de la ventana, se bloquea ese cliente;
 - global: si hay demasiados fallos en total (alguien rotando IPs), se bloquea el inicio de sesión para todos
   durante la ventana. Es un freno deliberado: el administrador espera unos minutos.
Un inicio de sesión correcto borra los fallos de ese cliente.
"""


class LimiteIntentos:
    def __init__(self, max_por_cliente=5, max_global=30, ventana_s=300):
        self.max_por_cliente = max_por_cliente
        self.max_global = max_global
        self.ventana_s = ventana_s
        self._fallos = {}      # cliente -> [timestamps]
        self._global = []      # [timestamps]

    def _purgar(self, ahora):
        corte = ahora - self.ventana_s
        self._global = [t for t in self._global if t > corte]
        for k in list(self._fallos):
            v = [t for t in self._fallos[k] if t > corte]
            if v:
                self._fallos[k] = v
            else:
                del self._fallos[k]

    def segundos_de_espera(self, cliente, ahora):
        """0 si puede intentar; si no, segundos hasta que se libere."""
        self._purgar(ahora)
        esperas = []
        propios = self._fallos.get(cliente, [])
        if len(propios) >= self.max_por_cliente:
            esperas.append(propios[-self.max_por_cliente] + self.ventana_s - ahora)
        if len(self._global) >= self.max_global:
            esperas.append(self._global[-self.max_global] + self.ventana_s - ahora)
        return int(max(esperas)) + 1 if esperas else 0

    def registrar_fallo(self, cliente, ahora):
        self._fallos.setdefault(cliente, []).append(ahora)
        self._global.append(ahora)

    def registrar_exito(self, cliente):
        self._fallos.pop(cliente, None)
