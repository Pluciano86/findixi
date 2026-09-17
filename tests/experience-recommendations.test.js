import test from 'node:test';import assert from 'node:assert/strict';
import {recommendationChoices,describePlan} from '../netlify/functions/_shared/experience-recommendations.js';
test('branches share one slot while distinct businesses remain visible; Morro precedes duplicate imports',()=>{
 const rows=[{id:1,nombre:'La Pachanga',municipio:'Bayamón',tieneSucursales:true},{id:2,nombre:'La Pachanga',municipio:'Guaynabo',tieneSucursales:true},{id:3,nombre:'Otro restaurante',municipio:'San Juan'}];
 const chosen=recommendationChoices(rows,'comercio');assert.deepEqual(chosen.map(r=>r.id),[1,3]);assert.equal(chosen[0].sucursales.length,2);
 const places=[{id:1,nombre:'Museo',municipio:'San Juan'},{id:2,nombre:'Castillo San Felipe del Morro',municipio:'San Juan'},{id:3,nombre:'Castillo San Felipe del Morro',municipio:'San Juan'}];
 assert.deepEqual(recommendationChoices(places,'lugar').map(r=>r.id),[2,1]);
});
test('combined narrative receives descriptions and branches in one model call',async()=>{
 let calls=0;const groups=[{label:'Para comer',cards:[{nombre:'La Pachanga'}],evidence:[{nombre:'La Pachanga',descripcion:'Cocina mexicana',sucursales:[{municipio:'Bayamón'},{municipio:'Guaynabo'}]}]}];
 const result=await describePlan({groups,question:'comida y jangueo',location:'Metro',apiKey:'test',model:'test',fetchImpl:async(_url,opts)=>{calls++;const input=JSON.parse(JSON.parse(opts.body).input);assert.equal(input.categorias[0].opciones[0].sucursales.length,2);assert.equal(input.categorias[0].opciones[0].descripcion,'Cocina mexicana');return Response.json({status:'completed',output:[{content:[{type:'output_text',text:'Para comer puedes considerar La Pachanga.\n\nAbajo te dejo algunas recomendaciones.'}]}]});}});assert.equal(calls,1);assert.match(result,/\n\n/);
});
