const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function resolveSearchLocation(value,towns,areas){
 const name=norm(value);
 if(!name)return null;
 const town=towns.find(t=>norm(t.nombre)===name);
 if(town)return {label:town.nombre,regional:false,towns:[town.nombre]};
 const alias=name.replace(/^(?:el |la )?(?:area|zona|region)\s+/,'').replace(/^metropolitana$/,'metro');
 const area=areas.find(a=>norm(a.nombre)===alias||norm(a.slug)===alias);
 if(!area)return null;
 return {label:area.nombre,regional:true,towns:towns.filter(t=>Number(t.idArea)===Number(area.idArea)).map(t=>t.nombre)};
}
export function withinSearchLocation(rows,scope){
 if(!scope)return rows;
 const names=new Set(scope.towns.map(norm));
 return rows.filter(row=>names.has(norm(row.municipio)));
}

// "Este" is also a demonstrative; require geographic context before overriding the model.
export function explicitSearchAreas(question,areas){
 const text=norm(question).replace(/[^a-z0-9]+/g,' ').trim();
 return areas.filter(area=>[area.nombre,area.slug].filter(Boolean).some(value=>{
  const name=norm(value).replace(/[^a-z0-9]+/g,' ').trim();
  if(!name)return false;
  if(name==='este'||name==='centro'){
   if(text===name)return true;
   const pattern=new RegExp('\\b(?:el|al|del|area|zona|region|costa) '+name+'\\b');
   // A named venue (centro de bellas artes) is not the central region.
   return pattern.test(text)&&!(name==='centro'&&/\bcentro de (?!puerto rico\b|la isla\b)/.test(text));
  }
  return (' '+text+' ').includes(' '+name+' ');
 }));
}
