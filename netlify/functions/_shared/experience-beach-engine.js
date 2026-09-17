import { rankCandidates } from './recommendation-engine.js';
import { coordinates, nearbyMerchants } from './experience-geography.js';
import { weatherCandidates, collectBeachWeather } from './experience-weather.js';
import { beachCard } from './experience-beaches.js';
const names={nadar:'nadar',surfear:'surfear',snorkeling:'hacer snorkeling'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function prepareBeaches(rows,{activities=[],withoutBoat=false,nearby=false,origin=null}={}){
 const unique=new Map();
 for(const row of rows){
  if(row.activo===false||!activities.every(a=>row[a]===true)||(withoutBoat&&row.bote!==false))continue;
  const key=norm(row.nombre)+'|'+norm(row.municipio);if(!unique.has(key))unique.set(key,row);
 }
 const filtered=[...unique.values()];
 return nearby&&coordinates(origin||{})?nearbyMerchants(filtered,origin,200):filtered;
}
export async function recommendBeaches(rows,{activities=[],withoutBoat=false,nearby=false,origin=null,currentWeather=false,currentMarine=false,apiKey,fetchImpl=fetch,evidence=new Map(),limit=3,now=Date.now()}={}){
 const candidates=prepareBeaches(rows,{activities,withoutBoat,nearby,origin});
 const live=currentWeather||currentMarine;
 const sample=live?(nearby&&coordinates(origin||{})?candidates.filter(p=>coordinates(p)).slice(0,12):weatherCandidates(candidates)):candidates;
 const weatherRows=live?await collectBeachWeather(sample,{apiKey,fetchImpl,now}):[];
 const weatherMap=new Map(weatherRows.filter(r=>r?.weather).map(r=>[r.beach.id,r.weather]));
 const scored=sample.map(row=>{
  const weather=weatherMap.get(row.id),legacy=evidence.get(row.id)||{status:'missing',alerts:[],marine:[]};
  const blocking=live&&legacy.alerts.some(a=>['Severe','Extreme'].includes(a.severity)||/rip_current|high_surf|tsunami|hurricane|storm_surge/i.test(a.classification||''));
  const reasons=activities.map(a=>`Actividad registrada: ${names[a]}`);
  if(withoutBoat)reasons.push('Acceso sin bote registrado');
  if(nearby&&Number.isFinite(row.distancia_km))reasons.push('Priorizada por cercanía a tu ubicación');
  if(weather)reasons.push(`Clima actual: ${weather.description}`);
  const missing=[];if(live&&!weather)missing.push('clima');if(live&&!legacy.marine.length)missing.push('condiciones del mar');
  // A buoy reading is evidence, never a swimming safety score.
  return {row,weather,legacy,reasons,missing,excluded:blocking||(currentWeather&&!weather?.favorable)||(currentMarine&&!legacy.marine.some(m=>Number.isFinite(m.values?.wave_height_ft)||Number.isFinite(m.values?.current_speed_kt))),signals:{weather:weather?Math.max(0,1-weather.score/200):null,proximity:Number.isFinite(row.distancia_km)?1/(1+row.distancia_km/25):null}};
 });
 const ranked=rankCandidates(scored,{weather:live?70:0,proximity:nearby?30:0});
 const selected=ranked.slice(0,limit);
 const cards=selected.map(c=>({...beachCard(c.row),bote:c.row.bote,activities:activities.map(a=>names[a]),recommendation:{reasons:c.reasons,missing:c.missing,marineAvailable:c.legacy.marine.length>0},weather:c.weather?{icon:c.weather.icon,description:c.weather.description,temperatureF:Math.round(c.weather.temp),windMph:Math.round(c.weather.wind),observedAt:new Date(c.weather.observed).toISOString(),source:'OpenWeather'}:null}));
 let message;
 if(!candidates.length)message='No encontré playas que tengan confirmados esos requisitos. Podemos ampliar la zona o ajustar alguna preferencia.';
 else if(!selected.length&&currentMarine)message='Me faltan condiciones marinas vigentes y suficientemente cercanas para recomendarte una playa según el estado del mar. Puedo comparar el clima o ayudarte a explorar playas por sus actividades, pero no confirmar si es seguro entrar al agua.';
 else if(!selected.length)message=weatherMap.size?'Con los datos disponibles ahora, no encontré una opción para recomendarte con esas condiciones. Podemos buscar otro plan.':'No pude obtener clima reciente para comparar esas playas. Puedo ayudarte a explorar sus características, pero no confirmar cómo están ahora.';
 else {
  const first=selected[0];
  const purpose=activities.length?` para ${activities.map(a=>names[a]).join(' y ')}`:'';
  message=`Para ese plan${purpose}, empezaría mirando ${first.row.nombre}, en ${first.row.municipio}.`;
  if(activities.length)message+=' Tiene esas actividades registradas en Findixi.';
  if(first.weather)message+=` De las que pude consultar, es una opción para considerar por el clima ahora: ${first.weather.description}.`;
  if(nearby&&Number.isFinite(first.row.distancia_km))message+=' También tomé en cuenta la cercanía a tu ubicación.';
  if(selected.length>1)message+='\n\nTambién puedes explorar '+selected.slice(1).map(c=>`${c.row.nombre} (${c.row.municipio})`).join(' y ')+'. Abajo te dejo los detalles de cada opción.';
  if(selected.some(c=>c.row.bote===true))message+='\n\nOjo: '+selected.filter(c=>c.row.bote===true).map(c=>c.row.nombre).join(' y ')+' tiene acceso en bote registrado; requiere planificar ese traslado.';
  if(nearby&&!coordinates(origin||{}))message+='\n\nNo tengo tu ubicación actual: estas opciones corresponden a la zona solicitada, sin ordenar por distancia desde ti.';
  if(live&&activities.some(a=>['nadar','surfear','snorkeling'].includes(a)))message+=' Para entrar al agua, revisa también los avisos y las condiciones al llegar.';

 }
 return {message,cards,count:cards.length,tipo:'playa',listing:{ids:ranked.map(c=>c.row.id),occurrences:null},evidence:selected.map(c=>({nombre:c.row.nombre,municipio:c.row.municipio,descripcion:String(c.row.descripcion||'').slice(0,800),caracteristicas:{actividades:activities,acceso:c.row.acceso,bote:c.row.bote,clima:c.weather,mar:c.legacy.marine,datos_faltantes:c.missing}})),coverage:{catalog:candidates.length,compared:sample.length,weather:weatherMap.size,marine:selected.filter(c=>c.legacy.marine.length).length}};
}
