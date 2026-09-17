// Same-tab handoff retains the exact matching IDs, including event occurrences.
export function saveExperienceListing(section){
 const paths={comida:'Comercios',jangueo:'Comercios',turismo:'Lugares',parques:'Lugares',playas:'Playas',eventos:'Eventos'};
 if(!paths[section.category]||!section.listing?.ids?.length)return null;
 const key=crypto.randomUUID();
 try{sessionStorage.setItem('fe-listing-'+key,JSON.stringify({...section.listing,label:section.labelFilters,created:Date.now()}));return `/listado${paths[section.category]}.html?fe=${encodeURIComponent(key)}`;}catch{return null;}
}
export function readExperienceListing(){
 const key=new URLSearchParams(location.search).get('fe');if(!key)return null;
 try{const data=JSON.parse(sessionStorage.getItem('fe-listing-'+key));if(!Array.isArray(data?.ids)||Date.now()-data.created>86400000)return null;return {...data,ids:data.ids.filter(Number.isSafeInteger)};}catch{return null;}
}
export const experienceListing=readExperienceListing();
export function filterExperienceRows(rows){return experienceListing?rows.filter(row=>experienceListing.ids.includes(Number(row.id))):rows;}
export function filterExperienceDates(rows){return experienceListing?.occurrences?rows.filter(row=>experienceListing.occurrences.includes(Number(row.id))):rows;}
function showFilter(){
 if(!new URLSearchParams(location.search).has('fe'))return;
 const banner=document.createElement('div');banner.style.cssText='margin:12px;padding:12px;border-radius:12px;background:#e5f0f2;color:#07566b;text-align:center';
 banner.append(document.createTextNode(experienceListing?`Filtros de Findixi: ${experienceListing.label}`:'La búsqueda anterior ya no está disponible. Vuelve a Findixi Experience para repetirla.'));
 const link=document.createElement('a');link.href=experienceListing?location.pathname:'/experience.html';link.textContent=experienceListing?' · Quitar filtros':' · Volver';link.style.textDecoration='underline';banner.append(link);
 const main=document.querySelector('main');(main||document.body).prepend(banner);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',showFilter,{once:true});else showFilter();
