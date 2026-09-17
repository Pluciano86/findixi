import { supabase } from '../shared/supabaseClient.js';
export function createExperienceMemory(container) {
 let user=null, consent=null, messages=[], preferences='', busy=false, loaded=false;
 const sessionMessages=[];
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const status=el('p');status.setAttribute('role','status');
 const controls=el('div');container.append(controls,status);
 const api={name:'',ready:null,afterReply,open:()=>render(true)};
 async function write(nextConsent,nextMessages,nextPreferences){
  const {data:{session}}=await supabase.auth.getSession();
  if(!user||session?.user.id!==user.id)throw Error('session');
  const {error}=await supabase.from('fe_user_memory').upsert({user_id:user.id,consent:nextConsent,messages:nextMessages.slice(-100),preferences:nextPreferences.slice(0,1000),updated_at:new Date().toISOString()});
  if(error)throw error;
  consent=nextConsent;messages=nextMessages.slice(-100);preferences=nextPreferences;
 }
 function button(label,action){const b=el('button',label);b.type='button';b.onclick=async()=>{if(busy)return;busy=true;b.disabled=true;try{await action();}catch{status.textContent='No se pudo guardar el cambio. Inténtalo nuevamente.';}finally{busy=false;b.disabled=false;}};return b;}
 function render(settings=false){
  controls.replaceChildren();status.textContent='';container.hidden=!user||!loaded;
  if(!user||!loaded)return;
  if(settings){
   controls.append(el('p','Historial y preferencias'));
   const label=el('label','¿Qué quieres que Findixi tenga en cuenta?');const input=el('textarea');input.maxLength=1000;input.value=preferences;input.placeholder='Ej.: prefiero comida criolla y lugares pet friendly';label.append(input);controls.append(label);
   controls.append(button('Guardar preferencias',async()=>{await write(true,messages,input.value);status.textContent='Preferencias guardadas.';}));
   controls.append(button('Ver historial',async()=>{const list=el('div');list.className='saved-history';for(const message of messages){if(typeof message.text==='string')list.append(el('p',`${message.role==='user'?'Tú':'Findixi'}: ${message.text}`));}controls.append(list);}));
   controls.append(button('Borrar historial',async()=>{await write(true,[],preferences);sessionMessages.length=0;render(true);status.textContent='Historial borrado.';}));
   controls.append(button('Cerrar',async()=>{container.hidden=true;}));
  }else container.hidden=true;
 }
 async function afterReply(question,reply){
  await api.ready;
  if(!user||!loaded)return;
  const pair=[{role:'user',text:question.slice(0,1000)},{role:'assistant',text:reply.slice(0,1500)}];sessionMessages.push(...pair);
  {try{await write(true,[...messages,...pair],preferences);}catch{container.hidden=false;status.textContent='Esta respuesta no se pudo guardar en el historial.';}}
 }
 api.ready=(async()=>{
  const {data:{session}}=await supabase.auth.getSession();user=session?.user;if(!user)return;
  const [profile,memory]=await Promise.all([supabase.from('usuarios').select('nombre').eq('id',user.id).maybeSingle(),supabase.from('fe_user_memory').select('consent,messages,preferences').eq('user_id',user.id).maybeSingle()]);
  api.name=String(profile.data?.nombre||'').trim().split(/\s+/)[0];
  if(memory.error)return;
  if(memory.data){consent=memory.data.consent;messages=memory.data.messages||[];preferences=memory.data.preferences||'';}loaded=true;
 })().catch(()=>{});
 supabase.auth.onAuthStateChange((event,session)=>{if(user&&session?.user.id!==user.id){user=null;messages=[];sessionMessages.length=0;api.name='';container.hidden=true;controls.replaceChildren();}});
 return api;
}
