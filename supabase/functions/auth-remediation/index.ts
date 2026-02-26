// deno-lint-ignore-file no-explicit-any
// Auth schema remediation Edge Function
// Safely recreates missing Supabase Auth triggers/functions
// Uses SUPABASE_SERVICE_ROLE_KEY automatically from env

import { createClient } from "npm:@supabase/supabase-js@2.45.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const remediationSql = `
CREATE OR REPLACE FUNCTION auth._lower_email(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL THEN NULL ELSE lower(t) END;
$$;

CREATE OR REPLACE FUNCTION auth._users_before_insert_or_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := auth._lower_email(NEW.email);
  NEW.raw_app_meta_data := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auth._identities_before_insert_or_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := auth._lower_email(NEW.email);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION auth._users_after_insert_create_identity()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = NEW.id AND i.provider = 'email'
  ) THEN
    INSERT INTO auth.identities (id, user_id, provider, provider_id, email)
    VALUES (gen_random_uuid(), NEW.id, 'email', NEW.email, NEW.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS _users_biubu ON auth.users;
CREATE TRIGGER _users_biubu
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth._users_before_insert_or_update();

DROP TRIGGER IF EXISTS _users_au_create_identity ON auth.users;
CREATE TRIGGER _users_au_create_identity
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth._users_after_insert_create_identity();

DROP TRIGGER IF EXISTS _identities_biubu ON auth.identities;
CREATE TRIGGER _identities_biubu
  BEFORE INSERT OR UPDATE ON auth.identities
  FOR EACH ROW EXECUTE FUNCTION auth._identities_before_insert_or_update();
`;

async function runSql(sql: string) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pg_exec`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_ROLE,
      "Authorization": `Bearer ${SERVICE_ROLE}`,
      "Prefer": "tx=commit",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(text);
  return text;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry_run") === "true";

  if (req.method !== "POST" || !url.pathname.endsWith("/apply")) {
    return new Response(JSON.stringify({ ok: false, error: "Use POST /apply" }), { status: 404 });
  }

  // ✅ Compare x-service-key header with environment key
  const svc = req.headers.get("x-service-key") || "";
  if (svc !== SERVICE_ROLE) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized: Service Role token required" }), { status: 401 });
  }

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, sql: remediationSql }), { headers: { "Content-Type": "application/json" } });
  }

  try {
    const result = await runSql(remediationSql);
    return new Response(JSON.stringify({ ok: true, result }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});