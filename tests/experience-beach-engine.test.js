import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareBeaches,recommendBeaches} from '../netlify/functions/_shared/experience-beach-engine.js';
import {normalizeBeachEvidence,loadBeachEvidence} from '../netlify/functions/_shared/experience-beach-evidence.js';
const rows=[{id:1,nombre:'Uno',municipio:'Ponce',activo:true,nadar:true,bote:false,latitud:18,longitud:-66.6},{id:2,nombre:'Dos',municipio:'Ponce',activo:true,nadar:null,bote:false,latitud:18,longitud:-66.61},{id:3,nombre:'Tres',municipio:'Ponce',activo:true,nadar:true,bote:true,latitud:18,longitud:-66.62}];
test('required activities and land access must be confirmed; inactive beaches excluded',()=>{
 assert.deepEqual(prepareBeaches([...rows,{...rows[0],id:4,nombre:'Inactive',activo:false}],{activities:['nadar'],withoutBoat:true}).map(p=>p.id),[1]);
 assert.equal(prepareBeaches([{...rows[0],bote:null}],{withoutBoat:true}).length,0);
});
test('closeness orders actual coordinates and never silently substitutes zero origin',async()=>{
 const result=await recommendBeaches(rows,{nearby:true,origin:{latitud:18,longitud:-66.62}});
 assert.equal(result.cards[0].id,3);assert.equal(result.cards[0].bote,true);
 const unknown=await recommendBeaches(rows,{nearby:true});assert.match(unknown.message,/No tengo tu ubicación/);
});
test('expired snapshots and distant marine readings do not count as current local evidence',()=>{
 const now=Date.now(),iso=delta=>new Date(now+delta).toISOString();
 const snapshot={computed_at:iso(-1000),expires_at:iso(10000),marine_json:{wave:{observed_at:iso(-1000),expires_at:iso(10000),mode:'buoy_observation',confidence:86,source_ref:{geographic_precision_meters:59526},values:{wave_height_ft:3}}},alerts_json:[]};
 assert.equal(normalizeBeachEvidence(snapshot,now).marine.length,0);
 snapshot.marine_json.wave.source_ref.geographic_precision_meters=2000;
 assert.equal(normalizeBeachEvidence(snapshot,now).marine.length,1);
 snapshot.marine_json.wave.mode='model_forecast';assert.equal(normalizeBeachEvidence(snapshot,now).marine.length,0);
 snapshot.marine_json.wave.mode='buoy_observation';snapshot.expires_at=iso(-1);assert.equal(normalizeBeachEvidence(snapshot,now).marine.length,0);
});
test('sunny weather cannot override marine alerts or establish swimming safety',async()=>{
 const now=Date.now(),fetchImpl=async()=>Response.json({dt:Math.floor(now/1000),main:{temp:84},wind:{speed:3},clouds:{all:0},weather:[{id:800,description:'despejado'}]});
 const evidence=new Map([[1,{status:'partial',marine:[],alerts:[{classification:'rip_current',severity:'Moderate'}]}]]);
 const result=await recommendBeaches([rows[0]],{currentWeather:true,apiKey:'mock',fetchImpl,evidence});assert.equal(result.cards.length,0);
 const missing=await recommendBeaches([rows[0]],{currentMarine:true,apiKey:'mock',fetchImpl});assert.equal(missing.cards.length,0);assert.match(missing.message,/Me faltan condiciones marinas/);
});
test('disabled legacy beaches do not fetch or bypass legacy engine enablement',async()=>{
 const db={from(){throw Error('must not query')}};
 assert.equal((await loadBeachEvidence(db,rows)).size,0);
});
