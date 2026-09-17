import test from 'node:test';
import assert from 'node:assert/strict';
import {selectEvents,currentWeekend,eventSearchTerms,rankEventOccurrences,eventCard} from '../netlify/functions/_shared/experience-events.js';
import {recommendationChoices} from '../netlify/functions/_shared/experience-recommendations.js';
test('comedy alternatives match catalog vocabulary within requested weekend',()=>{
 const dates=['2026-09-18','2026-09-19','2026-09-20','2026-09-21'];
 const rows=['Noche de Impro','Stand-up Comedy','Comedia teatral','Concierto de salsa'].map((nombre,id)=>({id,nombre,activo:true,eventos_municipios:[{municipio_id:1,eventoFechas:dates.map((fecha,id)=>({id,fecha}))}]}));
 const range=currentWeekend('Quiero reírme este weekend, hay alguna obra o stand up este fin de semana?','2026-09-17');
 assert.deepEqual(range,{desde:'2026-09-18',hasta:'2026-09-20'});
 const matches=selectEvents(rows,[{id:1,nombre:'Ponce'}],{terminos:['stand up','este weekend'],...range},'2026-09-17');
 assert.equal(matches.length,9);assert.deepEqual([...new Set(matches.map(r=>r.id))],[0,1,2]);
 assert.deepEqual(eventSearchTerms(['Artista específico']),['artista especifico']);
 assert.equal(selectEvents(rows,[{id:1,nombre:'Ponce'}],{terminos:['Artista específico'],...range},'2026-09-17').length,0);
});
test('weekend boundaries retain only remaining days and cross year',()=>{
 assert.deepEqual(currentWeekend('este weekend','2026-09-20'),{desde:'2026-09-20',hasta:'2026-09-20'});
 assert.deepEqual(currentWeekend('este fin de semana','2026-12-31'),{desde:'2027-01-01',hasta:'2027-01-03'});
 assert.equal(currentWeekend('el próximo fin de semana','2026-09-17'),null);
});
test('event category filters stay exclusive and repeated dates become one card',()=>{
 const rows=[
  {id:10,nombre:'Comedia',categoria:4,activo:true,enlaceboletos:'https://tickets.example/comedia',eventos_municipios:[{municipio_id:1,lugar:'Teatro',direccion:'Calle 1',eventoFechas:[{id:101,fecha:'2026-09-18'},{id:102,fecha:'2026-09-19'}]}]},
  {id:20,nombre:'Concierto',categoria:8,activo:true,eventos_municipios:[{municipio_id:2,eventoFechas:[{id:201,fecha:'2026-09-18'}]}]}
 ];
 const towns=[{id:1,nombre:'Ponce',latitud:18.01,longitud:-66.61},{id:2,nombre:'San Juan',latitud:18.46,longitud:-66.10}];
 const matches=selectEvents(rows,towns,{categorias:[4]},'2026-09-17');
 assert.deepEqual([...new Set(matches.map(x=>x.id))],[10]);
 const cards=recommendationChoices(matches,'evento',3);
 assert.equal(cards.length,1);assert.equal(cards[0].occurrences.length,2);
 const card=eventCard(cards[0]);assert.equal(card.masFechas,true);assert.equal(card.ocurrencias.length,2);assert.equal(card.boleteria,'https://tickets.example/comedia');
});
test('event occurrences are ranked by the user location and unsafe ticket links are rejected',()=>{
 const rows=[{id:1,fecha:'2026-09-18',latitud:18.46,longitud:-66.10},{id:2,fecha:'2026-09-19',latitud:18.01,longitud:-66.61}];
 const ranked=rankEventOccurrences(rows,{latitud:18.02,longitud:-66.62});
 assert.equal(ranked[0].id,2);assert.ok(ranked[0].distancia_km<ranked[1].distancia_km);
 assert.equal(eventCard({...rows[0],nombre:'Evento',municipio:'San Juan',enlaceboletos:'javascript:alert(1)'}).boleteria,null);
});
