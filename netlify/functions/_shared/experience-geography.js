const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function coordinates(row){
 const {latitud, longitud}=row;
 if(latitud==null||longitud==null||String(latitud).trim()===''||String(longitud).trim()==='')return null;
 const lat=Number(latitud),lon=Number(longitud);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=17&&lat<=19&&lon>=-68&&lon<=-65?[lat,lon]:null;
}
export function resolveLandmark(rows,name,municipio){
 const query=norm(name);
 if(!query)return [];
 const candidates=rows.filter(r=>r.activo!==false&&(!municipio||norm(r.municipio)===norm(municipio)));
 const exact=candidates.filter(r=>norm(r.nombre)===query);
 const beachName=value=>norm(value).replace(/^(playa|balneario)\s+/,'').replace(/ /g,'');
 const beachMatches=candidates.filter(r=>r.tipo==='playa'&&beachName(r.nombre)===beachName(name));
 const matches=exact.length?exact:beachMatches.length?beachMatches:candidates.filter(r=>norm(r.nombre).includes(query));
 return [...new Map(matches.map(r=>[[norm(r.nombre),norm(r.municipio),r.latitud,r.longitud].join('|'),r])).values()];
}
export function nearbyMerchants(rows,landmark,radiusKm=2){
 const origin=coordinates(landmark);
 if(!origin)return [];
 const radians=v=>v*Math.PI/180;
 return rows.flatMap(row=>{
  const point=coordinates(row);if(!point)return [];
  const dlat=radians(point[0]-origin[0]),dlon=radians(point[1]-origin[1]);
  const a=Math.sin(dlat/2)**2+Math.cos(radians(origin[0]))*Math.cos(radians(point[0]))*Math.sin(dlon/2)**2;
  const distance=6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
  return distance<=radiusKm?[{...row,distancia_km:distance}]:[];
 }).sort((a,b)=>a.distancia_km-b.distancia_km);
}

export function nearestCatalogTown(towns,origin){
 const point=coordinates(origin||{});if(!point)return null;
 const radians=v=>v*Math.PI/180;
 let nearest=null;
 for(const town of towns){
  const target=coordinates(town);if(!target)continue;
  const dlat=radians(target[0]-point[0]),dlon=radians(target[1]-point[1]);
  const a=Math.sin(dlat/2)**2+Math.cos(radians(point[0]))*Math.cos(radians(target[0]))*Math.sin(dlon/2)**2;
  const distance=6371*2*Math.asin(Math.sqrt(Math.min(1,a)));
  if(!nearest||distance<nearest.distancia_km)nearest={...town,distancia_km:distance};
 }
 return nearest;
}
