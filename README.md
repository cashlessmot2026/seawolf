# Seawolf SAI · Reservas (PWA)

Clon en React del sitio de Seawolf SAI con reservas de **habitaciones**, **embarcaciones** y **vehículos**, QR único por reserva, validador para trabajadores y dashboard de administración con analítica. Backend en Supabase.

## Rutas

| Ruta | Para quién | Qué hace |
|---|---|---|
| `#/inicio`, `#/nosotros`, `#/experiencias`, `#/alojamientos` | Clientes | Sitio público con sliders y botón "Reservar" en cada servicio |
| `#/mi-reserva` | Clientes | Consultar estado del QR con el código |
| `#/staff` | Trabajadores | Escanear QR (cámara o foto) o escribir el código; registrar ingreso si está activo |
| `#/admin` | Administrador | Oculto. Contraseña inicial `1234` (se cambia en Ajustes) |

## Flujo del QR

1. El cliente reserva → se crea un código `SW-XXXXXXXXXX` y su QR en estado **pendiente**.
2. El cliente paga por WhatsApp → el admin pulsa **Activar QR**.
3. El trabajador escanea → ve **QR ACTIVO** y pulsa **Registrar ingreso** (queda **usado**).

El dashboard consulta reservas cada 8 s y lanza una alerta (sonido, aviso en pantalla, contador en pestaña y notificación del sistema si se permite) cuando entra una nueva.

## Base de datos

`supabase/schema.sql` crea las tablas `sw_catalogo`, `sw_reservas`, `sw_config` y las funciones `sw_*`. Las reservas no se pueden leer directamente con la anon key: todo pasa por funciones, y las de admin verifican la contraseña (guardada con bcrypt) en el servidor. El precio total y la disponibilidad se calculan en el servidor para evitar sobreventa.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173/seawolf/
npm run build
```

Variables opcionales: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_BASE` (por defecto `/seawolf/`).

Cada push a `main` despliega en GitHub Pages con `.github/workflows/deploy.yml`.
