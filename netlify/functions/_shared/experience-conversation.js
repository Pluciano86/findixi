export const conversationStyle = `Habla como un pana atento de Puerto Rico: cercano, claro y respetuoso. Usa expresiones naturales como vamos a buscar o podemos cuadrar, sin forzar jerga, wepa ni entusiasmo en cada respuesta. No uses tono de anuncio ni frases como opción ideal. No repitas el nombre ni saludes en cada turno: la interfaz ya saluda al inicio. Si agradece y también hace otra pregunta, reconoce el agradecimiento brevemente y atiende la pregunta; no cierres la conversación sin responderla. Contesta primero lo que preguntaron. Haz como máximo una pregunta breve cuando falte un dato necesario; no hagas un interrogatorio ni preguntes datos ya dados. No añadas beneficios o temas ajenos a la petición. Conserva el destino y las necesidades expresadas en la conversación actual salvo que cambien. No asumas acompañantes ni ocasión por preferencias guardadas. Trabaja con las capacidades conectadas: comercios, playas, lugares turísticos y eventos publicados. No prometas itinerarios de carretera, eventos por fecha ni condiciones meteorológicas actuales si no se consultaron esas fuentes.`;
export function pendingExperienceReply(question){
 const text=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\bchinchor(?:ro|ros|reo|rear|reando)\b/.test(text))return '¡Estamos trabajando las rutas para chinchorrear! Prontamente cuadraremos esos recorridos para que puedas planificar tu salida con Findixi.';
 return null;
}

// Offer categories before retrieving recommendations for an open-ended plan.
export function planChoiceReply(town, hasBeaches=false){
 const options=['Lugares turísticos','Parques',...(hasBeaches?['Playas']:[]),'Jangueo','Eventos','Algo para comer'];
 return `Vamos a cuadrar ese plan${town?` en ${town}`:''}. ¿Qué te gustaría explorar primero?\n\n${options.map(label=>`• ${label}`).join('\n')}`;
}

export const planCategoryLabels={turismo:'Lugares turísticos',parques:'Parques',playas:'Playas',jangueo:'Jangueo',comida:'Para comer',eventos:'Eventos'};
// Only a bare category selection overrides the interpreter; never match negated prose.
export function selectedPlanCategories(question){
 const normalized=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[.!?]+$/,'');
 const aliases={'turismo':'turismo','lugares turisticos':'turismo','parques':'parques','playas':'playas','jangueo':'jangueo','comida':'comida','algo para comer':'comida','para comer':'comida','eventos':'eventos'};
 const parts=normalized.split(/\s*(?:,|\by\b|&)\s*/).filter(Boolean);
 return parts.length&&parts.every(p=>aliases[p])?[...new Set(parts.map(p=>aliases[p]))]:[];
}
export function planCategoryIntent(base,category,town){
 const type={turismo:'lugar',parques:'lugar',playas:'playa',jangueo:'comercio',comida:'comercio',eventos:'evento'}[category];
 const intent={...base,municipio:town,aclaracion:null};
 // Each category has its own search terms; do not filter events by food words.
 intent.terminos=category==='parques'?['parque']:category==='jangueo'?['bar','cerveza','coctel','música','pub','lounge']:category==='comida'&&base.busca_comida?base.terminos:[];
 if(category!=='comida'){intent.cocina=null;intent.busca_comida=false;}
 else intent.busca_comida=true;
 return {type,intent};
}

export function shouldAskPlan(question,modelNeedsPlan){
 if(selectedPlanCategories(question).length)return false;
 const text=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 // "Qué hacer y comer" does not mean the user selected tourism.
 const openActivity=/\bque\b[^?!.]{0,65}\bhacer\b|\bplanes?\b[^?!.]{0,35}\b(?:familia|hijos|ninos)\b/.test(text);
 const chosenActivity=/\b(?:turismo|turistic[oa]s?|museos?|playas?|balnearios?|parques?|jangueo|eventos?|conciertos?|plazas?|monumentos?)\b/.test(text);
 const asksAll=/\b(?:todo|todas las opciones|de todo)\b/.test(text);
 if(openActivity&&!chosenActivity&&!asksAll)return true;
 if(chosenActivity||asksAll)return false;
 return modelNeedsPlan===true;
}

export function gratitudeReply(question,history=[],turn=0){
 const text=String(question||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
 // Match the whole acknowledgement so "gracias, dónde puedo comer" still searches.
 if(!/^(?:(?:perfecto|brutal|excelente|ok|dale|genial)\s+)?(?:(?:(?:muchas|mil|muchisimas)\s+)?gracias(?:\s+por\s+(?:todo|la ayuda|las recomendaciones|la recomendacion|la informacion))?|te lo agradezco|muy agradecid[oa]|thank you|thanks)(?:\s+(?:findixi|pana|me ayudaste mucho|eso era lo que necesitaba|de verdad))*$/.test(text))return null;
 const count=Number.isSafeInteger(turn)&&turn>=0?turn:0;
 const variants=["¡A la orden! Aquí estamos pa’ eso.","¡De nada! Un gusto ayudarte.","¡Para eso estamos!", "¡Con mucho gusto! Me alegra haberte ayudado."];
 const previous=history.join(' ').toLowerCase();
 const topic=/eventos?|conciertos?/.test(previous)?'otro evento':/playas?|balnearios?/.test(previous)?'otra playa':/comer|restaurante|comida/.test(previous)?'otro lugar para comer':'otra recomendación';
 const closings=[`Si necesitas ${topic}, me dejas saber.`,`Cuando quieras seguimos buscando ${topic}.`,`Aquí estoy si te hace falta ${topic}.`];
 return variants[count%variants.length]+' '+closings[count%closings.length];
}


// Anchor relative wording to Puerto Rico's calendar, not the server's UTC day.
export function conversationDates(now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Puerto_Rico',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
 return `Fecha local de Puerto Rico: hoy=${today}; mañana=${tomorrow}. En la conversación, al mencionar una fecha de evento que coincida exactamente, di hoy o mañana en vez de la fecha larga. Para otras fechas usa el día y la fecha cuando ayuden. No cambies la fecha del evento ni confundas eventos futuros con planes para hoy. Esta regla es de redacción; conserva las fechas completas de los datos y tarjetas.`;
}
