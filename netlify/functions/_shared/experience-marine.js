import {beachCard} from './experience-beaches.js';
const date=value=>new Intl.DateTimeFormat('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));
export function marineReport(rows,evidence,{question='',weatherCards=null}={}){
 const technical=/altura|cu[aá]nt[oa]s?|per[ií]odo|direcci[oó]n|grados|segundos|datos|detalle|t[eé]cnic|fecha|hora|corrida/i.test(question);
 const available=rows.filter(p=>p.activo!==false&&(evidence.get(p.id)?.forecast||evidence.get(p.id)?.marine?.length));
 const selected=(available.length?available:rows.filter(p=>p.activo!==false)).slice(0,3);
 const cards=selected.map(p=>{const e=evidence.get(p.id),f=e?.forecast;return {...beachCard(p),marine:f?{mode:'forecast',heightFt:f.values.wave_height_ft,periodSeconds:f.values.wave_period_s,directionDegrees:f.values.wave_direction_deg,validAt:f.valid_at,issuedAt:f.forecast_at}:null};});
 const paragraphs=selected.map(p=>{
  const e=evidence.get(p.id),f=e?.forecast,observation=e?.marine?.find(m=>Number.isFinite(m.values?.wave_height_ft));
  const weather=weatherCards?.find(c=>c.id===p.id)?.weather;
  let text=`En ${p.nombre}, `;
  if(weather){
   text+=`ahora hay ${weather.description}`;
   if(technical)text+=`, ${weather.temperatureF} °F y viento de ${weather.windMph} mph`;
   text+='. ';
   if(/lluvia|llovizna/i.test(weather.description))text+='Para pasar un rato de playa, yo esperaría o buscaría otra opción. ';
  }else if(weatherCards)text+='no pude actualizar el clima en este momento. ';

  const sentenceStart=weatherCards?'El':'el';
  if(f){
   const height=f.values.wave_height_ft;
   if(technical)text+=`${sentenceStart} pronóstico marca unos ${height.toFixed(1)} pies de oleaje, con ${f.values.wave_period_s.toFixed(0)} segundos entre olas y dirección de ${f.values.wave_direction_deg.toFixed(0)}°. Es para ${date(f.valid_at)}, calculado con la corrida del ${date(f.forecast_at)}.`;
   else if(height<1)text+=`${sentenceStart} pronóstico apunta a olas pequeñas en la zona.`;
   else text+=`${sentenceStart} pronóstico apunta a olas de alrededor de ${height.toFixed(0)} pies cerca de la playa. En la orilla pueden romper de otra manera.`;
  }else if(!observation)text+=(weatherCards?'Todavía':'todavía')+' no tengo datos recientes del oleaje.';
  if(observation)text+=` Una boya cercana reportó olas de unos ${observation.values.wave_height_ft.toFixed(1)} pies${technical?' ('+date(observation.observed)+')':''}; es una referencia de la zona.`;
  const alertNames={'Rip Current Statement':'riesgo de corrientes de resaca','High Surf Advisory':'oleaje alto','High Surf Warning':'oleaje peligroso','Tsunami Warning':'tsunami','Hurricane Warning':'huracán'};
  if(e?.alerts?.length)text+=' Ojo: hay avisos vigentes por '+[...new Set(e.alerts.map(a=>alertNames[a.event]||a.event))].join('; ')+'.';
  const ripAlert=e?.alerts?.some(a=>/rip current|corrientes de resaca/i.test(a.event||''));
  if(ripAlert)text+=' Para bañarte, yo buscaría otro plan mientras siga ese aviso.';
  else if(e?.alertsStatus==='checked')text+=' No encontré un aviso vigente de corrientes de resaca para la zona; eso no confirma que esté seguro para bañarte.';
  else text+=' No pude verificar los avisos de corrientes de resaca para la zona ahora mismo.';
  return text;
 });
 const offer=weatherCards?.some(c=>/lluvia|llovizna/i.test(c.weather?.description||''))?'¿Te busco otra playa cercana con mejor clima?':'';
 const message=paragraphs.length?paragraphs.join('\n\n')+(offer?'\n\n'+offer:''):'No encontré esa playa en la zona indicada. ¿Me confirmas el nombre o municipio?';
 if(weatherCards)for(const card of cards)card.weather=weatherCards.find(c=>c.id===card.id)?.weather||null;
 return {message,cards,count:cards.length,tipo:'playa'};
}
