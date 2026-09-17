import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectedPlanCategories,planCategoryIntent,shouldAskPlan} from '../netlify/functions/_shared/experience-conversation.js';
import {intentSchema} from '../netlify/functions/_shared/experience.js';
import {puertoRicoDate,currentWeekend} from '../netlify/functions/_shared/experience-events.js';

test('multiple choices advance even if interpreter mistakenly asks for categories again',async()=>{
 assert.deepEqual(selectedPlanCategories('Jangueo, comida y eventos'),['jangueo','comida','eventos']);
 assert.deepEqual(selectedPlanCategories('No quiero playas, quiero comida'),[]);
 const base=Object.fromEntries(Object.entries(intentSchema.properties).map(([key,schema])=>[key,schema.type==='boolean'?false:schema.type==='array'?[]:null]));
 const interpreted={...base,municipio:'Mayagüez',necesita_tipo_plan:true,categorias_plan:['turismo','comida'],tipo_consulta:'busqueda',tipo_resultado:'lugar',nombre_playa:null,actividades_playa:[],fecha_desde:null,fecha_hasta:null};
 const tables={Municipios:[{id:1,nombre:'Mayagüez'}],Comercios:[{id:2,nombre:'Restaurante de prueba',municipio:'Mayagüez',categoria:'Restaurante',descripcion:'Comida criolla',latitud:18.2,longitud:-67.1},{id:3,nombre:'Bar de prueba',municipio:'Mayagüez',categoria:'Bar',descripcion:'Bar con cerveza',latitud:18.2,longitud:-67.1}],eventos:[{id:4,nombre:'Evento de prueba',activo:true,eventos_municipios:[{id:5,municipio_id:1,lugar:'Plaza',eventoFechas:[{id:6,fecha:puertoRicoDate(),horainicio:'20:00'}]}]}]};
 const db={auth:{getUser:async()=>({data:{user:{id:'test-user'}}})},from(table){const q=new Proxy({then(resolve){return Promise.resolve({data:tables[table]||[],error:null}).then(resolve)}},{get(target,key){return key==='then'?target.then:()=>q}});return q;}};
 const previous={fetch:globalThis.fetch,Netlify:globalThis.Netlify,testDBClient:globalThis.testDBClient};
 try{
  globalThis.testDBClient=()=>db;globalThis.Netlify={env:{get:()=> 'test'}};
  let modelCalls=0;
  globalThis.fetch=async(_url,options)=>{modelCalls++;if(!JSON.parse(options.body).text)return new Response('',{status:503});return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(interpreted)}]}]});};
  let source=fs.readFileSync(new URL('../netlify/functions/experience-pilot.mts',import.meta.url),'utf8');
  source=source.replace("import { createClient } from '@supabase/supabase-js';",'const createClient=globalThis.testDBClient;').replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL('../netlify/functions/'+path,import.meta.url).href}'`);
  const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const broadResponse=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question:'Voy para Mayaguez, que me recomiendas hacer y comer?'})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
  const broad=await broadResponse.json();assert.match(broad.message,/explorar primero/);assert.deepEqual(broad.cards,[]);assert.equal(broad.searchMunicipio,'Mayagüez');
  const response=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question:'Jangueo, comida y eventos',searchMunicipio:'Mayagüez',history:['Voy para Mayagüez, qué hacer y comer?']})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.tipo,'mixto');assert.doesNotMatch(data.message,/explorar primero/);assert.deepEqual(data.sections.map(s=>s.label),['Jangueo','Para comer','Eventos']);assert.deepEqual(data.cards.map(c=>c.id),[3,2,4]);assert.equal(modelCalls,3);
  tables.Area=[{idArea:2,nombre:'Metro',slug:'metro'}];
  tables.Municipios=[{id:1,nombre:'San Juan',idArea:2},{id:2,nombre:'Bayamón',idArea:2},{id:3,nombre:'Ponce',idArea:1}];
  tables.Comercios[0].municipio='San Juan';tables.Comercios[1].municipio='Bayamón';
  tables.Comercios.push({id:9,nombre:'Restaurante fuera del área',municipio:'Ponce',categoria:'Restaurante',descripcion:'Comida'});
  tables.LugaresTuristicos=[{id:7,nombre:'Museo de prueba',municipio:'San Juan',activo:true},{id:8,nombre:'Museo fuera del área',municipio:'Ponce',activo:true}];
  const today=puertoRicoDate();
  const later=new Date(today+'T12:00:00Z');later.setUTCDate(later.getUTCDate()+7);
  tables.eventos[0].eventos_municipios[0].eventoFechas.push({id:10,fecha:later.toISOString().slice(0,10),horainicio:'20:00'});
  Object.assign(interpreted,{municipio:'Metro',necesita_tipo_plan:false,categorias_plan:['comida','jangueo','eventos','turismo'],fecha_desde:today,fecha_hasta:today});
  const regionalResponse=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question:'Quiero restaurantes, jangueo, eventos y lugares a visitar en el área Metro hoy'})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
  const regional=await regionalResponse.json();assert.equal(regionalResponse.status,200);assert.equal(regional.searchMunicipio,'Metro');assert.match(regional.message,/Metro/);assert.deepEqual(regional.cards.map(c=>c.id),[2,3,4,7]);assert.equal(regional.cards.find(c=>c.tipo==='evento').fecha,today);assert.ok(regional.cards.every(c=>['San Juan','Bayamón'].includes(c.municipio)));
  const beforeThanks=modelCalls;
  const thanksResponse=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question:'Muchas gracias por la ayuda',history:['Busco playas'],thanksCount:1})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
  const thanks=await thanksResponse.json();assert.equal(thanks.social,true);assert.equal(thanks.keepContext,true);assert.match(thanks.message,/otra playa/);assert.equal(modelCalls,beforeThanks);
  Object.assign(interpreted,{municipio:null,clima_playa_actual:true,categorias_plan:[],necesita_tipo_plan:false,tipo_resultado:'playa',fecha_desde:null,fecha_hasta:null});
  tables.playas=[{id:302,nombre:'Crash Boat',municipio:'Aguadilla',latitud:18.46,longitud:-67.16}];
  const modelFetch=globalThis.fetch;
  globalThis.fetch=async(url,options)=>String(url).includes('api.openweathermap.org')?Response.json({dt:Math.floor(Date.now()/1000),main:{temp:83},wind:{speed:5},weather:[{id:800,description:'cielo claro'}],clouds:{all:5}}):modelFetch(url,options);
  const weatherResponse=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question:'La que esté mejor en clima',history:['Quiero ir hoy para la playa, cuál está buena hoy?']})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
  const weather=await weatherResponse.json();assert.equal(weatherResponse.status,200);assert.equal(weather.cards[0].id,302);assert.doesNotMatch(weather.message,/Comparé clima|Dato de las|Me faltan condiciones marinas/);assert.ok(weather.cards[0].weather.observedAt);assert.doesNotMatch(weather.message,/En qué pueblo/);
  // Interpreter deliberately drops the town and incorrectly demands marine evidence.
  tables.Municipios=[{id:1,nombre:'Aguadilla'},{id:2,nombre:'Rincón'},{id:3,nombre:'Guayama'}];
  tables.playas.push({id:999,nombre:'Playa fuera',municipio:'Guayama',latitud:18,longitud:-66.1});
  Object.assign(interpreted,{municipio:null,nombre_playa:null,clima_playa_actual:false,mar_playa_actual:true});
  const ask=async question=>{
   const r=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify({question})}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
   assert.equal(r.status,200);return r.json();
  };
  const aguadilla=await ask('¿Cómo está el clima en Aguadilla para ir de playa?');
  assert.equal(aguadilla.searchMunicipio,'Aguadilla');assert.deepEqual(aguadilla.cards.map(c=>c.id),[302]);assert.doesNotMatch(aguadilla.message,/Guayama|Me faltan condiciones marinas/);
  const todayBeach=await ask('Quiero ir hoy para la playa, cual me recomiendas que esté buena hoy?');
  assert.ok(todayBeach.cards.length>0);assert.doesNotMatch(todayBeach.message,/Me faltan condiciones marinas vigentes y suficientemente cercanas/);

  // Replay Peter's sequence while the interpreter drops weather, retains the old town/name,
  // and incorrectly classifies the second request as a detail follow-up.
  tables.Area=[{idArea:4,nombre:'Oeste',slug:'oeste'}];
  tables.Municipios=[{id:1,nombre:'Aguadilla',idArea:4,latitud:18.43,longitud:-67.15},{id:2,nombre:'Rincón',idArea:4},{id:3,nombre:'Guayama',idArea:5}];
  tables.playas.push({id:500,nombre:'Playa Domes',municipio:'Rincón',latitud:18.36,longitud:-67.27});
  const step=async payload=>{
   const r=await handler(new Request('https://test.findixi.com/.netlify/functions/experience-pilot',{method:'POST',headers:{authorization:'Bearer test'},body:JSON.stringify(payload)}),{site:{id:'f935bb3d-8904-43cc-b67d-448fde9f7b5b'}});
   assert.equal(r.status,200);return r.json();
  };
  Object.assign(interpreted,{municipio:'Aguadilla',nombre_playa:'Crash Boat',clima_playa_actual:false,mar_playa_actual:true,tipo_consulta:'busqueda'});
  const first=await step({question:'Crash Boat está buena para ir hoy?'});
  assert.ok(first.cards[0].weather);assert.match(first.message,/cielo claro/);
  Object.assign(interpreted,{tipo_consulta:'detalle'});
  const second=await step({question:'Que otras playas me recomiendas en el oeste?',history:['Crash Boat está buena para ir hoy?'],searchMunicipio:'Aguadilla',contextType:'playa',contextIds:[302]});
  assert.equal(second.searchMunicipio,'Oeste');assert.ok(second.cards.some(c=>c.id===500));
  assert.ok(second.cards.every(c=>c.id!==302&&c.municipio!=='Guayama'&&c.weather));
  tables.LugaresTuristicos=[{id:801,nombre:'Mirador Punta Borinquen',municipio:'Aguadilla',descripcion:'Vista al aire libre',activo:true},{id:802,nombre:'Museo de prueba',municipio:'Aguadilla',descripcion:'Exhibiciones culturales',activo:true}];
  tables.Comercios=[{id:803,nombre:'Restaurante de prueba',municipio:'Aguadilla',latitud:18.43,longitud:-67.15,categoria:'Restaurante',descripcion:'Comida criolla'}];
  Object.assign(interpreted,{tipo_resultado:'lugar',tipo_consulta:'busqueda',nombre_playa:null,municipio:'Aguadilla',terminos:['mirador'],necesita_tipo_plan:true});
  tables.Comercios.push({id:804,nombre:'Bar de prueba',municipio:'Rincón',latitud:18.36,longitud:-67.25,categoria:'Bar',descripcion:'Bar con cerveza'});
  tables.eventos=[{id:805,nombre:'Evento de prueba oeste',activo:true,eventos_municipios:[{id:806,municipio_id:2,lugar:'Teatro',eventoFechas:[{id:807,fecha:puertoRicoDate(),horainicio:'20:00'}]}]}];
  const third=await step({question:'Que me recomiendas aparte de playa, con este clima cerca de Aguadilla?',history:['Crash Boat está buena para ir hoy?','Que otras playas me recomiendas en el oeste?'],searchMunicipio:'Oeste',contextType:'playa',contextIds:[500]});
  assert.equal(third.tipo,'mixto');assert.equal(third.searchMunicipio,'Aguadilla');
  assert.ok(third.cards.some(c=>c.id===802));assert.ok(third.cards.some(c=>c.id===803));assert.ok(third.cards.every(c=>c.id!==801&&c.tipo!=='playa'));
  assert.deepEqual(third.sections.map(s=>s.category),['turismo','comida','jangueo','eventos']);
  for(const question of ['Aparte de playa, que me recomiendas hacer en el Oeste?','Además de la playa, qué opciones hay en el oeste?']){
   // Force a tourism-only interpreter output; all four sources must still be consulted.
   Object.assign(interpreted,{categorias_plan:['turismo'],tipo_resultado:'lugar',municipio:'Aguadilla',terminos:['museo'],tipo_consulta:'detalle'});
   const mixed=await step({question,history:['Crash Boat está buena para ir hoy?','Todas las playas en el Oeste están igual?'],searchMunicipio:'Oeste',contextType:'playa',contextIds:[500]});
   assert.equal(mixed.tipo,'mixto');assert.equal(mixed.searchMunicipio,'Oeste');
   assert.deepEqual(mixed.sections.map(s=>s.category),['turismo','comida','jangueo','eventos']);
   for(const id of [802,803,804,805])assert.ok(mixed.cards.some(c=>c.id===id),'Missing category card '+id);
   assert.ok(mixed.cards.every(c=>c.tipo!=='playa'));
  }
  // Regression: the word "este" in a date must not override a correct model intent with region Este.
  tables.Area=[{idArea:5,nombre:'Este',slug:'este'},{idArea:3,nombre:'Oeste',slug:'oeste'}];
  tables.Municipios=[{id:58,nombre:'Ponce',idArea:1},{id:2,nombre:'Aguada',idArea:3},{id:35,nombre:'Humacao',idArea:5}];
  const weekend=currentWeekend('este weekend',puertoRicoDate());
  tables.eventos=[{id:228,nombre:'Noche de Impro - Cogiendo Calle',activo:true,eventos_municipios:[{id:16582,municipio_id:58,lugar:'Studio 58',eventoFechas:[{id:34326,fecha:weekend.desde,horainicio:'20:00:00'}]},{id:16583,municipio_id:2,lugar:'Bambalinas Café Teatro',eventoFechas:[{id:34327,fecha:weekend.hasta,horainicio:'20:00:00'}]}]}];
  Object.assign(interpreted,{...base,tipo_resultado:'evento',tipo_consulta:'busqueda',categorias_plan:['eventos'],necesita_tipo_plan:false,nombre_playa:null,actividades_playa:[],clima_playa_actual:false,mar_playa_actual:false,terminos:['comedia','stand up','impro'],fecha_desde:weekend.desde,fecha_hasta:weekend.hasta});
  const comedy=await step({question:'Quiero reírme este weekend, hay alguna obra o stand up este fin de semana?'});
  assert.equal(comedy.searchMunicipio,null);assert.equal(comedy.cards.length,1);assert.equal(comedy.cards[0].id,228);assert.equal(comedy.cards[0].masFechas,true);assert.equal(comedy.cards[0].ocurrencias.length,2);
  const westernComedy=await step({question:'Qué comedia hay en el Oeste este fin de semana?'});
  assert.equal(westernComedy.searchMunicipio,'Oeste');assert.equal(westernComedy.cards.length,1);assert.equal(westernComedy.cards[0].municipio,'Aguada');
  tables.categoriaEventos=[{id:10,nombre:'Comedia'},{id:1,nombre:'Concierto'},{id:3,nombre:'Deportivo'}];
  tables.eventos=Array.from({length:6},(_,i)=>({id:900+i,nombre:'Evento '+i,descripcion:'Show de humor y música',categoria:i<4?10:i===4?1:3,activo:true,eventos_municipios:[{id:950+i,municipio_id:58,lugar:'Teatro',eventoFechas:[{id:990+i,fecha:weekend.desde,horainicio:'20:00:00'}]}]}));
  Object.assign(interpreted,{municipio:null,categorias_evento:[10],terminos_evento:[],terminos:['show'],fecha_desde:weekend.desde,fecha_hasta:weekend.hasta});
  for(const question of ['Quiero reírme este weekend, hay alguna obra o stand up este fin de semana?','Eventos']){
   const filtered=await step({question,history:['Quiero comedia este weekend']});
   assert.equal(filtered.cards.length,3);assert.ok(filtered.cards.every(c=>c.id<904));
   assert.deepEqual(filtered.listing.ids,[900,901,902,903]);assert.deepEqual(filtered.listing.occurrences,[990,991,992,993]);
   assert.match(filtered.sections[0].labelFilters,/Comedia/);assert.ok(filtered.sections[0].labelFilters.includes(weekend.desde));
  }
  assert.deepEqual(planCategoryIntent({...base,terminos:['pizza'],busca_comida:true},'eventos','Mayagüez').intent.terminos,[]);
 }finally{Object.assign(globalThis,previous);}
});

test('broad plans require a choice, explicit plans do not',()=>{
 assert.equal(shouldAskPlan('Voy para Mayaguez, que me recomiendas hacer y comer?',false),true);
 assert.equal(shouldAskPlan('Qué puedo hacer el sábado con mis hijos?',false),true);
 assert.equal(shouldAskPlan('Quiero playas y comida en Ponce',true),false);
 assert.equal(shouldAskPlan('Jangueo, comida y eventos',true),false);
 assert.equal(shouldAskPlan('Lugares turísticos en Ponce',true),false);
 assert.equal(shouldAskPlan('Quiero ver todas las opciones',true),false);
 assert.equal(shouldAskPlan('Dónde puedo comer en Ponce?',false),false);
});
