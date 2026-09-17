// Summarize only themes actually present in opted-in history. Never seed fake history.
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const themes=[
  [/\b(vista al mar|frente al mar|junto al mar)\b/,'Vista al mar'],
  [/\b(pasta|pastas)\b/,'Pastas'],
  [/\b(mi pareja|mi esposa|mi esposo)\b/,'Comer con mi pareja'],
  [/\b(mis hijos|con ninos|con los ninos|con los peques)\b/,'Comer con niños'],
  [/\b(mascota|pet friendly)\b/,'Con mi mascota']
];
export function frequentSearches(messages){
  const groups=new Map();
  if(!Array.isArray(messages))return [];
  messages.forEach((message,index)=>{
    if(message?.role!=='user'||typeof message.text!=='string')return;
    const question=message.text.trim().slice(0,1000);
    const normalized=normalize(question);
    // Exclude detail questions and context-only replies from reusable search shortcuts.
    if(!/\b(busco|buscar|quiero|quisiera|recomienda|recomiendas|donde|comer|cenar|almorzar|pasta|pastas)\b/.test(normalized))return;
    const matched=themes.filter(([pattern])=>pattern.test(normalized));
    const shortQuestion=question.replace(/^(?:estoy buscando|busco|quisiera|quiero|prefiero)\s+(?:un lugar para\s+)?/i,'').replace(/^d[oó]nde puedo\s+/i,'').replace(/^comer cerca (?:del|de la|de)\s+/i,'Cerca de ');
    const compact=shortQuestion.length>30?shortQuestion.slice(0,29).trimEnd()+'…':shortQuestion;
    const labels=matched.length?[matched[0][1]]:[compact.charAt(0).toUpperCase()+compact.slice(1)];
    for(const label of labels){
      const key=normalize(label).replace(/[¿?!.]/g,'').trim();
      const old=groups.get(key);
      groups.set(key,{label,question,count:(old?.count||0)+1,recent:index});
    }
  });
  return [...groups.values()].sort((a,b)=>b.recent-a.recent).slice(0,4);
}
