import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitSearchAreas} from '../netlify/functions/_shared/experience-location.js';
const areas=['Este','Oeste','Centro','Metro'].map(nombre=>({nombre,slug:nombre.toLowerCase()}));
test('date demonstratives and venue names do not become regions',()=>{
 for(const q of ['este weekend','este fin de semana','este sábado','con este clima','el Centro de Bellas Artes'])assert.deepEqual(explicitSearchAreas(q,areas),[],q);
 for(const q of ['en el Este este weekend','la zona este','costa este','Este'])assert.deepEqual(explicitSearchAreas(q,areas).map(a=>a.nombre),['Este'],q);
 assert.deepEqual(explicitSearchAreas('en el Oeste este fin de semana',areas).map(a=>a.nombre),['Oeste']);
 assert.deepEqual(explicitSearchAreas('en el centro de Puerto Rico',areas).map(a=>a.nombre),['Centro']);
});
