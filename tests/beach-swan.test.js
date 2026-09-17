import test from 'node:test';import assert from 'node:assert/strict';
import {modelRun,normalizeSwan} from '../netlify/functions/_shared/beach-swan.js';
import {normalizeBeachEvidence} from '../netlify/functions/_shared/experience-beach-evidence.js';
import {marineReport} from '../netlify/functions/_shared/experience-marine.js';
const now=Date.parse('2026-09-17T16:00:00Z'),issued=now-24*3600000,point={lat:18.45,lon:-67.16};
const table={columnNames:['time','latitude','longitude','hs','tp','dir'],columnUnits:['UTC','degrees_north','degrees_east','meters','seconds','degrees_true'],rows:[[new Date(now).toISOString(),18.4501,-67.16,1,8,270]]};
test('SWAN rejects stale runs, land cells, remote points and wrong units',()=>{
 assert.equal(modelRun({table:{rows:[]}},now),null);
 assert.equal(normalizeSwan({table},point,now-73*3600000,now,'test'),null);
 assert.equal(normalizeSwan({table:{...table,rows:[[new Date(now).toISOString(),18.45,-67.16,null,8,270]]}},point,issued,now,'test'),null);
 assert.equal(normalizeSwan({table},{lat:18,lon:-66},issued,now,'test'),null);
 assert.equal(normalizeSwan({table:{...table,columnUnits:['UTC','','','feet','seconds','degrees_true']}},point,issued,now,'test'),null);
});
test('forecasts remain distinct from observations and render as forecasts',()=>{
 const f=normalizeSwan({table},point,issued,now,'test');assert.equal(f.values.wave_height_ft,3.28084);assert.equal(f.observed_at,undefined);
 const e=normalizeBeachEvidence({computed_at:new Date(now).toISOString(),expires_at:new Date(now+600000).toISOString(),marine_json:{wave_forecast:f}},now);
 assert.equal(e.marine.length,0);assert.ok(e.forecast);
 const r=marineReport([{id:302,nombre:'Crash Boat',municipio:'Aguadilla'}],new Map([[302,e]]),{question:'Dame los datos del oleaje'});assert.match(r.message,/pronóstico/);assert.match(r.message,/3.3 pies/);assert.equal(r.cards[0].marine.mode,'forecast');
});

test('plain marine question explains small waves conversationally, details stay on card',()=>{
 const f=normalizeSwan({table:{...table,rows:[[new Date(now).toISOString(),18.4501,-67.16,.03,13,237]]}},point,issued,now,'test');
 const r=marineReport([{id:302,nombre:'Crash Boat',municipio:'Aguadilla'}],new Map([[302,{forecast:f,marine:[],alerts:[]}]]),{question:'¿Cómo está el oleaje en Crash Boat?'});
 assert.match(r.message,/olas pequeñas/);assert.doesNotMatch(r.message,/corrida|237|13 segundos|altura significativa/);assert.match(r.message,/corrientes/);assert.equal(r.cards[0].marine.periodSeconds,13);
});

test('combined weather and marine reply keeps rain, forecasts and alerts without duplicating reports',()=>{
 const f=normalizeSwan({table:{...table,rows:[[new Date(now).toISOString(),18.4501,-67.16,.03,13,237]]}},point,issued,now,'test');
 const r=marineReport([{id:302,nombre:'Crash Boat',municipio:'Aguadilla'}],new Map([[302,{forecast:f,marine:[],alerts:[{event:'Rip Current Statement'}]}]]),{question:'Cómo está el clima y oleaje?',weatherCards:[{id:302,weather:{description:'lluvia ligera',temperatureF:87,windMph:7}}]});
 assert.match(r.message,/lluvia ligera/);assert.match(r.message,/olas pequeñas/);assert.match(r.message,/riesgo de corrientes de resaca/);
 assert.doesNotMatch(r.message,/corrida|237|13 segundos|OpenWeather|El dato/);
 assert.equal((r.message.match(/En Crash Boat/g)||[]).length,1);
 assert.ok(r.message.length<650);assert.equal(r.cards[0].weather.temperatureF,87);
});

test('current advisories distinguish checked empty, unavailable and active risk',()=>{
 const rows=[{id:302,nombre:'Crash Boat',municipio:'Aguadilla'}];
 const checked=normalizeBeachEvidence({computed_at:new Date(now).toISOString(),expires_at:new Date(now+600000).toISOString(),metadata:{nws_status:'ok'},alerts_json:[]},now);
 assert.equal(checked.alertsStatus,'checked');
 assert.match(marineReport(rows,new Map([[302,checked]])).message,/No encontré un aviso vigente/);
 assert.match(marineReport(rows,new Map([[302,checked]])).message,/no confirma/);
 const failed=normalizeBeachEvidence({computed_at:new Date(now).toISOString(),expires_at:new Date(now+600000).toISOString(),metadata:{nws_status:'unavailable'},alerts_json:[]},now);
 assert.match(marineReport(rows,new Map([[302,failed]])).message,/No pude verificar/);
 assert.doesNotMatch(marineReport(rows,new Map([[302,failed]])).message,/No encontré un aviso/);
 const active=marineReport(rows,new Map([[302,{alertsStatus:'checked',alerts:[{event:'Rip Current Statement'}]}]]));
 assert.match(active.message,/mientras siga ese aviso/);assert.doesNotMatch(active.message,/No pude verificar|No encontré un aviso/);
 const stale=normalizeBeachEvidence({computed_at:new Date(now-61*60000).toISOString(),expires_at:new Date(now+600000).toISOString(),metadata:{nws_status:'ok'},alerts_json:[]},now);
 assert.notEqual(stale.alertsStatus,'checked');
});
