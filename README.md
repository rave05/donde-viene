# ¿Dónde Viene?

Aplicación web estática de transporte para Montevideo. El mapa y el motor existentes permanecen en `index.html` y `recorridos.js`. Las funciones nuevas se conectan mediante un contrato pequeño y eventos, sin sustituir la búsqueda ni el seguimiento GPS.

## Dónde editar cada función

| Archivo | Responsabilidad |
|---|---|
| `app-util.js` | Validación, coordenadas, fechas, almacenamiento y supuestos configurables. |
| `viajes-habituales.js` | Guardar, editar y eliminar recetas de búsqueda en el navegador. |
| `planificador.js` | Salidas de ahora o de los próximos siete días, en hora de Montevideo. |
| `compartir-viaje.js` | Enlaces con origen, destino, preferencia y fecha opcional. No comparte el GPS. |
| `caminatas.js` | Solicitudes al worker, caché de pares y alternativa en línea recta. |
| `caminatas-worker.js` | Proyección a segmentos y cálculo A* sobre la red peatonal local. |
| `estimacion-viaje.js` | Compara caminata, espera programada y recorrido orientativo. |
| `ultimo-viaje.js` | Guarda una copia de instrucciones y geometría, sin ETAs ni vehículos. |
| `sw.js` | Apertura sin conexión de la interfaz y datos estáticos. No cachea la API. |
| `recargas-stm.js` | Catálogo oficial de locales de recarga, distancias y marcadores. |
| `patrocinios-locales.js` | Campañas por proximidad al destino, explícitamente identificadas como publicidad. |
| `extras-viaje.js` | Coordinación mediante eventos y actualización de la copia guardada. |
| `extras.css` | Estilos de las funciones nuevas; evita reglas globales sobre botones o campos. |

## Contrato de integración

`window.DondeVieneApp` expone lectura/aplicación de una búsqueda, búsqueda, dibujo de caminatas, puntos de recarga y restauración de una copia. Los módulos no acceden a variables privadas del motor.

Eventos:

- `donde-viene:viaje-cambio`: invalida el viaje anterior y detiene el GPS.
- `donde-viene:viaje-elegido`: entrega `{candidato, contexto}`.
- `donde-viene:mapa-viaje-listo`: permite dibujar caminatas y guardar la geometría después del dibujo asíncrono original.
- `donde-viene:viaje-restaurado`: muestra una copia sin consultas de llegadas.

El contexto conserva los puntos resueltos y la fecha elegida. Los resultados asíncronos se descartan si la selección ya cambió.

## Datos y mantenimiento

Instalar herramientas de mantenimiento: `python3 -m pip install pyproj osmium`.

- `python3 scripts/actualizar-datos.py recargas`: descarga el CSV oficial, convierte UTM 21 Sur a WGS84 y genera `datos/recargas-stm.json`.
- `python3 scripts/actualizar-datos.py caminatas`: descarga un extracto de Uruguay de Geofabrik y conserva la red caminable del área definida en el script. El extracto temporal se guarda fuera del repositorio.

Los datos de recarga pertenecen a la Intendencia de Montevideo y se ofrecen bajo la Licencia de Datos Abiertos de Uruguay. Fuente: https://ckan.montevideo.gub.uy/dataset/locales-de-recarga-del-stm.

La red de caminatas deriva de **© OpenStreetMap contributors**, distribuida bajo **ODbL 1.0**. Fuente del extracto: https://download.geofabrik.de/south-america/uruguay.html. El archivo derivado `datos/caminatas.json.gz` conserva esa licencia: https://opendatacommons.org/licenses/odbl/1-0/. La interfaz muestra atribución y enlaza a OpenStreetMap.

No hay consultas de caminatas a un servidor público de demostración ni claves nuevas. La red comprimida se descarga al buscar y se calcula en un worker. Se respetan restricciones de acceso de los datos; se omiten segmentos con sentido peatonal restringido. Accesos a edificios, cruces, obras y restricciones nuevas pueden no estar reflejados. Si no hay una conexión verificable, el tramo se identifica como línea recta.

## Tiempos y planificación

En `DV.config` se editan velocidad de caminata, velocidad orientativa de bus y margen del rango mostrado. La espera se toma de la próxima salida programada del sentido elegido después de la caminata. El recorrido se estima usando la geometría del bus y una velocidad supuesta, **no el tránsito actual ni una ETA en vivo**. Las combinaciones incluyen la espera del segundo bus. Sin horario o geometría suficiente no se inventa un tiempo total.

El cálculo tiene un límite global de 25 segundos y analiza un máximo de 24 candidatos, con tres tareas concurrentes y cachés; la interfaz conserva el resto de las rutas sin tiempo confirmado. Los horarios de salidas futuras no consultan buses en vivo de ahora. La planificación usa el calendario y excepciones GTFS disponibles; fuera de su vigencia no se promete servicio.

## Sin conexión y privacidad

Primero se debe abrir la app con conexión y elegir un viaje. El service worker prepara la interfaz; las instrucciones del último viaje se guardan automáticamente en ese navegador. Sin conexión se ofrece la copia guardada, nunca una llegada en vivo. Las teselas del mapa no se descargan masivamente ni se garantiza su disponibilidad sin conexión.

Recetas y copia se guardan en `localStorage`; no se envían a un servidor ni se instalan analíticas. Un enlace compartido incluye nombres/direcciones que el usuario eligió compartir, no su GPS. El GPS del modo viaje sigue requiriendo permiso y la app abierta.

## Patrocinios

`datos/patrocinios.json` comienza vacío. Para añadir una campaña real:

