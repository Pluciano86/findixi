import { collectSwan } from './beach-swan.js';
// Limited recovery: approved pilot only; provider timestamps remain authoritative.
export const PILOT_IDS = [302,315,320,331,338,382,391,463,499,525,556];
export const VERSION = 'findixi_source_recovery_v1';
export const BUOY_URL = 'https://dm3.caricoos.org/erddap/tabledap/CARICOOSRincon_wave_rt.json?time,latitude,longitude,waveHs,waveTp,waveDp,waveFlagPrimary&time=max(time)';
export function distanceMeters(a,b){
 const r=x=>Number(x)*Math.PI/180;
 if(![a.lat,a.lon,b.lat,b.lon].every(v=>v!==null&&Number.isFinite(Number(v))))return Infinity;
 const d=Math.sin(r(b.lat-a.lat)/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(r(b.lon-a.lon)/2)**2;
 return 12742000*Math.asin(Math.sqrt(Math.min(1,d)));
}
export function normalizeAlerts(data,now){
 if(!Array.isArray(data?.features))throw Error('invalid_nws_response');
 return data.features.map(f=>f.properties).filter(p=>p&&Date.parse(p.expires)>now&&Date.parse(p.effective)<=now&&(!p.ends||Date.parse(p.ends)>now)).map(p=>({
  event:p.event,severity:p.severity,headline:p.headline,description:p.description,area_description:p.areaDesc,
  effective_at:p.effective,onset_at:p.onset,ends_at:p.ends,expires_at:p.expires,fetched_at:new Date(now).toISOString(),source_uri:'https://api.weather.gov/alerts/active',
  alert_classification:/rip current/i.test(p.event)?'rip_current':/high surf/i.test(p.event)?'high_surf':/tsunami/i.test(p.event)?'tsunami':/storm surge/i.test(p.event)?'storm_surge':/hurricane/i.test(p.event)?'hurricane':'weather'
 }));
}
export function normalizeBuoy(data,point,now){
 const t=data?.table;if(!t||!Array.isArray(t.rows)||t.rows.length!==1)return null;
 const get=k=>t.rows[0][t.columnNames.indexOf(k)],unit=k=>t.columnUnits[t.columnNames.indexOf(k)];
 const observed=Date.parse(get('time')),precision=distanceMeters(point,{lat:get('latitude'),lon:get('longitude')});
 const hs=get('waveHs');
 if(!Number.isFinite(observed)||now-observed>7200000||observed>now+300000||precision>10000||get('waveFlagPrimary')!==1||unit('waveHs')!=='meter'||!Number.isFinite(hs)||hs<0)return null;
 return {kind:'marine_wave_observation',mode:'buoy_observation',observed_at:new Date(observed).toISOString(),fetched_at:new Date(now).toISOString(),expires_at:new Date(observed+7200000).toISOString(),confidence:80,
 values:{wave_height_ft:hs*3.28084,wave_period_s:unit('waveTp')==='second'?get('waveTp'):null},
 source_ref:{source_uri:BUOY_URL,dataset_id:'CARICOOSRincon_wave_rt',geographic_precision_meters:precision,point_latitude:get('latitude'),point_longitude:get('longitude')}};
}
async function getJson(url,fetchImpl){
 const response=await fetchImpl(url,{redirect:'error',headers:{'User-Agent':'Findixi/test.findixi.com (info@findixi.com)','Accept':'application/json'},signal:AbortSignal.timeout(6500)});
 if(!response.ok)throw Error('provider_unavailable');return response.json();
}
export async function collectSnapshot(beach,{now=Date.now(),fetchImpl=fetch}={}){
 const point={lat:Number(beach.latitud),lon:Number(beach.longitud)};
 const [nws,buoy,swan]=await Promise.allSettled([
  getJson(`https://api.weather.gov/alerts/active?point=${point.lat},${point.lon}`,fetchImpl).then(d=>normalizeAlerts(d,now)),
  beach.id===499&&beach.caricoos_enabled?getJson(BUOY_URL,fetchImpl).then(d=>normalizeBuoy(d,point,now)):Promise.resolve(null),
  beach.caricoos_enabled?collectSwan(beach,{now,fetchImpl}):Promise.resolve(null)
 ]);
 const forecast=swan.status==='fulfilled'?swan.value:null;
 const alerts=nws.status==='fulfilled'?nws.value:[],marine=buoy.status==='fulfilled'?buoy.value:null;
 return {entity_id:beach.entity_id,snapshot_version:VERSION,computed_at:new Date(now).toISOString(),snapshot_at:new Date(now).toISOString(),expires_at:new Date(now+40*60000).toISOString(),status:'partial',
 alerts_json:alerts,marine_json:{...(marine?{wave_observation:marine}:{}),...(forecast?{wave_forecast:forecast}:{})},missing_inputs_json:[...(nws.status==='rejected'?['nws_alerts_unavailable']:[]),...(!marine?['local_marine_observation_unavailable']:[])],
 metadata:{pipeline:VERSION,playa_id:beach.id,nws_status:nws.status==='fulfilled'?'ok':'unavailable',marine_status:marine?'ok':forecast?'forecast_only':'unavailable',swimming_safety_confirmed:false}};
}
export async function approvedBeaches(db){
 const read=async q=>{const r=await q;if(r.error)throw Error('source_sync_database_read');return r.data||[];};
 const [beaches,links,entities,bindings,sources]=await Promise.all([
  read(db.from('playas').select('id,latitud,longitud').in('id',PILOT_IDS).eq('activo',true).eq('experience_engine_enabled',true)),
  read(db.from('experience_playa_links').select('playa_id,entity_id').in('playa_id',PILOT_IDS).eq('review_status','verificada').eq('coordinates_status','verificada').eq('relation_type','part_of')),
  read(db.from('experience_entities').select('id,latitude,longitude').eq('verification_status','verificada').eq('coordinates_status','verificada')),
  read(db.from('experience_entity_source_bindings').select('entity_id,source_id').eq('applicable',true).eq('review_status','verificada')),
  read(db.from('experience_sources').select('id,source_key').eq('active',true))
 ]);
 return beaches.flatMap(p=>{
  const l=links.filter(l=>l.playa_id===p.id);if(l.length!==1)return [];
  const e=entities.find(e=>e.id===l[0].entity_id);
  const nws=sources.find(s=>s.source_key==='nws');
  if(!e||!nws||!bindings.some(b=>b.entity_id===e.id&&b.source_id===nws.id)||distanceMeters({lat:p.latitud,lon:p.longitud},{lat:e.latitude,lon:e.longitude})>250)return [];
  const cari=sources.find(s=>s.source_key==='caricoos');
  return [{...p,entity_id:e.id,caricoos_enabled:!!cari&&bindings.some(b=>b.entity_id===e.id&&b.source_id===cari.id)}];
 });
}
