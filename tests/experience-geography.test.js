import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLandmark,nearbyMerchants,coordinates,nearestCatalogTown} from '../netlify/functions/_shared/experience-geography.js';
const park={id:12324,nombre:'Parque de Bombas',municipio:'Ponce',latitud:18.0119047,longitud:-66.6137251,activo:true};
test('exact landmark resolves without municipality; duplicate names require clarification',()=>{
 assert.deepEqual(resolveLandmark([park,{...park,id:2,nombre:'Antiguo Parque de Bombas'}],'parque de bombas',null),[park]);
 assert.equal(resolveLandmark([park,{...park,id:2,municipio:'Otro'}],'Parque de Bombas',null).length,2);
 assert.equal(resolveLandmark([park,{...park,id:2,municipio:'Otro'}],'Parque de Bombas','Ponce').length,1);
 assert.equal(resolveLandmark([park],'Lugar desconocido',null).length,0);
});
test('catalog coordinates rank Gallo and Campioni near the park, exclude Bahías and invalid locations',()=>{
 const results=nearbyMerchants([
 {nombre:'Campioni Pizza',latitud:18.0128074278639,longitud:-66.6110482153926},
 {nombre:'Bahías',latitud:17.980557478158,longitud:-66.621954074839},
 {nombre:'Gallo Espresso',latitud:18.011303708459103,longitud:-66.61442507400538},
 {nombre:'Sin coordenadas',latitud:null,longitud:null}
 ],park);
 assert.deepEqual(results.map(r=>r.nombre),['Gallo Espresso','Campioni Pizza']);
 assert.ok(results[0].distancia_km>0.09&&results[0].distancia_km<0.11);
 assert.equal(coordinates({latitud:'',longitud:''}),null);
 assert.equal(coordinates({latitud:0,longitud:0}),null);
});

test('beaches resolve as food-search landmarks, including CrashBoat aliases',()=>{
 const beach={id:302,nombre:'Crash Boat',municipio:'Aguadilla',tipo:'playa',latitud:18.458,longitud:-67.164};
 for(const name of ['Crash Boat','crash boat','CrashBoat','Playa Crash Boat'])assert.deepEqual(resolveLandmark([park,beach],name,'Aguadilla'),[beach]);
 assert.equal(resolveLandmark([beach],'CrashBoat','Ponce').length,0);
 assert.equal(nearbyMerchants([{nombre:'Cerca',latitud:18.4581,longitud:-67.1641}],beach).length,1);
});

test('expanded landmark search includes Peña Blanca beyond the former 2 km cutoff',()=>{
 const beach={latitud:18.45879276,longitud:-67.16397055};
 const restaurant={nombre:'Peña Blanca Restaurant',latitud:18.43425652499682,longitud:-67.15502945409965};
 assert.equal(nearbyMerchants([restaurant],beach,2).length,0);
 const results=nearbyMerchants([restaurant],beach,10);
 assert.equal(results.length,1);
 assert.ok(results[0].distancia_km>2&&results[0].distancia_km<3);
});
test('current coordinates resolve to the closest catalog municipality',()=>{
 const towns=[{id:1,nombre:'Ponce',latitud:18.011,longitud:-66.614},{id:2,nombre:'San Juan',latitud:18.466,longitud:-66.106}];
 assert.equal(nearestCatalogTown(towns,{latitud:18.02,longitud:-66.62}).nombre,'Ponce');
 assert.equal(nearestCatalogTown(towns,null),null);
});
