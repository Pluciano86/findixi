# Mensajería Twilio (WhatsApp + SMS + Voice)

## Objetivo cubierto
1. Verificación de teléfono en alta/edición de usuario: OTP por WhatsApp primero, SMS fallback.
2. Órdenes: confirmación inicial y cambios de estado para cliente.
3. Citas: confirmación, recordatorio y cambios de estado para cliente.
4. Reclamo de comercio: OTP por mensaje/call (ya existente) con Twilio.

## Regla de canal activa
- Regla general: WhatsApp primero y SMS como fallback.
- Excepción: reclamo de comercio desde `registroComercio.html` (`purpose=owner_verification`) usa SMS primero y fallback a llamada de voz.

## Variables de entorno necesarias (Netlify Functions)
- `OTP_PROVIDER=twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` (SMS/Voice)
- `TWILIO_WHATSAPP_USE_SANDBOX=true` (pruebas) o `TWILIO_WHATSAPP_FROM` (producción)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OTP_HASH_SECRET`
- `OTP_EXPOSE_CODE=true` (solo pruebas)
- `NOTIFICATIONS_CRON_SECRET` (recomendado para proteger dispatcher)

## Endpoints nuevos
- `/.netlify/functions/send_user_phone_otp`
- `/.netlify/functions/verify_user_phone_otp`
- `/.netlify/functions/resend_user_phone_otp`
- `/.netlify/functions/dispatch_notifications`

## Flujo de despacho
- El dispatcher procesa:
  - `ComercioCitasNotificaciones` (sms/whatsapp)
  - `ordenes_notificaciones` (sms/whatsapp)
- Intento por canal:
  - `whatsapp` -> fallback a `sms` si falla

## Programación
- `dispatch_notifications` incluye schedule `*/3 * * * *`.
- Si quieres ejecución manual protegida, usa `x-cron-secret` con valor de `NOTIFICATIONS_CRON_SECRET`.

## Migración requerida
Aplicar:
- `supabase/migrations/20260428173000_messaging_notifications_and_user_phone_otp.sql`
- `supabase/migrations/20260428191000_citas_whatsapp_first.sql`

Esta migración crea:
- `user_phone_otp_challenges`
- `ordenes_notificaciones`
- triggers para cola de notificaciones de órdenes
- triggers para recordatorios y cambios de estado en citas
- columnas de verificación de teléfono en `usuarios`
