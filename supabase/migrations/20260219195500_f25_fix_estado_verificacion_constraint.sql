BEGIN;

ALTER TABLE public."Comercios"
  DROP CONSTRAINT IF EXISTS comercios_estado_verificacion_chk;

ALTER TABLE public."Comercios"
  ADD CONSTRAINT comercios_estado_verificacion_chk
  CHECK (
    estado_verificacion::text = ANY (
      ARRAY[
        'none',
        'otp_pendiente',
        'otp_verificado',
        'manual_pendiente',
        'sms_pendiente',
        'sms_verificado',
        'messenger_pendiente',
        'messenger_verificado',
        'manual_aprobado'
      ]
    )
  );

COMMIT;
