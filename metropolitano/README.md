# Piloto Las Piedras–Montevideo

Fuente: [GTFS metropolitano del MTOP](https://catalogodatos.gub.uy/dataset/ministerio-de-transporte-y-obras-publicas-horarios-de-omnibus-en-lineas-interdepartamentales/resource/9f44b654-751a-42a4-a481-af91b7c9a2e4). Datos abiertos bajo Licencia de DAG de Uruguay. `corredor.json` conserva fecha de publicación y SHA-256 del ZIP original.

El conjunto de 21/09/2026 contiene 21 variantes/patrones, 732 viajes de calendario y 484 paradas del corredor de Las Piedras. No son buses en vivo. Se incluyen solo rutas cuyo nombre oficial identifica Las Piedras y Montevideo; no se ofrece cobertura general de Canelones.

Las sugerencias Las Piedras y San Francisco representan paradas concretas publicadas por MTOP, identificadas con su esquina. Otros puntos se pueden elegir en el mapa.

- El orden de paradas debe ser creciente en un mismo patrón; no se combinan sentidos por número de línea.
- La hora se muestra solo cuando existe en el viaje. Las ausencias se conservan como `null`; no se interpolan tiempos.
- Se respetan calendario, vigencia, excepciones si existen y horas GTFS mayores a 24. La fuente inicial no trae excepciones de feriados.
- Las distancias de acceso son en línea recta, identificadas así. Un margen a 1,25 m/s permite elegir horarios futuros; no garantiza alcanzar el bus por calles.
- Las combinaciones con urbanos se validan por recorrido y caminata de hasta 300 m en el intercambio; los horarios del transbordo quedan sin confirmar. No se afirma cumplimiento de una hora límite de llegada.
- Los identificadores `mtop:` no se envían al servicio urbano. El mapa muestra paradas, no una geometría vial inventada.
- Un extremo dentro del corredor norte activa este piloto; el resto conserva el buscador urbano.

Regeneración: `python scripts/generar_metropolitano.py archivo.zip metropolitano/corredor.json AAAA-MM-DD`. Actualización: `python scripts/actualizar_metropolitano.py`, también ejecutada semanalmente por GitHub Actions sin claves nuevas. Si la descarga falla, se conserva la fuente anterior; los calendarios vencidos dejan de producir opciones vigentes.

Validación: `node tests/metropolitano.cjs` y `npm test`.

Selección: cada opción permite elegir el viaje y volver a la lista. Geometría oficial del KML MTOP vinculada por ID de variante; se recorta entre subida y bajada. Los fragmentos se ordenan por extremos y se rechazan discontinuidades mayores de 200 m. Los tramos urbanos usan las geometrías existentes. No representa GPS en vivo.
