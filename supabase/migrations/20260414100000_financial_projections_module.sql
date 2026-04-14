BEGIN;

CREATE TABLE IF NOT EXISTS public.projections (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  year integer NOT NULL,
  start_month integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projections_year_check CHECK (year >= 2000),
  CONSTRAINT projections_start_month_check CHECK (start_month BETWEEN 0 AND 11)
);

CREATE TABLE IF NOT EXISTS public.projection_settings (
  id bigserial PRIMARY KEY,
  projection_id bigint NOT NULL REFERENCES public.projections(id) ON DELETE CASCADE,
  sal_ceo numeric(12,2) NOT NULL DEFAULT 0,
  sal_coo numeric(12,2) NOT NULL DEFAULT 0,
  pct_ceo_selfservice numeric(7,4) NOT NULL DEFAULT 0,
  pct_coo_municipios numeric(7,4) NOT NULL DEFAULT 0,
  com_cgo_regular numeric(12,2) NOT NULL DEFAULT 0,
  com_cgo_plus numeric(12,2) NOT NULL DEFAULT 0,
  com_cgo_premium numeric(12,2) NOT NULL DEFAULT 0,
  meta_mrr_bono numeric(12,2) NOT NULL DEFAULT 0,
  bono_ceo numeric(12,2) NOT NULL DEFAULT 0,
  bono_coo numeric(12,2) NOT NULL DEFAULT 0,
  bono_cgo numeric(12,2) NOT NULL DEFAULT 0,
  hosting numeric(12,2) NOT NULL DEFAULT 0,
  tools numeric(12,2) NOT NULL DEFAULT 0,
  misc numeric(12,2) NOT NULL DEFAULT 0,
  fixed_expenses_extra jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projection_settings_unique_projection UNIQUE (projection_id)
);

CREATE TABLE IF NOT EXISTS public.projection_months (
  id bigserial PRIMARY KEY,
  projection_id bigint NOT NULL REFERENCES public.projections(id) ON DELETE CASCADE,
  month_index integer NOT NULL,
  reg_app integer NOT NULL DEFAULT 0,
  reg_cgo integer NOT NULL DEFAULT 0,
  plus_app integer NOT NULL DEFAULT 0,
  plus_cgo integer NOT NULL DEFAULT 0,
  prem_app integer NOT NULL DEFAULT 0,
  prem_cgo integer NOT NULL DEFAULT 0,
  sponsors numeric(12,2) NOT NULL DEFAULT 0,
  municipios numeric(12,2) NOT NULL DEFAULT 0,
  ads numeric(12,2) NOT NULL DEFAULT 0,
  extra_expenses jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_income jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  ceo_salary_override numeric(12,2),
  coo_salary_override numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projection_months_month_index_check CHECK (month_index BETWEEN 0 AND 11),
  CONSTRAINT projection_months_nonnegative_counts CHECK (
    reg_app >= 0 AND reg_cgo >= 0 AND plus_app >= 0 AND plus_cgo >= 0 AND prem_app >= 0 AND prem_cgo >= 0
  ),
  CONSTRAINT projection_months_unique_projection_month UNIQUE (projection_id, month_index)
);

CREATE INDEX IF NOT EXISTS projections_year_idx ON public.projections (year DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS projection_months_projection_idx ON public.projection_months (projection_id, month_index);
CREATE INDEX IF NOT EXISTS projection_settings_projection_idx ON public.projection_settings (projection_id);

CREATE OR REPLACE FUNCTION public.fn_touch_updated_at_projections_module()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_updated_at_projections ON public.projections;
CREATE TRIGGER trg_touch_updated_at_projections
BEFORE UPDATE ON public.projections
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at_projections_module();

DROP TRIGGER IF EXISTS trg_touch_updated_at_projection_settings ON public.projection_settings;
CREATE TRIGGER trg_touch_updated_at_projection_settings
BEFORE UPDATE ON public.projection_settings
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at_projections_module();

DROP TRIGGER IF EXISTS trg_touch_updated_at_projection_months ON public.projection_months;
CREATE TRIGGER trg_touch_updated_at_projection_months
BEFORE UPDATE ON public.projection_months
FOR EACH ROW
EXECUTE FUNCTION public.fn_touch_updated_at_projections_module();

COMMIT;
