import { supabase } from '../shared/supabaseClient.js';
import { frequentSearches } from './experienceSearchTags.js';

const form=document.querySelector('#homeExperienceForm');
const input=document.querySelector('#homeExperienceQuestion');
const title=document.querySelector('#homeExperienceTitle');
const historyPanel=document.querySelector('#homeExperienceHistory');
const tags=document.querySelector('#homeExperienceTags');
let revision=0;
function fitTags(){
 if(historyPanel.hidden)return;
 const buttons=[...tags.children];
 buttons.forEach(button=>button.hidden=false);
 const gap=parseFloat(getComputedStyle(tags).columnGap)||6;
 let used=0,full=false;
 buttons.forEach((button,index)=>{
  const width=button.getBoundingClientRect().width;
  if(full||used+width+(index?gap:0)>tags.clientWidth){button.hidden=true;full=true;}
  else used+=width+(index?gap:0);
 });
}
new ResizeObserver(fitTags).observe(tags);
document.fonts?.ready.then(fitTags);
function openExperience(text){
  if(!text.trim()){input.focus();return;}
  try{sessionStorage.setItem('findixiExperienceDraft',text.slice(0,1000));}catch{}
  window.location.assign('experience.html');
}
form.addEventListener('submit',event=>{event.preventDefault();openExperience(input.value.trim());});

async function personalize(user){
  const current=++revision;
  title.textContent='Pregúntame qué hacer o a dónde ir.';
  tags.replaceChildren();
  historyPanel.hidden=true;
  if(!user)return;
  try{
    const [profile,memory]=await Promise.all([
      supabase.from('usuarios').select('nombre').eq('id',user.id).maybeSingle(),
      supabase.from('fe_user_memory').select('consent,messages').eq('user_id',user.id).maybeSingle()
    ]);
    if(current!==revision)return;
    const name=String(profile.data?.nombre||'').trim().split(/\s+/)[0];
    if(name)title.textContent=name+', pregúntame qué hacer o a dónde ir.';
    if(memory.error||!memory.data?.consent)return;
    for(const item of frequentSearches(memory.data.messages)){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=item.label;
      button.title=item.question;
      button.addEventListener('click',()=>openExperience(item.question));
      tags.append(button);
    }
    historyPanel.hidden=!tags.childElementCount;
    requestAnimationFrame(fitTags);
  }catch{/* The search stays available when personalization cannot load. */}
}
// Defer database work outside the auth callback; clear previous account data immediately.
supabase.auth.onAuthStateChange((_event,session)=>{
  revision++;
  title.textContent='Pregúntame qué hacer o a dónde ir.';
  tags.replaceChildren();
  historyPanel.hidden=true;
  const scheduled=revision;
  setTimeout(()=>{if(scheduled===revision)void personalize(session?.user);},0);
});
window.addEventListener('pageshow',()=>{
  const current=revision;
  supabase.auth.getSession().then(({data})=>{
    if(current===revision)void personalize(data.session?.user);
  }).catch(()=>{});
});