```json
{
  "activo": true,
  "nombre": "Nombre del comercio",
  "texto": "Descripción de la campaña",
  "lat": -34.9,
  "lon": -56.2,
  "radioMetros": 1000,
  "url": "https://sitio-del-comercio.example",
  "desde": "2026-10-08T00:00:00-03:00",
  "hasta": "2026-11-08T23:59:59-03:00"
}
```

Agregar el objeto dentro de la lista. Solo se aceptan enlaces HTTPS, campañas activas dentro de su fecha y hasta dos coincidencias. No hay campañas inventadas ni anuncios activados sin datos del comercio.

## Verificación y publicación

`mapa-puntos.js` agrega selección por toque con vista previa, confirmación y cancelación. Usa un contrato pequeño del mapa, libera el listener al terminar y guarda el punto como texto `Punto en el mapa (lat, lon)` con seis decimales. El geocodificador lo resuelve localmente: funciona al compartir, actualizar y guardar un recorrido. Los límites son los mismos del catálogo local de Montevideo. No inicia una búsqueda ni solicita GPS al elegir un punto.

`actualizar-opciones.js` muestra la hora de la última comparación en Montevideo y permite repetirla manualmente con el mismo origen, destino, preferencia y fecha. Reutiliza el buscador, bloquea clics simultáneos y no consulta automáticamente mientras el usuario compara opciones.

El orden predeterminado es `proximos` (Bus más próximo). La primera subida se compara por llegada estimada de la variante exacta, cuando alcanza el tiempo de caminar hasta la parada, y por horario programado como respaldo. La salida se conserva incluso si falta geometría o excede el límite de 90 minutos de la estimación total. Sin datos, la opción va después de las salidas conocidas. Las variantes siguen agrupadas y ordenadas internamente.

`proximos-viaje.js` agrupa consultas por parada/variante, realiza hasta 24 con tres tareas y ocho segundos de límite global, y se detiene ante un 429. Las búsquedas para otra fecha no consultan buses actuales. No calcula ETAs a partir de distancias y no activa seguimiento. El orden corresponde a la consulta; al elegir una variante se actualizan sus llegadas. `ultimo-viaje.js` elimina la próxima salida al guardar instrucciones offline.

`bienvenida.js` y `bienvenida.css` controlan la ayuda de primer uso. Se muestra inicialmente y recuerda el cierre en este navegador; el resumen permite abrirla otra vez. No solicita permisos ni modifica búsquedas.

Pendiente: probar un viaje real en iPhone/Safari, comprobando seguimiento del mapa, transbordos y aviso de bajada con GPS. Hasta entonces, esa verificación sigue cubierta solo por pruebas simuladas.

`npm ci && npm test` verifica red peatonal, calendario, estimaciones, clasificación y límites. Revisar también viajes directos/combinados, sugerencias por toque, guía GPS y permisos en Safari antes de promover una versión a un público amplio.

Al cambiar archivos del shell, incrementar `CACHE` en `sw.js` y las versiones de scripts/CSS de `index.html` en el mismo despliegue. Si se agrega un módulo, incorporarlo a `CORE`. Publicación: GitHub Pages del repositorio.

## Distribución del mapa

`mapa-layout.js` mueve los nodos existentes, preservando sus listeners: buscador, mapa, resumen y guardados en móvil; columna de búsqueda/resultados junto al mapa en escritorio (1000 px). Preferencias, planificación y compartir quedan en Más opciones. El mapa ocupa 40 svh en móvil y se puede ampliar; invalidateSize mantiene Leaflet al cambiar de tamaño. El seguimiento GPS conserva sus estilos existentes.

Validación automatizada: npm test cubre las funciones existentes tras reorganizar la interfaz, así como Más opciones plegado y ampliar/reducir el mapa. Verificación visual en la página publicada; la prueba de GPS en un viaje real en iPhone/Safari continúa pendiente.

`mapa-gadgets.js` y `mapa-gadgets.css` reúnen origen (A), destino (B) y ampliar/reducir en botones flotantes de 44 px dentro del mapa. Conservan los listeners originales y etiquetas accesibles. La ayuda y confirmar/cancelar aparecen al seleccionar un punto; el mensaje final se oculta a los cinco segundos. La capa permite gestos del mapa fuera de los botones y oculta temporalmente la leyenda mientras muestra ayuda.

El botón flotante 💳 reutiliza la búsqueda de recargas STM: muestra u oculta hasta ocho locales a 5 km del punto de referencia (destino del viaje, ubicación o centro del mapa). Comparte estado con los controles de la sección de recargas. El mapa muestra carga, resultado o error temporalmente; los marcadores conservan nombre, dirección y horario. No solicita GPS ni inicia una búsqueda de transporte. Las pruebas cubren ambos accesos, ocultar, error y reintento.

`mapa-ubicacion.js` agrega centrar en mi ubicación debajo del zoom. Pide una posición puntual solo al tocarlo; acepta hasta 150 m de precisión y 30 segundos de antigüedad. Conserva los campos, la ruta y la búsqueda. Durante un viaje reutiliza Volver a seguirme y no abre otro seguimiento GPS. Si hay una selección de punto activa, espera confirmación o cancelación. La integración centrarUbicacionMapa reutiliza el marcador del usuario.

## Identidad y panel del viaje

redisenio.css concentra colores, tipografía, tarjeta de salida y respuestas breves al toque; respeta reducir movimiento. redisenio.js conserva los nodos y listeners: en móvil el resumen está dentro de la columna del mapa, plegado al elegir viaje, y se abre por toque, teclado o arrastre del tirador. En escritorio permanece abierto en la columna de resultados. La tarjeta de salida en viaje.js usa la fecha ya calculada y distingue estimación de horario; no crea consultas ni una cuenta regresiva. Los datos offline sin salida no muestran tarjeta.
