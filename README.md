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

El cálculo tiene un límite global de 12 segundos para estimaciones y 6 segundos para próximas salidas y analiza un máximo de 24 candidatos, con tres tareas concurrentes y cachés; la interfaz conserva el resto de las rutas sin tiempo confirmado. Los horarios de salidas futuras no consultan buses en vivo de ahora. La planificación usa el calendario y excepciones GTFS disponibles; fuera de su vigencia no se promete servicio.

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

buses-mapa-vista.js controla solo la cámara de los buses: encuadra una vez por selección de parada/variante. Al tocar un marcador, sigue su identificador de coche y empresa usando panTo, que conserva el zoom manual. Los refrescos sin coche seleccionado conservan también la cámara; si un coche no aparece en la consulta no sigue a otro. Cambiar de selección reinicia el encuadre y el vehículo elegido. La guía GPS mantiene prioridad.

## Buses GPS sin ETA

buses-sentido.js reemplaza la comparación radial por proyección y avance sobre los patrones de la línea que contienen la parada y coinciden exactamente con el destino del sentido. Requiere dos muestras frescas del mismo coche/empresa, ubicado antes de la parada y avanzando sobre la ruta. Omite posiciones fuera del recorrido, ramas ambiguas, saltos incompatibles y datos antiguos o cacheados. Sin geometría o avance confirmado muestra el horario programado disponible, sin fabricar ETA. Las llegadas oficiales siguen usando el endpoint de próximas llegadas. La fixture tests/fixtures/127-aduana.json proviene de recorridos/127.json del repositorio y cubre el coche ya pasado.

## Beta pública

`beta.js` y `beta.css` ofrecen un aviso compacto y reportes voluntarios por correo, con contexto textual editable y sin coordenadas GPS. El proceso y las verificaciones pendientes en la calle están en `BETA.md`.

## Rendimiento y actualización

Los módulos de horarios y recorridos comparten las descargas en curso y permiten reintentar los fallos. El service worker reutiliza estos JSON dentro de su versión de caché; al publicar datos estáticos nuevos debe cambiarse la versión de `sw.js`. La API en vivo sigue fuera de esa caché.

`actualizacion-buses.js` usa 20 s como intervalo normal entre consultas completadas; el tiempo de red se suma. En segundo plano se detiene el seguimiento de buses; al volver respeta el tiempo mínimo pendiente. Los errores duplican la espera hasta 120 s; HTTP 429 exige al menos 60 s y respeta `Retry-After` si pide más. Una respuesta satisfactoria restablece el ritmo normal.

La comparación conserva todas las rutas candidatas. La estimación adicional tiene un presupuesto de 12 s y las consultas de próximas salidas de 6 s. Si falta información se etiqueta como sin confirmar; esos límites no representan un tiempo total garantizado para una búsqueda.

## Antes de subir

`abordaje.js` y `abordaje.css` agregan una tarjeta compacta al viaje elegido. Compara la caminata por calles desde el origen consultado (velocidad de `DV.config.velocidadCaminata`) con una llegada estimada en vivo de hasta 90 s de antigüedad. Un margen menor de 2 min se marca como justo; un margen negativo aconseja considerar el siguiente. No usa horarios programados, copias guardadas ni distancias en línea recta para recomendar que el usuario alcanza el bus. No agrega peticiones de red: escucha las llegadas de la parada/variante seleccionada y actualiza el cálculo local cada 10 s.

El desplegable identifica la parada por calle/ID y el cartel de destino esperado, permite centrar la parada en el mapa y muestra la segunda línea si hay combinación. No infiere vereda ni lado de la calle. Al iniciar el modo viaje se oculta la orientación de primera subida.

## Reconsultar si el bus no llegó

