const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function puertoRicoDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function validDate(value){return value===null||(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value);}
const comedyTerms=['comedia','comico','comedy','stand up','standup','standoperos','impro','humor','carcajadas'];
export function eventSearchTerms(terms=[]){
 const clean=terms.map(norm).filter(t=>! /^(eventos?|actividades?|que hacer|weekend|este weekend|fin de semana|este fin de semana|hoy|manana)$/.test(t));
 return [...new Set(clean.flatMap(t=>/^(?:stand[ -]?up(?: comedy)?|comedia|comedy|humor|reirme|reir|impro(?:visacion)?)$/.test(t)?comedyTerms:[t]))];
}
export function currentWeekend(question,today){
 if(!/\beste (?:fin de semana|weekend)\b/.test(norm(question)))return null;
 const date=new Date(today+'T12:00:00Z');
 const day=date.getUTCDay();
 date.setUTCDate(date.getUTCDate()+(day===0?-2:5-day));
 const friday=date.toISOString().slice(0,10);
 date.setUTCDate(date.getUTCDate()+2);
 return {desde:friday<today?today:friday,hasta:date.toISOString().slice(0,10)};
}
const searchable=v=>norm(v).replace(/[-–—]/g,' ').replace(/\s+/g,' ');
export function selectEvents(rows,municipios,{municipio,terminos=[],categorias=[],desde=null,hasta=null},today){
 const names=new Map(municipios.map(m=>[Number(m.id),m.nombre]));
 const terms=eventSearchTerms(terminos);
 const out=[];
 for(const row of rows){
  if(row.activo!==true||categorias.length&&!categorias.includes(Number(row.categoria))||terms.length&&!terms.some(t=>searchable(row.nombre+' '+row.descripcion).includes(searchable(t))))continue;
  for(const sede of row.eventos_municipios||[]){
   const town=names.get(Number(sede.municipio_id));if(!town||municipio&&norm(town)!==norm(municipio))continue;
   for(const date of sede.eventoFechas||[]){
    if(!date.fecha||!validDate(date.fecha)||date.fecha<today||date.fecha<(desde||today)||hasta&&date.fecha>hasta)continue;
    out.push({...row,municipio:town,lugar:sede.lugar,direccion:sede.direccion,enlaceboletos_sede:sede.enlaceboletos||null,fecha:date.fecha,horainicio:date.horainicio,fecha_id:date.id,latitud:townsCoordinate(municipios,sede.municipio_id,'latitud'),longitud:townsCoordinate(municipios,sede.municipio_id,'longitud')});
   }
  }
 }
 return out.sort((a,b)=>(a.fecha+(a.horainicio||'')).localeCompare(b.fecha+(b.horainicio||'')));
}
const townsCoordinate=(towns,id,key)=>{const value=towns.find(t=>Number(t.id)===Number(id))?.[key];return value==null||String(value).trim()===''?null:Number(value);};
const safeTicketUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}};
export function rankEventOccurrences(rows,userLocation){
 const lat=Number(userLocation?.latitud),lon=Number(userLocation?.longitud);
 const valid=Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=17&&lat<=19&&lon>=-68&&lon<=-65;
 const radians=v=>v*Math.PI/180;
 return rows.map(row=>{
  const targetLat=Number(row.latitud),targetLon=Number(row.longitud);
  if(!valid||!Number.isFinite(targetLat)||!Number.isFinite(targetLon))return {...row,distancia_km:null};
  const dlat=radians(targetLat-lat),dlon=radians(targetLon-lon);
  const a=Math.sin(dlat/2)**2+Math.cos(radians(lat))*Math.cos(radians(targetLat))*Math.sin(dlon/2)**2;
  return {...row,distancia_km:6371*2*Math.asin(Math.sqrt(Math.min(1,a)))};
 }).sort((a,b)=>{
  const ad=a.distancia_km??Number.POSITIVE_INFINITY,bd=b.distancia_km??Number.POSITIVE_INFINITY;
  return ad-bd||(a.fecha+(a.horainicio||'')).localeCompare(b.fecha+(b.horainicio||''));
 });
}
export function eventCard(e){
 const occurrences=(e.occurrences||[e]).map(item=>({fecha:item.fecha,horainicio:item.horainicio,municipio:item.municipio,lugar:item.lugar,direccion:item.direccion}));
 const ticket=safeTicketUrl(e.enlaceboletos_sede)||safeTicketUrl(e.enlaceboletos);
 return {tipo:'evento',id:e.id,nombre:e.nombre,municipio:e.municipio,portada:e.imagen,fecha:e.fecha,horainicio:e.horainicio,lugar:e.lugar,direccion:e.direccion,perfil:`/perfilEvento.html?id=${e.id}`,latitud:e.latitud,longitud:e.longitud,telefono:null,logo:null,horarios:[],boleteria:ticket,boleteriaNombre:e.boleteriaNombre||null,ocurrencias:occurrences,masFechas:occurrences.length>1};
}

export function eventAlternatives(rows,towns,criteria,today){
 const anchor=criteria.desde||today;
 const end=new Date(anchor+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+((7-end.getUTCDay())%7));
 const weekEnd=end.toISOString().slice(0,10);
 const origin=towns.find(t=>norm(t.nombre)===norm(criteria.municipio));
 const coords=t=>t&&t.latitud!=null&&t.longitud!=null&&String(t.latitud).trim()!==''&&String(t.longitud).trim()!==''&&Number.isFinite(Number(t.latitud))&&Number.isFinite(Number(t.longitud));
 const nearby=new Set();
 if(coords(origin))for(const town of towns){
  if(!coords(town)||town.id===origin.id)continue;
  const rad=v=>v*Math.PI/180;
  const a=Math.sin(rad(Number(town.latitud)-Number(origin.latitud))/2)**2+Math.cos(rad(Number(origin.latitud)))*Math.cos(rad(Number(town.latitud)))*Math.sin(rad(Number(town.longitud)-Number(origin.longitud))/2)**2;
  if(6371*2*Math.asin(Math.sqrt(Math.min(1,a)))<=30)nearby.add(norm(town.nombre));
 }
 const all=selectEvents(rows,towns,{...criteria,municipio:null,desde:anchor,hasta:weekEnd},today);
 const sameDay=all.filter(e=>nearby.has(norm(e.municipio))&&e.fecha>=anchor&&e.fecha<=(criteria.hasta||anchor));
 const localWeek=all.filter(e=>norm(e.municipio)===norm(criteria.municipio));
 const nearWeek=all.filter(e=>nearby.has(norm(e.municipio))&&!sameDay.includes(e));
 const result=[];const seen=new Set();
 for(let i=0;result.length<12;i++){
  let added=false;
  for(const group of [sameDay,localWeek,nearWeek]){
   const e=group[i];if(!e)continue;
   const key=e.id+':'+e.fecha_id+':'+e.municipio;if(seen.has(key))continue;
   seen.add(key);result.push(e);added=true;if(result.length===12)break;
  }
  if(!added)break;
 }
 return result;
}
