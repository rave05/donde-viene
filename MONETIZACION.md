# Solicitud de Google AdSense

Preparación publicada: guía original de uso, acerca/contacto, privacidad y enlaces desde la app. No hay etiquetas de anuncios, identificadores ficticios ni anuncios activos. La aprobación depende de Google; estas páginas no garantizan aceptación.

## Bloqueo actual: dirección principal

El 10/10/2026, `https://rave05.github.io/` devuelve 404; la app funciona en `/donde-viene/`. AdSense registra sitios por dominio, no por una ruta. Google admite subdominios de plataformas de la Public Suffix List, donde figura `github.io`. Probar el dominio `rave05.github.io` en la cuenta y publicar una portada en su raíz.

El directorio `adsense-raiz` contiene una portada lista para copiar al repositorio de usuario `rave05/rave05.github.io`, que no existe según la consulta de GitHub del 10/10/2026. No cambiar la ruta de la app ni sus servicios: la portada enlaza la app existente. Crear ese repositorio público, copiar `adsense-raiz/index.html` a su raíz y habilitar GitHub Pages en main. El conector disponible permite modificar repositorios existentes, pero no crear uno ni configurar Pages.

## Verificación y revisión

1. Abrir https://adsense.google.com/start/ con la cuenta del propietario. Completar los datos personales, país y pagos allí, sin enviarlos al chat.
2. Añadir el sitio `rave05.github.io` (sin `/donde-viene/`). Si la interfaz rechaza ese dominio, revisar su mensaje antes de migrar o comprar uno.
3. Elegir verificación por metaetiqueta y copiar la etiqueta exacta que entrega Google. Incorporarla en el head de la portada y de las páginas de DondeViene. Esta opción verifica propiedad sin cargar el script de anuncios. No inventar el ID del editor.
4. Publicar, verificar propiedad y solicitar revisión. No se activa la monetización hasta que el estado del sitio sea “Listo”.
5. Con el ID real, publicar ads.txt en `https://rave05.github.io/ads.txt`, en el repositorio de usuario; un archivo dentro de `/donde-viene/` no satisface esa ubicación. Copiar la línea exacta entregada por AdSense.

## Antes de activar anuncios

- Revisar las observaciones de Google y actualizar la divulgación de privacidad al funcionamiento real.
- Configurar los mensajes de consentimiento aplicables en Privacidad y mensajes de AdSense. No sustituir una CMP exigida por un botón casero.
- Proponer primero anuncios manuales en contenido informativo, fuera del mapa, los controles, el seguimiento y las alertas. Evaluar estas ubicaciones conforme a las políticas; no activar Auto ads en toda la app por defecto.
- No enviar GPS, texto de direcciones ni datos de reportes a Google como parámetros de segmentación.
- Mantener libres de publicidad las pantallas de errores, carga, navegación y avisos de bajada.
- No pedir a probadores que hagan clic en anuncios. Separar validación de uso de tráfico publicitario.

Fuentes revisadas:
- https://support.google.com/adsense/answer/12170421
- https://support.google.com/adsense/answer/12169212
- https://support.google.com/adsense/answer/1348695
- https://support.google.com/publisherpolicies/answer/11112688
- https://support.google.com/adsense/answer/7670013
