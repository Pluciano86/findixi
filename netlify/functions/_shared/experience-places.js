const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function selectPlaces(rows,intent){
 const terms=(intent.terminos||[]).filter(t=>! /^(lugares?|turisticos?|lugares turisticos|turismo|visitar|atracciones?)$/.test(norm(t)));
 return rows.filter(p=>p.activo===true&&p.cerradoTemporalmente!==true&&(!intent.municipio||norm(p.municipio)===norm(intent.municipio))&&(!terms.length||terms.some(t=>norm(p.nombre+' '+p.descripcion).includes(norm(t)))));
}
export function placeCard(p){return {tipo:'lugar',id:p.id,nombre:p.nombre,municipio:p.municipio,portada:p.imagen,telefono:p.telefono,latitud:p.latitud,longitud:p.longitud,perfil:`/perfilLugar.html?id=${p.id}`,horarios:[],logo:null};}
