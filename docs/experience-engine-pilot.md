## Access update

Peter requested removal of the additional account allowlist. TEST now permits any valid Findixi session; site restriction and rate limiting remain. FE_PILOT_USER_IDS is no longer used. This supersedes earlier access notes below.

# Findixi Experience — text restaurant pilot

Deployed to TEST 2026-09-17: deploy 6aab35700f8fe8427b9fc6d5. OPENAI_KEY is configured with Functions scope. Peter's verified account is enabled via FE_PILOT_USER_IDS. Browser verified /experience.html and signed-out access message. Authenticated OpenAI round-trip remains pending; cloud browser has no user session.

## Architecture

`public/experience.html` → authenticated TEST-only `experience-pilot` Netlify function → OpenAI Responses structured intent → deterministic filters over Supabase → concise response and cards. Only pilot merchants 7, 8, 22 are eligible. Draft restaurant attributes remain private to authorized pilot accounts. No public RLS changes.

OpenAI receives user question/history, not credentials or the database. It extracts explicit requirements; it does not choose merchant IDs, prices or links. Local rules choose cards. NULL cannot satisfy a required facility. Pets use canonical amenity relations. Menus are fetched live and averaged with duplicate/add-on exclusions. Mean is not a meal/person budget. No write operations, SMS, reservations or orders.

## Configuration required on test-findixi only

- `OPENAI_KEY`: server Functions secret (name confirmed by Peter). `OPENAI_API_KEY` is also accepted as fallback. Presence and validity still require verification; never expose in browser.
- `FE_PILOT_USER_IDS`: comma-separated verified Supabase auth user IDs allowed to use draft pilot. Empty denies all.
- `FE_OPENAI_MODEL`: optional, defaults to `gpt-4.1-mini`.
- Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Deploy after configuration, then test with authorized session at `/experience.html`. No index entry until pilot is validated. Do not deploy to final production. Function checks Netlify site ID as well as user access. Platform rate limit intended 10 requests/minute per IP/domain; validate platform support before deployment. No distributed user quota yet: required before wider launch.

## Current supported criteria

Municipality, criolla/Italian cuisine, pet amenity, kids menu, high chairs, changing table, accessible bathroom, large groups, vegan options, lunch/dinner. Current verified positive fields match; unknown/false exclude only when required. Geography outside available pilot returns no matches, never substitutes a different town.

## Deliberately pending

Natural generated descriptions, comprehensive negative/OR preferences, specific dishes and price constraints, hours/open-now (must use canonical Horarios/holidays), weather, beaches, distances, voice and routing, persistent conversation, external provider sync. Unsupported requests receive a limitation/clarification rather than silently claiming a match. User text-only history limited to four turns; needs richer server conversation state later. No actual OpenAI round-trip verified until key is configured. No claim of end-to-end readiness.

## Verification

`node --test tests/experience-pilot.test.js` covers unknown/false, vegan, pets, geography, unsupported requests, menu means and malformed model output. Live model intent extraction, authorized endpoint, Netlify limiter and rendered browser UX remain deployment gates.

Reference: https://developers.openai.com/api/docs/guides/structured-outputs
