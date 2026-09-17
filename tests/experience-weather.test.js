import test from 'node:test';
import assert from 'node:assert/strict';
import {weatherCandidates,parseWeather,beachWeatherReply} from '../netlify/functions/_shared/experience-weather.js';
const now=Date.now();
const data=(code=800)=>({dt:Math.floor(now/1000),main:{temp:84},wind:{speed:5},weather:[{id:code,description:'cielo claro'}],clouds:{all:10}});
test('weather excludes stale data, rain and hazardous weather from favorable results',()=>{
 assert.equal(parseWeather({...data(),dt:(now-7200000)/1000},now),null);
 for(const code of [201,500,701])assert.equal(parseWeather(data(code),now).favorable,false);
 assert.equal(parseWeather({...data(),rain:{'1h':1}},now).favorable,false);
 assert.equal(parseWeather(data(),now).favorable,true);
});
test('comparison spreads a bounded sample and handles partial provider failures',async()=>{
 const rows=Array.from({length:20},(_,i)=>({id:i,nombre:`Playa ${i}`,municipio:'Pueblo',latitud:18,longitud:-67.8+i*.1}));
 const sample=weatherCandidates(rows);
 assert.equal(sample.length,12);assert.equal(sample[1].id,19);
 let calls=0;
 const result=await beachWeatherReply(rows,{apiKey:'test',now,fetchImpl:async()=>({ok:++calls!==1,json:async()=>data()})});
 assert.equal(calls,12);assert.equal(result.cards.length,3);
 assert.match(result.message,/11 playas/);assert.match(result.message,/no un pronóstico/);
 const missing=await beachWeatherReply(rows,{apiKey:''});assert.equal(missing.cards.length,0);
});

test('named beach reports rain instead of rejecting a recommendation and includes alerts',async()=>{
 const {namedBeachWeatherReply}=await import('../netlify/functions/_shared/experience-weather.js');
 const beach={id:302,nombre:'Crash Boat',municipio:'Aguadilla',latitud:18.45879,longitud:-67.16397};
 const result=await namedBeachWeatherReply([beach],{apiKey:'test',now,evidence:new Map([[302,{alerts:[{event:'Rip Current Statement'}]}]]),fetchImpl:async()=>({ok:true,json:async()=>({...data(500),weather:[{id:500,description:'lluvia ligera'}]})})});
 assert.match(result.message,/lluvia ligera/);assert.match(result.message,/84 °F/);assert.match(result.message,/Rip Current/);assert.equal(result.cards.length,1);
 assert.doesNotMatch(result.message,/no encontré una opción|buscar otro plan/);
 const missing=await namedBeachWeatherReply([beach],{apiKey:''});assert.match(missing.message,/lectura reciente/);assert.equal(missing.cards[0].weather,null);
 const ambiguous=await namedBeachWeatherReply([beach,{...beach,id:303,municipio:'Otro'}],{});assert.equal(ambiguous.cards.length,0);assert.match(ambiguous.message,/Cuál/);
});

test('municipal weather report does not require marine data or favorable conditions',async()=>{
 const {weatherQuestionMode,areaBeachWeatherReply}=await import('../netlify/functions/_shared/experience-weather.js');
 const mode=weatherQuestionMode('Como está el clima en Aguadilla para ir de playa?');assert.equal(mode.report,true);assert.equal(mode.marine,false);
 assert.equal(weatherQuestionMode('Como está el clima mañana?').report,false);
 assert.equal(weatherQuestionMode('Cómo está el clima y el oleaje?').marine,true);
 const result=await areaBeachWeatherReply([{id:77,nombre:'Playa de prueba',municipio:'Aguadilla',latitud:18.48,longitud:-67.15}],{apiKey:'test',now,fetchImpl:async()=>Response.json({...data(501),weather:[{id:501,description:'lluvia moderada'}]})});
 assert.match(result.message,/lluvia moderada/);assert.equal(result.cards.length,1);assert.doesNotMatch(result.message,/Me faltan condiciones marinas|OpenWeather/);
});
