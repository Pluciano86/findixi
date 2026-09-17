import { distanceMeters } from './beach-source-sync.js';
import { freshEvidence } from './recommendation-engine.js';
// Read existing approved mappings only. Do not enable beaches or invoke maintenance services.
export async function loadBeachEvidence(db,rows,now=Date.now()){
 const result=new Map(),ids=rows.filter(p=>p.experience_engine_enabled===true).map(p=>p.id);
 if(!ids.length)return result;
 const read=async q=>{const {data,error}=await q;if(error)throw Error('beach_evidence_unavailable');return data||[];};
 try{
  const links=await read(db.from('experience_playa_links').select('playa_id,entity_id,review_status,coordinates_status,relation_type').in('playa_id',ids).eq('review_status','verificada').eq('coordinates_status','verificada'));
  const approved=links.filter(l=>l.review_status==='verificada'&&l.coordinates_status==='verificada'&&l.relation_type==='part_of');
  const entityIds=[...new Set(approved.map(l=>l.entity_id))];if(!entityIds.length)return result;
  const [entities,snapshots]=await Promise.all([
   read(db.from('experience_entities').select('id,verification_status,coordinates_status,latitude,longitude').in('id',entityIds).eq('verification_status','verificada').eq('coordinates_status','verificada')),
   read(db.from('experience_condition_snapshots').select('id,entity_id,status,computed_at,expires_at,marine_json,alerts_json,metadata').in('entity_id',entityIds).gt('expires_at',new Date(now).toISOString()).order('computed_at',{ascending:false}).limit(100))
  ]);
  for(const link of approved){
   if(approved.filter(l=>l.playa_id===link.playa_id).length!==1)continue;
   if(!entities.some(e=>e.id===link.entity_id&&e.verification_status==='verificada'&&e.coordinates_status==='verificada'))continue;
   const entity=entities.find(e=>e.id===link.entity_id),beach=rows.find(p=>p.id===link.playa_id);
   if(distanceMeters({lat:beach?.latitud,lon:beach?.longitud},{lat:entity?.latitude,lon:entity?.longitude})>250)continue;
   const snapshot=snapshots.find(s=>s.entity_id===link.entity_id&&['partial','ready','ready_with_warnings'].includes(s.status)&&freshEvidence(s,now));
   result.set(link.playa_id,normalizeBeachEvidence(snapshot,now));
  }
 }catch{for(const id of ids)result.set(id,{status:'unavailable',alerts:[],marine:[]});}
 return result;
}
export function normalizeBeachEvidence(snapshot,now=Date.now()){
 if(!snapshot||!freshEvidence(snapshot,now))return {status:'missing',alerts:[],marine:[]};
 const alerts=(Array.isArray(snapshot.alerts_json)?snapshot.alerts_json:[]).filter(a=>freshEvidence(a,now,3600000)&&Date.parse(a.effective_at)<=now&&(!a.onset_at||Date.parse(a.onset_at)<=now)&&(!a.ends_at||Date.parse(a.ends_at)>now)).map(a=>({event:a.event,classification:a.alert_classification,severity:a.severity,source:a.source_uri,expires:a.expires_at}));
 const marine=Object.values(snapshot.marine_json||{}).filter(v=>v&&v.observed_at&&['buoy_observation','station_observation','observation'].includes(v.mode)&&freshEvidence(v,now)&&Number.isFinite(v.source_ref?.geographic_precision_meters)&&v.source_ref.geographic_precision_meters<=10000&&Number(v.confidence)>=70&&v.mode!=='wave_forecast').map(v=>({kind:v.kind,mode:v.mode,values:v.values,observed:v.observed_at,source:v.source_ref?.source_uri,precisionMeters:v.source_ref.geographic_precision_meters}));
 const f=snapshot.marine_json?.wave_forecast;
 const forecast=f?.mode==='wave_forecast'&&freshEvidence(f,now)&&Date.parse(f.forecast_at)<=now+300000&&now-Date.parse(f.forecast_at)<=72*3600000&&Math.abs(Date.parse(f.valid_at)-now)<=2*3600000&&Number.isFinite(f.values?.wave_height_ft)&&Number.isFinite(f.source_ref?.geographic_precision_meters)&&f.source_ref.geographic_precision_meters<=350?f:null;
 const alertsStatus=snapshot.metadata?.nws_status==='ok'&&freshEvidence(snapshot,now,3600000)?'checked':'unavailable';
 return {status:marine.length||forecast?'partial':'missing',alerts,alertsStatus,marine,forecast};
}
