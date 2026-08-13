# Security

## Estado del MVP

Este proyecto es un MVP educativo y no debe procesar pagos reales ni datos sensibles en producción sin endurecimiento adicional.

Medidas actuales:
- Límite básico de solicitudes por IP.
- Límite de tamaño del body JSON.
- Cabeceras HTTP de endurecimiento.
- Validación básica de pedidos, cantidades y correo.
- Los pedidos no se exponen mediante un endpoint público.
- Operaciones administrativas requieren `Authorization: Bearer <ADMIN_TOKEN>`.
- No se incluyen secretos en el repositorio.

## Próximas medidas

- Sustituir archivos JSON por una base de datos transaccional.
- Autenticación de usuarios y RBAC para administración.
- Proveedor de pagos sandbox y verificación de webhooks.
- CSRF donde corresponda, auditoría y logging seguro.
- Tests de integración y análisis SAST/dependencias.
