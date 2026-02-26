BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comercio_estado_verificacion') THEN
    CREATE TYPE public.comercio_estado_verificacion AS ENUM (
      'none',
      'otp_pendiente',
      'otp_verificado',
      'manual_pendiente'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comercio_estado_propiedad') THEN
    CREATE TYPE public.comercio_estado_propiedad AS ENUM (
      'no_reclamado',
      'reclamacion_pendiente',
      'verificado',
      'en_disputa'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_challenge_purpose') THEN
    CREATE TYPE public.otp_challenge_purpose AS ENUM (
      'owner_verification',
      'phone_change',
      'user_login'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_channel') THEN
    CREATE TYPE public.otp_channel AS ENUM (
      'sms',
      'voice'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'otp_challenge_status') THEN
    CREATE TYPE public.otp_challenge_status AS ENUM (
      'pending',
      'verified',
      'expired',
      'blocked'
    );
  END IF;
END $$;

ALTER TABLE public."Comercios"
  ADD COLUMN IF NOT EXISTS estado_verificacion public.comercio_estado_verificacion NOT NULL DEFAULT 'none'::public.comercio_estado_verificacion,
  ADD COLUMN IF NOT EXISTS estado_propiedad public.comercio_estado_propiedad NOT NULL DEFAULT 'no_reclamado'::public.comercio_estado_propiedad,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid,
  ADD COLUMN IF NOT EXISTS metodo_verificacion text,
  ADD COLUMN IF NOT EXISTS verificado_en timestamptz,
  ADD COLUMN IF NOT EXISTS telefono_referencia_google text,
  ADD COLUMN IF NOT EXISTS telefono_publico text,
  ADD COLUMN IF NOT EXISTS telefono_publico_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS propietario_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telefono_verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueo_datos_criticos boolean NOT NULL DEFAULT false;

-- Importante:
-- No convertimos columnas existentes de texto -> enum aquí para no romper vistas
-- dependientes (ej. v_comercios_estado_efectivo). El backend ya maneja ambos tipos.

ALTER TABLE public."Comercios"
  ALTER COLUMN estado_verificacion SET DEFAULT 'none',
  ALTER COLUMN estado_propiedad SET DEFAULT 'no_reclamado';

CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idComercio" bigint NOT NULL REFERENCES public."Comercios"(id) ON DELETE CASCADE,
  purpose public.otp_challenge_purpose NOT NULL,
  destination_phone text NOT NULL,
  hashed_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts_left integer NOT NULL DEFAULT 5 CHECK (attempts_left >= 0),
  cooldown_until timestamptz NOT NULL,
  channel_used public.otp_channel,
  status public.otp_challenge_status NOT NULL DEFAULT 'pending',
  requester_ip inet,
  requester_user_id uuid,
  provider text,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_challenges_comercio_created_idx
  ON public.otp_challenges ("idComercio", created_at DESC);

CREATE INDEX IF NOT EXISTS otp_challenges_ip_created_idx
  ON public.otp_challenges (requester_ip, created_at DESC);

CREATE INDEX IF NOT EXISTS otp_challenges_user_created_idx
  ON public.otp_challenges (requester_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS otp_challenges_status_idx
  ON public.otp_challenges (status, expires_at DESC);

CREATE INDEX IF NOT EXISTS comercios_estado_propiedad_idx
  ON public."Comercios" (estado_propiedad);

CREATE INDEX IF NOT EXISTS comercios_estado_verificacion_idx
  ON public."Comercios" (estado_verificacion);

CREATE OR REPLACE FUNCTION public.fn_comercio_preservar_telefono_google()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.telefono_referencia_google IS NOT NULL
    AND NEW.telefono_referencia_google IS DISTINCT FROM OLD.telefono_referencia_google THEN
    NEW.telefono_referencia_google := OLD.telefono_referencia_google;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comercio_preservar_telefono_google ON public."Comercios";
CREATE TRIGGER trg_comercio_preservar_telefono_google
BEFORE UPDATE ON public."Comercios"
FOR EACH ROW
EXECUTE FUNCTION public.fn_comercio_preservar_telefono_google();

CREATE OR REPLACE FUNCTION public.fn_comercio_telefono_publico_needs_otp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.telefono_publico IS DISTINCT FROM OLD.telefono_publico THEN
    NEW.telefono_publico_verificado := false;
    NEW.estado_verificacion := 'otp_pendiente';
    NEW.bloqueo_datos_criticos := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comercio_telefono_publico_needs_otp ON public."Comercios";
CREATE TRIGGER trg_comercio_telefono_publico_needs_otp
BEFORE UPDATE ON public."Comercios"
FOR EACH ROW
EXECUTE FUNCTION public.fn_comercio_telefono_publico_needs_otp();

COMMIT;
