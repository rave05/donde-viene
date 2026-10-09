# Servicios auxiliares de ¿Dónde Viene?

**Estado: servicio auxiliar desplegado y reportes verificados en D1.** `datos/servicios.json` apunta al servicio real. La recepción push en un dispositivo requiere una suscripción explícita y una prueba de entrega. El correo existente sigue disponible.

La configuración conserva el binding `TRANSPORTE` y habilita `CACHE_PUBLIC_TRANSIT: "true"`: para rutas públicas reconocidas, permite una caché interna aunque la API original use `no-store`. El navegador sigue recibiendo `no-store`. Se excluyen respuestas privadas, cookies y variantes por autorización. Buses y llegadas se conservan solo cinco segundos, líneas por parada cinco minutos y paradas una hora. Sin esa opción se respeta también `no-store` del origen.

## Componentes

- `index.js`: CORS del origen autorizado, capacidades, reportes con recibo y suscripciones.
- `transport-cache.js`: decorador del manejador existente; 5 segundos para buses/llegadas, 5 minutos para líneas por parada y 1 hora para paradas. Comparte solicitudes simultáneas dentro de un isolate; la caché edge se comparte dentro del centro de datos. No es una cola mundial ni garantiza exclusión entre isolates. Respeta `no-store`/`private`, cookies y autorización; nunca cachea errores, GPS, geocodificación ni rutas no reconocidas. Devuelve `Age` y `X-DV-Observed-At` y mantiene `no-store` hacia el navegador.
- `push.js`: Web Push cifrado, avisos seleccionados por línea y recordatorios de días/hora de Montevideo. La persona confirma el sentido al abrir la app. No promete avisos de llegada basados en GPS en segundo plano.
- `validacion.js`: tamaño máximo, listas de proveedores push, líneas y horarios.
- `schema.sql`: base D1 privada; reportes y registros de envío se eliminan tras 30 días; suscripciones sin actualizar se eliminan tras 180 días.

No se publica una consola administrativa. `GET /admin/reports` exige `Authorization: Bearer ADMIN_TOKEN`. Los reportes del servicio quedan en D1, no se reenvían automáticamente a Gmail. El usuario puede seguir enviándolos con el botón de correo.

## Activación con acceso a Cloudflare

1. Con Node.js 22.13 o posterior: `npm ci` en esta carpeta. Crear una base `wrangler d1 create donde-viene-servicios`; agregar a `wrangler.jsonc` un `d1_databases` con `binding: DB`, `database_name` e ID devuelto. Aplicar `wrangler d1 execute donde-viene-servicios --remote --file schema.sql`.
2. Revisar el namespace `1001` del límite para evitar compartirlo accidentalmente con otros Workers. El límite de 60 consultas por minuto es por IP y centro de datos, no una cuota global. Usuarios detrás de una misma red pueden compartirlo.
3. Generar claves VAPID una sola vez y guardarlas por entrada segura de `wrangler secret put VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `ADMIN_TOKEN`. La clave pública se entrega por `/config`; la privada y el token administrativo nunca van al repositorio ni al cliente.
4. `npm test` y `npm run check`; luego desplegar el Worker **auxiliar**, sin reemplazar `donde-viene-api`. Confirmar `/config`, un reporte de prueba y un envío push real desde una app instalada en el teléfono. D1, crons y Web Push requieren revisar las cuotas del plan antes de activarlos.
5. Solo después de comprobar recepción, editar `datos/servicios.json` con la URL HTTPS real y publicar. Los botones detectan las capacidades del servicio.
6. Para caché de transporte, localizar el código original o agregar un service binding `TRANSPORTE` al Worker actual. Probar rutas, CORS, autenticación y encabezados con el binding en el auxiliar antes de cambiar `API_BASE`. El binding preserva los secretos del original. Si las respuestas originales son privadas/no-store, revisar su política explícitamente: no se fuerza su almacenamiento.

En iPhone el permiso se solicita desde el botón de una app agregada a la pantalla de inicio, con iOS 16.4 o posterior. Se puede desactivar desde la app o los ajustes del dispositivo. Sin servicio no se solicita permiso. Los tokens de cancelación se guardan en el navegador; borrar todos los datos locales puede impedir cancelar la suscripción del servidor desde ese navegador (el permiso sigue siendo revocable en el dispositivo).

## Mantenimiento de avisos

`AVISOS_URL` apunta al JSON de avisos con fuente y fechas revisadas. Es una selección editorial, **no** un feed automático oficial. El cron solo entrega avisos válidos; las fechas de obras pueden cambiar. Hay que revisar la publicación oficial y actualizar el JSON antes de habilitar difusión push al público. No se deducen rutas alteradas a partir del texto ni se cambian paradas automáticamente.

Un envío aceptado por Apple/Google/Mozilla no garantiza que el usuario lo vea inmediatamente. Los fallos se reintentan con pausa; los registros de entrega evitan reenviar un mismo evento y la etiqueta agrupa duplicados si hay un fallo durante la ejecución.

Fuentes técnicas: https://developers.cloudflare.com/workers/runtime-apis/cache/ · https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ · https://github.com/web-push-libs/web-push · https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
