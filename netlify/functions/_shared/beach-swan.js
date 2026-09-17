const BASE='https://dm3.caricoos.org/erddap/';
export const SWAN_INFO=BASE+'info/SWAN_HighRes_PR/index.json';
const HOUR=3600000;
let metadataCache=null,metadataRequest=null;
export function modelRun(info,now){
 const attrs=Object.fromEntries((info?.table?.rows||[]).filter(r=>r[1]==='NC_GLOBAL').map(r=>[r[2],r[4]]));
 const m=String(attrs.runstartdate||'').match(/^(\d{4})(\d{2})(\d{2})\.(\d{2})(\d{2})$/);
 if(!m)return null;
 const issued=Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z`);
 if(!Number.isFinite(issued)||issued>now+300000||now-issued>72*HOUR||Date.parse(attrs.time_coverage_end)<now)return null;
 return issued;
}
const meters=(a,b)=>{const r=Math.PI/180,x=(a.lat-b.lat)*r,y=(a.lon-b.lon)*r;return 12742000*Math.asin(Math.sqrt(Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2));};
export function swanURL(point,now){
 const time=new Date(Math.floor(now/HOUR)*HOUR).toISOString();
 const slice=`[(${time})][(${(point.lat-.004).toFixed(6)}):1:(${(point.lat+.004).toFixed(6)})][(${(point.lon-.004).toFixed(6)}):1:(${(point.lon+.004).toFixed(6)})]`;
 return BASE+'griddap/SWAN_HighRes_PR.json?'+['hs','tp','dir'].map(v=>v+slice).join(',');
}
export function normalizeSwan(data,point,issued,now,source){
 if(!Number.isFinite(issued)||now-issued>72*HOUR||issued>now+300000)return null;
 const t=data?.table;if(!t||!Array.isArray(t.rows))return null;
 const idx=k=>t.columnNames.indexOf(k),unit=k=>t.columnUnits[idx(k)];
 if(unit('hs')!=='meters'||unit('tp')!=='seconds'||unit('dir')!=='degrees_true')return null;
 const candidates=t.rows.map(r=>({valid:Date.parse(r[idx('time')]),lat:r[idx('latitude')],lon:r[idx('longitude')],height:r[idx('hs')],period:r[idx('tp')],direction:r[idx('dir')]})).filter(r=>[r.lat,r.lon,r.height,r.period,r.direction,r.valid].every(Number.isFinite)&&r.height>=0&&r.height<=30&&r.period>0&&r.period<=40&&r.direction>=0&&r.direction<=360&&Math.abs(r.valid-now)<=2*HOUR&&r.valid>=issued).map(r=>({...r,distance:meters(point,r)})).filter(r=>r.distance<=350).sort((a,b)=>a.distance-b.distance);
 const r=candidates[0];if(!r)return null;
 return {kind:'marine_wave_forecast',mode:'wave_forecast',forecast_at:new Date(issued).toISOString(),valid_at:new Date(r.valid).toISOString(),fetched_at:new Date(now).toISOString(),expires_at:new Date(Math.min(now+40*60000,r.valid+2*HOUR,issued+72*HOUR)).toISOString(),values:{wave_height_ft:r.height*3.28084,wave_period_s:r.period,wave_direction_deg:r.direction},source_ref:{source_uri:source,dataset_id:'SWAN_HighRes_PR',point_latitude:r.lat,point_longitude:r.lon,geographic_precision_meters:r.distance},confidence:70};
}
export async function collectSwan(beach,{now=Date.now(),fetchImpl=fetch}={}){
 const get=async url=>{const r=await fetchImpl(url,{redirect:'error',signal:AbortSignal.timeout(8500)});if(!r.ok)throw Error('swan_unavailable');return r.json();};
 try{
  let info;
  if(fetchImpl===fetch){
   if(metadataCache&&now-metadataCache.at<10*60000)info=metadataCache.info;
   else {
    if(!metadataRequest)metadataRequest=get(SWAN_INFO).then(info=>{metadataCache={info,at:now};return info;}).finally(()=>{metadataRequest=null;});
    info=await metadataRequest;
   }
  }else info=await get(SWAN_INFO);
  const issued=modelRun(info,now);if(issued===null)return null;
  const point={lat:Number(beach.latitud),lon:Number(beach.longitud)};
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return null;
  const url=swanURL(point,now);return normalizeSwan(await get(url),point,issued,now,url);
 }catch{return null;}
}
