# Mensajería Findixi con Telnyx

## Alcance operativo

Telnyx es el único proveedor real de SMS de Findixi. Los flujos conservados son:

1. Verificación del teléfono de usuarios.
2. Verificación del teléfono oficial al solicitar o reclamar la membresía de un comercio.
3. Confirmaciones y cambios de citas.
4. Confirmaciones y cambios de órdenes para clientes y comercios.
5. Bienvenida y otras notificaciones transaccionales cuando se implementen.

La mensajería de cupones permanece deshabilitada. El proveedor `mock` se limita a desarrollo local y pruebas automatizadas.

## Variables de entorno de Netlify

- `OTP_PROVIDER=telnyx`
- `TELNYX_API_KEY`
- `TELNYX_FROM_NUMBER` o `TELNYX_MESSAGING_PROFILE_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OTP_HASH_SECRET` privado de al menos 32 caracteres
- `NOTIFICATIONS_CRON_SECRET` privado para ejecuciones manuales del dispatcher
- `NOTIFICATIONS_TEST_PHONE` opcional, solo durante pruebas controladas

`OTP_EXPOSE_CODE=true` solo se admite con el proveedor `mock` en desarrollo local o pruebas.

## Seguridad

- Los endpoints OTP requieren un usuario autenticado.
- Los códigos tienen expiración, cooldown, límite de intentos y rate limits.
- Los códigos se almacenan como hash y no se escriben en logs.
- El dispatcher corre cada tres minutos mediante Netlify Scheduled Functions.
- Una ejecución manual del dispatcher requiere `x-cron-secret`; si el secreto no está configurado, la solicitud manual falla cerrada.
- El frontend no puede activar directamente el dispatcher ni enviar teléfonos o mensajes arbitrarios.
- Solo se conserva el identificador del mensaje de Telnyx; no se persiste la respuesta completa del proveedor.

## Compatibilidad de colas existentes

Las filas históricas con canal `whatsapp` se entregan como SMS mediante Telnyx. No se modifica el esquema de base de datos en esta fase.

## Endpoints OTP

- `/.netlify/functions/send_otp`
- `/.netlify/functions/verify_otp`
- `/.netlify/functions/resend_otp`
- `/.netlify/functions/send_user_phone_otp`
- `/.netlify/functions/verify_user_phone_otp`
- `/.netlify/functions/resend_user_phone_otp`

## Dispatcher

- `/.netlify/functions/dispatch_notifications`
- Schedule: `*/3 * * * *`
- Procesa `ComercioCitasNotificaciones` y `ordenes_notificaciones`.
- Las pruebas con mensajes reales requieren autorización explícita y un número de destino seguro.
