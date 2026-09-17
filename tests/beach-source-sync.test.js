import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAlerts,normalizeBuoy,collectSnapshot,distanceMeters} from '../netlify/functions/_shared/beach-source-sync.js';
const now=Date.parse('2026-09-17T15:00:00Z');
const point={lat:18.37,lon:-67.26};
const buoy=(time,flag=1)=>({table:{columnNames:['time','latitude','longitude','waveHs','waveTp','waveFlagPrimary'],columnUnits:['UTC','degrees_north','degrees_east','meter','second',null],rows:[[time,18.3765,-67.2798,1,8,flag]]}});
test('buoy preserves time, converts units, rejects stale/failed quality/distant evidence',()=>{
 const fresh=buoy('2026-09-17T14:30:00Z');
 assert.equal(normalizeBuoy(fresh,point,now).values.wave_height_ft,3.28084);
 assert.equal(normalizeBuoy(buoy('2026-09-15T12:30:00Z'),point,now),null);
 assert.equal(normalizeBuoy(buoy('2026-09-17T14:30:00Z',4),point,now),null);
 assert.equal(normalizeBuoy(fresh,{lat:17.94,lon:-66.95},now),null);
 assert.equal(distanceMeters({lat:null,lon:0},point),Infinity);
});
test('NWS expires alerts and preserves hazard classification',()=>{
 const p={event:'Rip Current Statement',severity:'Moderate',effective:'2026-09-17T12:00:00Z',expires:'2026-09-17T18:00:00Z'};
 assert.equal(normalizeAlerts({features:[{properties:p}]},now)[0].alert_classification,'rip_current');
 assert.equal(normalizeAlerts({features:[{properties:{...p,expires:'2026-09-16T18:00:00Z'}}]},now).length,0);
 assert.throws(()=>normalizeAlerts({},now));
});
test('failed providers are explicit missing evidence, never simulated observations',async()=>{
 const s=await collectSnapshot({id:499,entity_id:65,latitud:18.37,longitud:-67.26,caricoos_enabled:true},{now,fetchImpl:async()=>{throw Error('offline');}});
 assert.equal(s.metadata.nws_status,'unavailable');assert.deepEqual(s.marine_json,{});assert.equal(s.missing_inputs_json.length,2);
});
