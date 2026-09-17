# Limited source recovery (TEST)

`experience-source-refresh` is a Netlify scheduled function, restricted to the TEST site and published context. It checks two of the eleven pilot IDs every five minutes, completing a cycle in thirty minutes. It requires the catalog enable flag, verified unique entity mapping, active source and verified source binding. Catalog/entity coordinates must agree within 250 meters. El Combate currently fails that gate and is excluded, without changing catalog data.

NWS active alerts are fetched by beach coordinates. Failures are recorded explicitly. CARICOOS Rincón wave observations are checked only for Sandy Beach, within ten kilometers and only with primary QC flag 1, timestamp within two hours, and expected units. Other beaches have no approved local buoy in this recovery. Provider retrieval time never substitutes for observation time. No swimming safety conclusion is generated.

Snapshots use `findixi_source_recovery_v1`, expire after forty minutes and remain partial. Existing readers independently enforce freshness. Old Supabase maintenance functions remain paused; this new internal scheduled pipeline replaces source retrieval for this bounded pilot. No public refresh route is exposed.

Live verification on September 17 found NWS responding. Rincón's latest observation was September 15 with QC flag 4 and is correctly rejected. CARICOOS publicly reports that buoy under maintenance. SWAN was investigated but is not activated: model initialization freshness and wet-cell mapping still require validation. Forecasts must never be written into observation slots.

Rollback: remove the scheduled function and redeploy TEST. Existing snapshots expire automatically. No schema migration or additional beach activation is required.

## SWAN extension

The refresh now also requests the SWAN_HighRes_PR grid for approved CARICOOS bindings. It validates `runstartdate` (maximum 72 hours), coverage end, returned valid time (within two hours), expected units, and the nearest non-null water grid point within 350 meters. No value is substituted for land/no-data cells. This is a nearby model estimate, not a breaking-wave or rip-current assessment at the shoreline. The initial 72-hour run-age ceiling is an application freshness policy, not a provider guarantee.

`wave_forecast` remains separate from `wave_observation`. Readers validate expiry and run age again. Marine questions report model height, period, direction, valid time and run time; cards explicitly say “Oleaje previsto”. Queries requesting weather and marine conditions receive both. No forecast is converted into an observation or swimming safety score. Broader buoy/current coverage and El Combate coordinate reconciliation remain separate work.
