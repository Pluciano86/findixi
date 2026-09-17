# Findixi recommendations: beach engine v1

Owner: Peter / Findixi. Implemented 2026-09-17 for TEST only, following the request to start a recommendation engine that incorporates weather and the previous beach work.

## Current behavior

`experience-pilot` extracts the user's beach activity, destination, proximity preference, explicit land-only access requirement, and current weather/marine question. `experience-beach-engine` handles beach searches, including the beach section of combined plans. Detail questions retain the existing detail flow.

The reusable `recommendation-engine` orders scored candidates after hard exclusions; this is an affinity ranking, never a safety score. Other catalog types retain their current selectors.

Beach filtering requires positive catalog evidence for requested activities and `bote=false` for land-only access; unknown never passes a required condition. Inactive beaches are excluded. Name+municipality duplicates are collapsed. Proximity uses valid user coordinates and Haversine distance, never an assumed origin. The browser sends only recently obtained coordinates; this does not add storage of location. User-facing travel times continue using the listing's existing utility; boat-access beaches do not show car travel time.

Current weather: at most 12 geographically distributed eligible beaches, or the 12 closest eligible beaches when proximity was requested and coordinates are available. OpenWeather cache: 10 minutes; observations older than 90 minutes rejected. The answer states comparison coverage. Ranking uses weather and proximity when requested; explicit good-weather searches exclude missing or unfavorable current weather. Future forecasts remain unsupported. No claim to compare all beaches or predict the entire day.

Results: up to three cards with selected activity, boat access, current weather, observation time and provider. Conversational summary explains the fit. Beach group offers Ver más for additional selected/matching IDs using the existing listing snapshot filter. That link captures the selection; it is not a guarantee that weather stays unchanged.

## Previous engine: inspected, not restarted

Supabase already contains entities, reviewed beach links, source bindings, normalized NWS/CARICOOS weather/marine/alert data, snapshots and scores. Eleven beaches are enabled with verified links. `experience-result` currently returns `FINDIXI_MAINTENANCE` (503). Latest snapshots and scores expired in August 2026.

The new read-only adapter uses only enabled beaches, unambiguous reviewed `part_of` links, verified coordinates/entities and unexpired snapshots. It checks each marine input and alert independently. Marine observations older than two hours, confidence below 70, missing precision or representative points beyond 10 km are omitted. These are conservative evidence-selection rules, not physical guarantees about local beach conditions. Forecast products are not treated as current observations. Known active severe/rip-current/high-surf/tsunami/hurricane/storm-surge alerts exclude recommendations, regardless of sunny weather. Missing marine data is explicit. A request specifically about current marine conditions is not answered with a weather-only recommendation.

No old scores are reused, no source sync is invoked, no maintenance function is replaced, no flags or database records are changed. Stored marine/alert evidence has no live coverage while the previous ingestion remains in maintenance; absence of records never means absence of hazards.

## Next stage

Recover and review the original ingestion/scoring source and reason for maintenance before restoring those services. Then validate NWS alerts and CARICOOS geographic bindings, refreshed observations and forecasts, units, expiration and activity-specific scoring. Remaining extensions include forecasts for requested time windows, local reports, facilities verified for family/accessibility requirements, broader coverage and additional catalog adapters. Do not fabricate family suitability or safety from activity flags.

## Verification

`node --test tests/experience-beach-engine.test.js tests/experience-plan-choice.test.js tests/experience-weather.test.js`

Covers strict unknown handling, inactive/boat exclusions, location ranking, stale/distant marine evidence, advisory precedence over sunshine, missing marine information, legacy enablement, multi-category behavior and weather follow-up without municipality. These are mocked regression tests; authenticated conversational/visual validation remains a phone/browser check.
