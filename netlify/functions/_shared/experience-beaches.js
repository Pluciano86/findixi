const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function selectBeaches(rows,{municipio,nombre,actividades=[]}){
 return rows.filter(row=>(!municipio||normalize(row.municipio)===normalize(municipio))&&(!nombre||normalize(row.nombre).replace(/ /g,'').includes(normalize(nombre).replace(/^(playa|balneario)\s+/, '').replace(/ /g,'')))&&actividades.every(key=>row[key]===true));
}
export function beachCard(row){return {tipo:'playa',id:row.id,nombre:row.nombre,municipio:row.municipio,portada:row.imagen,latitud:row.latitud,longitud:row.longitud,perfil:`/perfilPlaya.html?id=${row.id}`,costa:row.costa,horarios:[],logo:null,telefono:null};}
