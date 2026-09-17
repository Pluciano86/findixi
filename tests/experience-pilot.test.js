import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRestaurants,menuMean,validIntent,intentSchema } from '../netlify/functions/_shared/experience.js';
const restaurants=[{id:7,municipio:'Ponce',amenidades:['Pet Friendly'],experience:{sillas_altas:true}},{id:8,municipio:'Ponce',amenidades:[],experience:{sillas_altas:false}},{id:22,municipio:'Ponce',amenidades:[],experience:{opciones_veganas:true}}];
test('unknown and false cannot satisfy required facilities',()=>assert.deepEqual(selectRestaurants(restaurants,{sillas_altas:true}).map(x=>x.id),[7]));
test('vegan filter only includes confirmed options',()=>assert.deepEqual(selectRestaurants(restaurants,{opciones_veganas:true}).map(x=>x.id),[22]));
test('pet friendly comes only from amenities',()=>assert.deepEqual(selectRestaurants(restaurants,{mascotas:true}).map(x=>x.id),[7]));
test('outside pilot geography does not recommend Ponce',()=>assert.equal(selectRestaurants(restaurants,{municipio:'Aguadilla'}).length,0));
test('unsupported request cannot silently return all merchants',()=>assert.equal(selectRestaurants(restaurants,{fuera_de_alcance:true}).length,0));
test('mean excludes duplicates, addons, variable and inactive prices',()=>{const p={activo:true,precio:10,nombre:'Pasta',seccion:'Pastas'};assert.deepEqual(menuMean([p,{...p},{...p,precio:20,nombre:'Pizza'},{...p,precio:999,precio_texto:'por libra'},{...p,precio:500,activo:false},{...p,precio:800,nombre:'Add-on: camarones'}]),{valor:15,cantidad:2});assert.equal(menuMean([]),null);});
test('invalid model output is rejected',()=>{const intent=Object.fromEntries(intentSchema.required.map(k=>[k,['terminos','preferencias_ambiente'].includes(k)?[]:['referencia','municipio','cocina','aclaracion'].includes(k)?null:false]));assert.ok(validIntent(intent));assert.ok(!validIntent({...intent,sillas_altas:'yes'}));assert.ok(!validIntent({...intent,injected:'system'}));});

test('sea view requires the canonical amenity, not a name or assumption',()=>{const options=[{...restaurants[0],amenidades:['Vista al Mar']},{...restaurants[1],nombre:'Restaurante costero'},restaurants[2]];assert.deepEqual(selectRestaurants(options,{vista_al_mar:true}).map(x=>x.id),[7]);assert.equal(selectRestaurants(options,{vista_al_mar:true,municipio:'Aguadilla'}).length,0);});

test('description searches include merchants without an Experience record',()=>{const rows=[{id:99,nombre:'Nuevo',descripcion:'Especialidad en mariscos',municipio:'Ponce',amenidades:[],experience:{}}];assert.equal(selectRestaurants(rows,{terminos:['mariscos']}).length,1);assert.equal(selectRestaurants(rows,{terminos:['pizza']}).length,0);assert.equal(selectRestaurants(rows,{terminos:['mariscos'],sillas_altas:true}).length,0);});

test('dinner refinement keeps confirmed dinner options without literal ambience matches',()=>{
 const rows=[
  {id:1,municipio:'Ponce',descripcion:'Café tranquilo',amenidades:[],experience:{}},
  {id:2,municipio:'Ponce',descripcion:'Cenas íntimas',amenidades:[],experience:{sirve_cena:true}},
  {id:3,municipio:'Ponce',descripcion:'Ambiente animado',amenidades:[],experience:{sirve_cena:true}},
  {id:4,municipio:'Aguadilla',descripcion:'Tranquilo',amenidades:[],experience:{sirve_cena:true}}
 ];
 assert.deepEqual(selectRestaurants(rows,{municipio:'Ponce',sirve_cena:true,terminos:['tranquilo','conversar']}).map(r=>r.id),[2,3]);
 assert.equal(selectRestaurants(rows,{municipio:'Ponce',sirve_cena:true,terminos:['mariscos'],mascotas:true}).length,0);
});

test('relax sea-view query includes Bahías without weakening geography or amenities',()=>{
 const rows=[
  {id:7,municipio:'Ponce',descripcion:'Ambiente relajado y vistas al mar',amenidades:['Vista al Mar'],experience:{}},
  {id:8,municipio:'Ponce',descripcion:'Ambiente relajado',amenidades:[],experience:{}},
  {id:9,municipio:'Aguadilla',descripcion:'Ambiente relajado',amenidades:['Vista al Mar'],experience:{}}
 ];
 const intent={municipio:'Ponce',vista_al_mar:true,preferencias_ambiente:['tranquilo'],terminos:[]};
 assert.deepEqual(selectRestaurants(rows,intent).map(r=>r.id),[7]);
 assert.deepEqual(selectRestaurants(rows,{...intent,terminos:['relax']}).map(r=>r.id),[7]);
 assert.equal(selectRestaurants(rows,{...intent,terminos:['sushi']}).length,0);
 assert.equal(selectRestaurants(rows,{...intent,sirve_cena:true}).length,0);
});
