import { obtenerIconoClima } from './iconoClima.js';
import { saveExperienceListing } from '../shared/experienceListingFilter.js';
import { formatearFecha, formatearHora } from '../shared/eventDateFormat.js';
import { evaluarHorarioActual } from '../shared/pkg/perfil/comercio.js';
import { calcularDistanciaHaversineKm, calcularTiempoEnVehiculo, formatearTelefonoDisplay } from '../shared/utils.js';
import { createExperienceMemory } from './experienceMemory.js';
import { supabase } from '../shared/supabaseClient.js';
import { showPopup } from './popupManager.js';
const form=document.querySelector('#question-form'),question=document.querySelector('#question'),answer=document.querySelector('#answer'),cards=document.querySelector('#cards'),send=document.querySelector('#send'),reset=document.querySelector('#reset');
let thanksCount=0,contextResults=[],history=[],lastResultIds=[],lastResultType="comercio",searchMunicipio=null;
const conversation=document.querySelector('#conversation'),intro=document.querySelector('#experience-intro');
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(className)el.className=className;return el;};
function picture(url,className){try{const u=new URL(url);if(u.protocol!=='https:')return null;const img=node('img',null,className);img.src=u.href;img.alt='';img.loading='lazy';img.onerror=()=>img.remove();return img;}catch{return null;}}
const findixiAvatar='https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/loader.png';
const genericAvatar='https://zgjaxanqfkweslkxtayt.supabase.co/storage/v1/object/public/findixi/iconoPerfil.png';
function chatMessage(text,role){
 const row=node('div',null,`chat-row chat-row-${role}`);
 const avatar=node('img',null,'chat-avatar');avatar.alt=role==='user'?'Tú':'Findixi';
 const profile=document.querySelector('#footerImagen');
 avatar.src=role==='assistant'?findixiAvatar:profile?.dataset.profilePhoto==='true'?profile.src:genericAvatar;
 avatar.onerror=()=>{avatar.onerror=null;avatar.src=genericAvatar;};
 const bubble=node('div',null,`chat-bubble chat-${role}`);for(const block of (role==='assistant'?text.split(/\n\s*\n/):[text]))bubble.append(node('p',block));
 const time=node('time',new Date().toLocaleTimeString('es-PR',{hour:'2-digit',minute:'2-digit'}),'chat-time');bubble.append(time);
 row.append(avatar,bubble);return row;
}
function renderRecommendations(data){
 if(!data.sections)return data.cards.map(render);
 return data.sections.map(section=>{
  const group=node('section',null,'recommendation-group');
  const heading=node('div',null,'recommendation-group-heading');heading.append(node('h2',section.label));
  if(section.listing?.ids?.length){
   const href=saveExperienceListing(section);if(href){const link=node('a','Ver listado','action secondary');link.href=href;heading.append(link);}
  }
  group.append(heading,...section.cards.map(render));
  if(!section.cards.length)group.append(node('p','Sin coincidencias para esta búsqueda.'));
  return group;
 });
}
const scrollChat=()=>{const panel=document.querySelector('#chat-scroll');panel.scrollTop=panel.scrollHeight;};
const syncLayout=()=>{const footer=document.querySelector('#footerContainer footer');document.querySelector('.experience-shell').style.setProperty('--chat-footer-height',`${footer?.getBoundingClientRect().height||110}px`);};
const layoutObserver=new ResizeObserver(syncLayout);layoutObserver.observe(document.querySelector('#footerContainer'));
new MutationObserver(()=>{const footer=document.querySelector('#footerContainer footer');if(footer)layoutObserver.observe(footer);syncLayout();document.querySelectorAll('.chat-row-user .chat-avatar').forEach(avatar=>{const profile=document.querySelector('#footerImagen');avatar.src=profile?.dataset.profilePhoto==='true'?profile.src:genericAvatar;});}).observe(document.querySelector('#footerContainer'),{childList:true,subtree:true,attributes:true,attributeFilter:['src','data-profile-photo']});
window.addEventListener('resize',syncLayout);syncLayout();
question.addEventListener('input',()=>{question.style.height='auto';question.style.height=`${Math.min(question.scrollHeight,120)}px`;});
question.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();form.requestSubmit();}});
let positionPromise,lastPosition=null;
function userPosition(){
 if(lastPosition&&Date.now()-lastPosition.at<60000)return Promise.resolve({latitude:lastPosition.latitud,longitude:lastPosition.longitud});
 if(!positionPromise)positionPromise=new Promise(resolve=>{
  if(!navigator.geolocation)return resolve(null);
  navigator.geolocation.getCurrentPosition(p=>{lastPosition={latitud:p.coords.latitude,longitud:p.coords.longitude,at:Date.now()};resolve(p.coords);},()=>resolve(null),{timeout:10000,maximumAge:60000});
 }).finally(()=>{positionPromise=null;});
 return positionPromise;
}
function iconText(tag,text,icon,className){
 const element=node(tag,null,className),glyph=node('i',null,icon);
 glyph.setAttribute('aria-hidden','true');element.append(glyph,document.createTextNode(' '+text));return element;
}
function render(card){
 const article=node('article',null,'card compact-card');
 const media=node('div',null,'card-media');
 const cover=picture(card.portada,'cover');if(cover)media.append(cover);
 const logo=picture(card.logo,'logo');if(logo)media.append(logo);
 const details=node('div',null,'details');
 if(card.nombreSucursal)details.append(node('small',card.nombreSucursal,'card-group'));
 details.append(node('h2',card.nombre));
 const status=iconText('p','Horario no disponible','far fa-clock','card-hours');
 const updateHours=()=>{
  const now=new Date(new Date().toLocaleString('en-US',{timeZone:'America/Puerto_Rico'}));
  const rows=card.horarios||[],today=rows.find(h=>Number(h.diaSemana)===now.getDay());
  if(!today)return;
  const state=evaluarHorarioActual(rows,now.getDay(),String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'));
  if(!today.cerrado&&(!today.apertura||!today.cierre)&&!state.abierto)return;
  status.replaceChildren(iconText('span',state.abierto?'Abierto ahora':'Cerrado ahora','far fa-clock'));
  status.style.color=state.abierto?'#16a34a':'#ef4444';
 };
 updateHours();if(!['playa','lugar','evento'].includes(card.tipo))details.append(status);details.append(iconText('p',card.municipio,'fas fa-map-pin','card-town'));

 if(card.tipo==='evento'){
  article.classList.add('event-card');details.append(iconText('p',formatearFecha(card.fecha),'far fa-calendar-alt'));if(card.horainicio)details.append(iconText('p',formatearHora(card.horainicio),'far fa-clock'));if(card.alternativa)details.append(node('p',card.alternativa,'event-alternative'));if(card.lugar)details.append(node('p',card.lugar));
  if(card.masFechas&&card.ocurrencias?.length){const more=node('details',null,'event-occurrences');more.append(node('summary','Más fechas y lugares'));for(const item of card.ocurrencias.slice(0,8)){const line=[formatearFecha(item.fecha),item.horainicio?formatearHora(item.horainicio):'',item.lugar||item.municipio].filter(Boolean).join(' · ');more.append(node('p',line));}details.append(more);}
 }
 if(card.tipo==='playa'){
  if(card.activities?.length)details.append(node('p',card.activities.join(' · ')));
  if(card.bote===true)details.append(node('p','Acceso en bote'));
  const conditions=node('details',null,'beach-conditions');
  conditions.append(node('summary','Ver condiciones'));
  const timestamp=value=>new Date(value).toLocaleString('es-PR',{timeZone:'America/Puerto_Rico',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  if(card.weather){
   const w=card.weather,weatherLine=node('p','','card-weather');
   const iconURL=obtenerIconoClima(w.icon);
   if(iconURL){const img=document.createElement('img');img.src=iconURL;img.alt='';img.width=24;img.height=24;img.style.cssText='display:inline-block;vertical-align:middle;margin-right:4px';weatherLine.append(img);}
   weatherLine.append(document.createTextNode(`${w.description} · ${w.temperatureF} °F`));details.append(weatherLine);
   conditions.append(node('p',`Viento: ${w.windMph} mph`),node('p',`Clima actualizado: ${timestamp(w.observedAt)}`));
  }
  if(card.marine?.mode==='forecast'){
   const m=card.marine;
   details.append(iconText('p',Number(m.heightFt)<1?'Olas pequeñas previstas':`Oleaje previsto: ~${Number(m.heightFt).toFixed(0)} pies`,'fas fa-water'));
   conditions.append(node('p',`Altura prevista: ${Number(m.heightFt).toFixed(1)} pies`),node('p',`Período: ${Number(m.periodSeconds).toFixed(0)} s · Dirección: ${Number(m.directionDegrees).toFixed(0)}°`),node('p',`Pronóstico para: ${timestamp(m.validAt)}`),node('p',`Calculado: ${timestamp(m.issuedAt)}`));
  }
  if(card.weather||card.marine?.mode==='forecast'){
   article.classList.add('beach-condition-card');
   conditions.append(node('p','El oleaje previsto es una referencia de la zona; no determina las corrientes ni la seguridad para nadar.'));
   article.append(conditions);
  }
 }
 if(card.cocina?.length)details.append(node('p',card.cocina.join(' · ')));
 const distance=iconText('p','Activa tu ubicación para ver el tiempo de viaje','fas fa-car','card-distance');
 if(card.tipo!=='evento'&&card.bote!==true)details.append(distance);
 userPosition().then(position=>{
  if(!position||card.latitud==null||card.longitud==null)return;
  const lat=Number(card.latitud),lon=Number(card.longitud);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<17||lat>19||lon< -68||lon> -65)return;
  const km=calcularDistanciaHaversineKm(position.latitude,position.longitude,lat,lon);
  const {texto}=calcularTiempoEnVehiculo(km);
  distance.replaceChildren(iconText('span','a '+texto+' aprox.','fas fa-car'));
  distance.title='Tiempo estimado desde tu ubicación con el mismo cálculo del listado; no incluye tráfico';
 });
 const actions=node('div',null,'card-actions');
 if(card.tipo==='evento'&&card.boleteria){const ticket=iconText('a','Boletería','fa-solid fa-ticket','action');ticket.href=card.boleteria;ticket.target='_blank';ticket.rel='noopener noreferrer';ticket.title=card.boleteriaNombre||'Comprar boletos';ticket.addEventListener('click',event=>event.stopPropagation());actions.append(ticket);}
 if(card.telefono){
  const digits=String(card.telefono).replace(/[^\d+]/g,'');
  if(digits){const phone=iconText('a',formatearTelefonoDisplay(card.telefono),'fa-solid fa-phone','card-phone');phone.href='tel:'+digits;actions.append(phone);}
 }
 if(card.perfil?.startsWith('/')&&!card.perfil.startsWith('//')){
  const link=node('a',card.nombre,'card-profile-link');link.href=card.perfil;
  link.setAttribute('aria-label','Ver perfil de '+card.nombre);
  details.querySelector('h2').replaceChildren(link);
  article.classList.add('has-profile');
 }
 const lat=Number(card.latitud),lon=Number(card.longitud),hasCoordinates=card.latitud!=null&&card.longitud!=null&&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=17&&lat<=19&&lon>=-68&&lon<=-65;
 const destination=[card.direccion,card.lugar,card.municipio,'Puerto Rico'].filter(Boolean).join(', ');
 const hasEventAddress=card.tipo==='evento'&&Boolean(card.direccion||card.lugar),useCoordinates=hasCoordinates&&!hasEventAddress;
 if(hasCoordinates||hasEventAddress){
  const directions=node('button','Cómo llegar','action secondary');
  directions.type='button';
  directions.addEventListener('click',()=>showPopup({
   title:'Cómo llegar',
   message:'¿Qué aplicación prefieres usar?',
   buttons:[
    {text:'Waze',primary:true,onClick:()=>window.open(useCoordinates?'https://waze.com/ul?ll='+encodeURIComponent(lat+','+lon)+'&navigate=yes':'https://waze.com/ul?q='+encodeURIComponent(destination)+'&navigate=yes','_blank','noopener,noreferrer')},
    {text:'Google Maps',primary:true,onClick:()=>window.open('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(useCoordinates?lat+','+lon:destination)+'&travelmode=driving','_blank','noopener,noreferrer')},
    {text:'Cancelar'}
   ]
  }));
  directions.addEventListener('click',event=>event.stopPropagation());
  actions.append(directions);
 }
 article.append(media,details,actions);
 return article;
}

const memory=createExperienceMemory(document.querySelector('#memory-panel'));
document.querySelector('#memory-settings').addEventListener('click',async()=>{await memory.ready;memory.open();scrollChat();});
memory.ready.then(()=>{if(memory.name)document.querySelector('.welcome').textContent=`¡Hola, ${memory.name}! Cuéntame qué te gustaría hacer y buscamos opciones para ti.`;});
const errors={login_required:'Inicia sesión en Findixi y vuelve a esta página.',openai_configuration_pending:'Estamos terminando de conectar el motor. La conversación todavía no está disponible.',configuration_pending:'Estamos terminando de configurar el piloto.'};
form.addEventListener('submit',async event=>{event.preventDefault();if(send.disabled)return;const text=question.value.trim();if(!text)return;intro.hidden=true;const userMessage=chatMessage(text,'user');conversation.append(userMessage);scrollChat();send.disabled=true;reset.disabled=true;answer.textContent='Un momento…';try{const {data:{session}}=await supabase.auth.getSession();if(!session){answer.textContent=errors.login_required;return;}await userPosition();const response=await fetch('/.netlify/functions/experience-pilot',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({question:text,history,contextIds:lastResultIds,contextType:lastResultType,contextResults,searchMunicipio,thanksCount,userLocation:lastPosition&&Date.now()-lastPosition.at<300000?lastPosition:null}),signal:AbortSignal.timeout(35000)});const data=await response.json();if(!response.ok){answer.textContent=errors[data.error]||(response.status===429?'Espera un minuto antes de volver a consultar.':'No pudimos consultar ahora. Inténtalo nuevamente.');return;}if(data.searchMunicipio)searchMunicipio=data.searchMunicipio;await memory.ready;const message=history.length===0&&memory.name?`¡Hola, ${memory.name}! ${data.message}`:data.message;if(data.cards?.length){contextResults=data.cards.map(card=>({id:card.id,tipo:card.tipo||data.tipo||"comercio"}));lastResultIds=data.cards.map(card=>card.id);lastResultType=data.tipo||"comercio";}else if(!data.keepContext){contextResults=[];lastResultIds=[];lastResultType=data.tipo||"comercio";}answer.textContent='';conversation.append(chatMessage(message,'assistant'));question.placeholder='Escribe tu respuesta…';if(!data.keepContext)cards.replaceChildren(...renderRecommendations(data));if(data.social)thanksCount++;else history=[...history,text].slice(-4);question.value='';await memory.afterReply(text,message);}catch{answer.textContent='No pudimos conectar. Inténtalo nuevamente.';}finally{send.disabled=false;reset.disabled=false;question.style.height='auto';scrollChat();}});
reset.addEventListener('click',()=>{thanksCount=0;contextResults=[];history=[];lastResultIds=[];lastResultType="comercio";searchMunicipio=null;conversation.replaceChildren();intro.hidden=false;question.placeholder='¿Qué te gustaría hacer?';question.value='';answer.textContent='';cards.replaceChildren();question.focus();});

try { const draft=sessionStorage.getItem('findixiExperienceDraft'); if(draft){question.value=draft.slice(0,1000);sessionStorage.removeItem('findixiExperienceDraft');if(question.value.trim())form.requestSubmit();} } catch {}
