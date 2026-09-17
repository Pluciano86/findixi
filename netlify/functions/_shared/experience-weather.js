import { beachCard } from './experience-beaches.js';
const cache=new Map();
const validCoords=p=>p.latitud!=null&&p.longitud!=null&&Number(p.latitud)>=17&&Number(p.latitud)<=19&&Number(p.longitud)>=-68&&Number(p.longitud)<=-65;
const distance=(a,b)=>(Number(a.latitud)-Number(b.latitud))**2+(Number(a.longitud)-Number(b.longitud))**2;
// Spread a bounded sample across the requested area instead of taking the first town's beaches.
export function weatherCandidates(rows,limit=12){
 const remaining=rows.filter(validCoords).sort((a,b)=>Number(a.longitud)-Number(b.longitud));
 const chosen=[];
 while(remaining.length&&chosen.length<limit){
  let index=0;
  if(chosen.length){let best=-1;remaining.forEach((p,i)=>{const d=Math.min(...chosen.map(q=>distance(p,q)));if(d>best){best=d;index=i;}});}
  chosen.push(remaining.splice(index,1)[0]);
 }
 return chosen;
}
export function parseWeather(data,now=Date.now()){
 const observed=Number(data.dt)*1000,temp=data.main?.temp,wind=data.wind?.speed,code=data.weather?.[0]?.id;
 if(!Number.isFinite(observed)||observed>now+300000||now-observed>5400000||!Number.isFinite(temp)||!Number.isFinite(wind)||wind<0||!Number.isInteger(code)||code<200||code>804)return null;
 const rain=data.rain?.['1h']??data.rain?.['3h']??0;
 if(!Number.isFinite(rain)||rain<0)return null;
 // This ranks weather only; it never assesses surf, currents, or swimming safety.
 const favorable=code>=800&&code<=804&&rain===0&&wind<15;
 return {observed,temp,wind,icon:/^(01|02|03|04|09|10|11|13|50)[dn]$/.test(data.weather[0].icon||'')?data.weather[0].icon:null,description:String(data.weather[0].description||'').slice(0,100),favorable,score:(data.clouds?.all??100)+wind*3};
}
export async function beachWeatherReply(rows,{apiKey,fetchImpl=fetch,now=Date.now()}={}){
 const unavailable={message:'Ahora mismo no pude consultar datos recientes del clima. Si me dices qué zona te interesa, puedo ayudarte a explorar sus playas, pero no confirmar cómo están hoy.',cards:[],count:0,tipo:'playa'};
 if(!apiKey)return unavailable;
 const sample=weatherCandidates(rows);
 const results=await collectBeachWeather(sample,{apiKey,fetchImpl,now});
 const available=results.filter(r=>r?.weather),best=available.filter(r=>r.weather.favorable).sort((a,b)=>a.weather.score-b.weather.score).slice(0,3);
 if(!available.length)return unavailable;
 if(!best.length)return {message:`Consulté el clima actual de ${available.length} playas, pero ninguna de las consultadas combina ausencia de lluvia con viento ligero ahora mismo. Prefiero no recomendarte una como buena por el clima con esos datos. Podemos explorar otra actividad para hoy.`,cards:[],count:0,tipo:'playa'};
 const time=new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',hour:'numeric',minute:'2-digit'});
 const details=best.map(({beach:p,weather:w})=>`${p.nombre}, en ${p.municipio}: ${w.description}, ${Math.round(w.temp)} °F y viento de ${Math.round(w.wind)} mph. Dato de las ${time.format(w.observed)}.`).join('\n\n');
 return {message:`¡Vamos a buscar ese ratito de playa! Comparé el clima actual de ${available.length} playas${available.length<sample.length?' (algunas consultas no estuvieron disponibles)':''}. Entre las que pude consultar, estas tienen condiciones más favorables ahora:\n\n${details}\n\nSon datos actuales, no un pronóstico para todo el día ni una comparación de todas las playas. No confirman oleaje, corrientes ni seguridad para nadar. Abajo te dejo las opciones.`,cards:best.map(r=>beachCard(r.beach)),count:best.length,tipo:'playa'};
}

export async function collectBeachWeather(sample,{apiKey,fetchImpl=fetch,now=Date.now()}={}){
 if(!apiKey)return sample.map(beach=>({beach,weather:null}));
 return Promise.all(sample.map(async beach=>{
  const key=`${beach.latitud},${beach.longitud}`;
  let weather=cache.get(key);
  if(!weather||now-weather.fetched>=600000||now-weather.observed>5400000){
   try{
    const params=new URLSearchParams({lat:String(beach.latitud),lon:String(beach.longitud),units:'imperial',lang:'es',appid:apiKey});
    const response=await fetchImpl(`https://api.openweathermap.org/data/2.5/weather?${params}`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok)return null;
    weather=parseWeather(await response.json(),now);
    if(!weather)return null;
    weather={...weather,fetched:now};if(cache.size>500)cache.clear();cache.set(key,weather);
   }catch{return null;}
  }
  return {beach,weather};
 }));
}