`alternativas-ahora.js` agrega una acción al viaje elegido para buscar de nuevo desde el origen elegido o desde una ubicación GPS reciente (hasta 30 s, precisión hasta 150 m). Se conserva el destino y la preferencia, y se cambia la salida planificada a ahora explícitamente. No afirma que el servicio haya sido cancelado. Cancelación, falta de permiso, ubicación imprecisa/antigua o desconexión conservan el viaje previo. Impide acciones simultáneas y aplica 30 s entre reconsultas iniciadas. En el modo viaje se oculta esta acción de la primera subida.

## Integraciones de direcciones e información (octubre de 2026)

- Cruces de calles: 19.264 puntos oficiales y 5.086 nombres de calles de Montevideo, descargados el 09/10/2026. `datos/direcciones/cruces-indice.json` y 32 fragmentos JSON se cargan solo al buscar una esquina. Se admite `y`, `esq.`, `esquina`, `con`, `&` y `/`, el orden inverso y abreviaturas de vía/títulos. Si hay varios puntos o calles coincidentes se debe elegir una sugerencia; no se calculan cruces inexistentes. Fuente: https://catalogodatos.gub.uy/dataset/cruces-de-calle-de-montevideo, licencia DAG Uruguay. Regenerar con `python3 scripts/actualizar-integraciones.py cruces`; `--archivo` permite usar el ZIP oficial ya descargado. Números de puerta: se acepta `nº`, `nro`, `número`, `#` y el sufijo `, Montevideo`.

- `direcciones.js` y `datos/direcciones/`: 377.913 accesos oficiales, un índice de 4.462 nombres de calle y 64 fragmentos gzip. El índice se carga al escribir calle y número; solo se descargan fragmentos necesarios. No se interpola una puerta inexistente. Ante varios accesos se requiere seleccionar una sugerencia; las selecciones se pueden resolver nuevamente tras recargar. Fuente: https://ckan.montevideo.gub.uy/dataset/direcciones-oficiales-de-montevideo, licencia DAG Uruguay, descarga 09/10/2026. Safari sin DecompressionStream conserva la búsqueda externa, sin sugerencias oficiales comprimidas.
- `planificador.js`: límite opcional de llegada desde la salida elegida. Filtra solo candidatos con datos completos y cuya llegada, usando el extremo superior del rango, cabe en el límite. No busca la última salida posible, no garantiza puntualidad y no ofrece como confirmado un viaje sin estimación. El cálculo continúa limitado a los candidatos estimados por el motor. Los enlaces y la actualización manual conservan el límite; buscar alternativas ahora lo limpia.
- `comparar-viajes.js`: comparación de dos variantes de la misma consulta, dentro del selector. Reutiliza resultados sin solicitudes nuevas.
- `beta.js`: categorías en los correos, texto editable y recibo de servidor solo cuando exista un servicio configurado. No hay envío automático.
- `informacion-oficial.js`: avisos con inicio, fin, línea, sentido y fuente. La selección no es exhaustiva ni automática. Los avisos vencen solos, pero una prórroga requiere actualizar la fuente revisada. El catálogo oficial de 77 lugares accesibles contiene registros históricos con su fecha, no certificados de paradas, buses ni rutas. No hay fuente verificada para todos los refugios de paradas. El pronóstico se consulta en INUMET mediante enlace; no hay temperaturas inventadas ni uso comercial de una API gratuita restringida.
- `servicios.js`, `notificaciones.js` y `worker/`: integración auxiliar preparada para reportes D1, Web Push, recordatorios y caché compartida. **Todavía no desplegada en Cloudflare**: ver `worker/README.md`. `datos/servicios.json` conserva `url: null` hasta verificar el servicio real. No se reemplazó el Worker de transporte cuyo código no está en este repositorio.

Para regenerar direcciones y lugares accesibles: `python3 -m pip install pyshp pyproj`, luego `python3 scripts/actualizar-integraciones.py direcciones` o `accesibilidad`. Las direcciones se leen de SHP UTM 21S y se convierten a WGS84. No se conservan padrones, teléfonos ni correos del catálogo.
