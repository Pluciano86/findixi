// Shared ordering contract. Unknown evidence never earns a positive score.
export function rankCandidates(candidates,weights={}){
 return candidates.filter(c=>!c.excluded).map(c=>({...c,rank:Object.entries(weights).reduce((total,[key,weight])=>{
  const value=c.signals?.[key];return total+(Number.isFinite(value)?Math.max(0,Math.min(1,value))*weight:0);
 },0)})).sort((a,b)=>b.rank-a.rank||Number(a.row.id)-Number(b.row.id));
}
export function freshEvidence(row,now=Date.now(),maxAgeMs=7200000){
 const observed=Date.parse(row?.observed_at||row?.computed_at||row?.fetched_at);
 const expires=Date.parse(row?.expires_at);
 return Number.isFinite(observed)&&observed<=now+300000&&now-observed<=maxAgeMs&&Number.isFinite(expires)&&expires>now;
}