// A named-place weather question is a report, not a favorable-weather ranking.
export async function namedBeachWeatherReply(rows,{name,apiKey,fetchImpl=fetch,evidence=new Map(),now=Date.now()}={}){
 const beaches=rows.filter(p=>p.activo!==false);
 const empty=message=>({message,cards:[],count:0,tipo:'playa'});
 if(!beaches.length)return empty(`No pude identificar ${name||'esa playa'} en Findixi. ¿Me confirmas el nombre y municipio?`);
 if(beaches.length>1)return empty(`Encontré varias playas con ese nombre: ${beaches.map(p=>`${p.nombre} (${p.municipio})`).join(', ')}. ¿Cuál quieres consultar?`);
 const beach=beaches[0];
 const result=validCoords(beach)?await collectBeachWeather([beach],{apiKey,fetchImpl,now}):[];
 const weather=result[0]?.weather;
 const alerts=evidence.get(beach.id)?.alerts||[];
 let message=weather?`En ${beach.nombre}, ${beach.municipio}, ahora se reporta ${weather.description}, ${Math.round(weather.temp)} °F y viento de ${Math.round(weather.wind)} mph.`:`Ahora mismo no pude obtener una lectura reciente del clima de ${beach.nombre}. No puedo confirmar cómo está en este momento.`;
 if(weather){
  const time=new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',hour:'numeric',minute:'2-digit'}).format(weather.observed);
  message+=`\n\nEl dato es de las ${time}; describe las condiciones actuales, no el resto del día.`;
 }
 if(alerts.length)message+='\n\nAvisos vigentes de NWS para la zona: '+[...new Set(alerts.map(a=>a.event))].join('; ')+'.';
 if(weather||alerts.length)message+=' El clima no confirma las condiciones del oleaje ni la seguridad para nadar.';
 const card={...beachCard(beach),weather:weather?{icon:weather.icon,description:weather.description,temperatureF:Math.round(weather.temp),windMph:Math.round(weather.wind),observedAt:new Date(weather.observed).toISOString(),source:'OpenWeather'}:null};
 return {message,cards:[card],count:1,tipo:'playa'};
}

export function weatherQuestionMode(question){
 const q=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const weather=/\b(clima|temperatura|lluvia|lloviendo|viento|tiempo)\b/.test(q);
 const marine=/\b(oleaje|olas|corrientes|marejada|estado del mar|condiciones del mar|segur[oa]|seguridad)\b/.test(q);
 const future=/\b(manana|pasado manana|proxim[oa]|lunes|martes|miercoles|jueves|viernes|sabado|domingo|fin de semana|pronostico)\b/.test(q);
 const report=weather&&!future&&/\b(como esta|como se encuentra|que tal|que temperatura|esta lloviendo|hay lluvia)\b/.test(q);
 return {report,weather,marine,future};
}
export async function areaBeachWeatherReply(rows,options={}){
 const sample=weatherCandidates(rows.filter(p=>p.activo!==false),3);
 if(!sample.length)return {message:'No encontré playas con ubicación disponible en esa zona para consultar el clima.',cards:[],count:0,tipo:'playa'};
 const reports=await Promise.all(sample.map(p=>namedBeachWeatherReply([p],options)));
 const cards=reports.flatMap(r=>r.cards),available=cards.filter(c=>c.weather);
 let message=available.length?available.map(c=>`${c.nombre}, ${c.municipio}: ${c.weather.description}, ${c.weather.temperatureF} °F y viento de ${c.weather.windMph} mph.`).join('\n\n'):'Ahora mismo no pude obtener lecturas recientes del clima para las playas consultadas en esa zona.';
 if(available.length){message+='\n\nEstas son las condiciones actuales de las playas consultadas; la hora de cada dato aparece en su tarjeta.';if(available.length<cards.length)message+=' Algunas lecturas no estuvieron disponibles.';}
 const alerts=[...new Set(sample.flatMap(p=>options.evidence?.get(p.id)?.alerts||[]).map(a=>a.event))];
 if(alerts.length)message+='\n\nAvisos vigentes para la zona: '+alerts.join('; ')+'.';
 if(available.length||alerts.length)message+=' El clima por sí solo no confirma si el mar está seguro para nadar.';
 return {message,cards,count:cards.length,tipo:'playa'};
}
