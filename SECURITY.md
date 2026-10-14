# Seguridad de DondeViene

## Actualización del 14 de octubre de 2026

- Los campos externos de transporte se muestran como texto escapado en listas, tarjetas, horarios y popups. El botón de parada usa un listener DOM en lugar de insertar un ID externo en código inline.
- Las altas concurrentes de la misma suscripción solo permiten una inserción. Las actualizaciones verifican el token en la condición de la escritura SQL.
- Los presupuestos diarios de D1/push y el límite de suscripciones activas detienen operaciones al llegar a la capacidad gratuita. Cancelar avisos no consume presupuesto diario. Esto no evita ataques que agoten la cuota total de invocaciones de Workers.
- GitHub Actions comprueba las pruebas del frontend y del Worker. `npm test` en cada carpeta permite ejecutarlas localmente; el Worker requiere Node 22.13 o posterior.

El frontend y el Worker tienen despliegues separados. La versión nueva del Worker devuelve `securityVersion: "20261014-1"` en `/config`; comprobarlo antes de dar por activadas las protecciones del servidor. No se necesita migrar D1 para estos cambios.

## Reportar un problema de seguridad

Contactar a dondevieneadvertisement@gmail.com con una descripción y los pasos mínimos para reproducirlo. No enviar claves privadas ni datos personales de terceros; no publicar detalles sensibles en una issue pública. Evitar pruebas de carga o modificaciones sobre datos reales.

## Alcance de la revisión

Se revisó el código público actual y se hicieron pruebas locales de contenido adverso, concurrencia, autorización y cuotas. Esto no certifica ausencia de vulnerabilidades ni demuestra que no hubo una filtración. El historial completo de Git, los permisos y secretos reales, las dependencias transitivas y el código desplegado del Worker original `donde-viene-api` requieren revisión adicional. La seguridad de cuentas y la configuración efectiva de Cloudflare no se pueden verificar únicamente leyendo este repositorio.
