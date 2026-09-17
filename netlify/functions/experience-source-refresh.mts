import { createClient } from '@supabase/supabase-js';
import { approvedBeaches, collectSnapshot, PILOT_IDS } from './_shared/beach-source-sync.js';
// Netlify invokes scheduled functions internally; there is no public refresh endpoint.
export const config = { schedule: '*/5 * * * *' };
export default async (_request, context) => {
 const env=(name:string)=>Netlify.env.get(name)||'';
 if(context.site.id!=='f935bb3d-8904-43cc-b67d-448fde9f7b5b')return;
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 const now=Date.now(),slot=Math.floor(now/300000)%6;
 const ids=PILOT_IDS.slice(slot*2,slot*2+2);
 const beaches=(await approvedBeaches(db)).filter(p=>ids.includes(p.id));
 const snapshots=await Promise.all(beaches.map(p=>collectSnapshot(p,{now})));
 if(snapshots.length){const {error}=await db.from('experience_condition_snapshots').insert(snapshots);if(error)throw Error('source_snapshot_write_failed');}
 console.info(JSON.stringify({job:'experience-source-refresh',checked:ids.length,approved:beaches.length,written:snapshots.length}));
};
