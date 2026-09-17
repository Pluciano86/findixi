// Pilot domain rules: unknown is never treated as an affirmative answer.
export const FILTERS = ['menu_infantil','sillas_altas','cambiador','bano_accesible','acepta_grupos','opciones_veganas','sirve_almuerzo','sirve_cena'];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function menuMean(products) {
  const seen = new Set();
  const prices = [];
  for (const p of products) {
    if (!p.activo || !(Number(p.precio) > 0) || String(p.precio_texto || '').trim() || /^(complementos|acompañantes adicionales)$/i.test(String(p.seccion).trim()) || /^add-on:/i.test(p.nombre)) continue;
    const key = JSON.stringify([String(p.seccion).trim(),p.nombre,p.descripcion,p.precio,p.variantes]);
    if (seen.has(key)) continue;
    seen.add(key); prices.push(Number(p.precio));
  }
  return prices.length ? {valor: Math.round(prices.reduce((a,b)=>a+b,0)/prices.length*100)/100, cantidad: prices.length} : null;
}
export function selectRestaurants(restaurants, intent) {
  if (intent.fuera_de_alcance) return [];
  // Ambience is a preference for ranking, not a literal catalog requirement.
  const ambience = /^(relax|relajarse|sin ruido|ambiente tranquilo|tranquil[oa]s?|tranquilamente|calmad[oa]|relajad[oa]|acogedor[a]?|romantic[oa]|intim[oa]|conversar|hablar|pareja|silencios[oa])$/;
  const softTerms = [...(intent.preferencias_ambiente || []), ...(intent.terminos || []).filter(t => ambience.test(normalize(t)))];
  const hardTerms = (intent.terminos || []).filter(t => !ambience.test(normalize(t)));
  const score = r => {
    const description=normalize(r.descripcion);
    return softTerms.length && /tranquil|relajad|intim|romantic/.test(description) ? 1 : 0;
  };
  return restaurants.filter(r => {
    if (intent.municipio && normalize(r.municipio) !== normalize(intent.municipio)) return false;
    const searchable = normalize([r.nombre,r.descripcion,...(r.experience.tipos_cocina || []),...r.amenidades].join(' '));
    if (intent.cocina && !searchable.includes(normalize(intent.cocina))) return false;
    if (hardTerms.length && !hardTerms.some(t => searchable.includes(normalize(t)))) return false;
    if (intent.mascotas && !r.amenidades.some(a => normalize(a) === 'pet friendly')) return false;
    if (intent.vista_al_mar && !r.amenidades.some(a => normalize(a) === 'vista al mar')) return false;
    return FILTERS.every(f => !intent[f] || r.experience[f] === true);
  }).sort((a,b)=>score(b)-score(a));
}
export const intentSchema = {
 type:'object',additionalProperties:false,
 properties:{referencia:{type:['string','null']},busca_comida:{type:'boolean'},preferencias_ambiente:{type:'array',items:{type:'string'},maxItems:6},terminos:{type:'array',items:{type:'string'},maxItems:6},municipio:{type:['string','null']},cocina:{type:['string','null']},mascotas:{type:'boolean'},vista_al_mar:{type:'boolean'},fuera_de_alcance:{type:'boolean'},aclaracion:{type:['string','null']},...Object.fromEntries(FILTERS.map(k=>[k,{type:'boolean'}]))},
 required:['referencia','busca_comida','preferencias_ambiente','terminos','municipio','cocina','mascotas','vista_al_mar','fuera_de_alcance','aclaracion',...FILTERS]
};
export function validIntent(value) {
 return value && typeof value === 'object' && Object.keys(value).length === intentSchema.required.length && intentSchema.required.every(k => {
   if (!Object.hasOwn(value,k)) return false;
   if(k === 'terminos' || k === 'preferencias_ambiente') return Array.isArray(value[k]) && value[k].length <= 6 && value[k].every(t=>typeof t==='string' && t.trim().length>0 && t.length<=80);
   return ['referencia','municipio','cocina','aclaracion'].includes(k) ? value[k] === null || (typeof value[k] === 'string' && value[k].length <= 300) : typeof value[k] === 'boolean';
 });
}
