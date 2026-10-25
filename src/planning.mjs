// Pure planning helper: proposes dates, never reserves or approves anything.
export function validateRules(rules) {
 if(!rules||Object.keys(rules).sort().join(',')!=='max_per_day,min_spacing_minutes,slot_step_minutes,timezone,windows')throw new Error('Règles éditoriales absentes ou incomplètes : configurer chaque compte dans StudioRelay.');
 new Intl.DateTimeFormat('en',{timeZone:rules.timezone}).format();
 for(const [key,min,max] of [['max_per_day',1,10000],['min_spacing_minutes',0,10080],['slot_step_minutes',1,60]])if(!Number.isInteger(rules[key])||rules[key]<min||rules[key]>max)throw new Error('Règle invalide : '+key);
 if(!Array.isArray(rules.windows)||!rules.windows.length||rules.windows.length>28)throw new Error('Plages horaires requises.');
 for(const w of rules.windows){if(!w||Object.keys(w).sort().join(',')!=='end,start,weekdays'||!Array.isArray(w.weekdays)||!w.weekdays.length||w.weekdays.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(w.weekdays).size!==w.weekdays.length||clock(w.start)>=clock(w.end,true))throw new Error('Plage horaire invalide.');}
 return rules;
}
function clock(s,end=false){if(end&&s==='24:00')return 1440;if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw new Error('Heure HH:MM invalide.');const [h,m]=s.split(':').map(Number);return h*60+m;}
export function chooseDates(targets,planning,start,end,now=Date.now()){
 const first=Math.ceil(Math.max(+new Date(start),now+60000)/60000)*60000,last=+new Date(end);
 if(!Number.isFinite(first)||!Number.isFinite(last)||last-first>31*86400000||last<=first)throw new Error('Horizon de recherche positif, limité à 31 jours.');
 const selected=[];
 for(const target of targets){
  const rules=validateRules(planning.accounts.find(a=>a.account_id===target.account_id)?.editorial_rules);
  const format=new Intl.DateTimeFormat('en-CA',{timeZone:rules.timezone,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const parts=t=>{const v=Object.fromEntries(format.formatToParts(t).map(p=>[p.type,p.value]));return {day:`${v.year}-${v.month}-${v.day}`,weekday:{Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[v.weekday],minute:Number(v.hour)*60+Number(v.minute)};};
  const occupied=planning.results.filter(r=>r.account_id===target.account_id&&r.occupied);
  if(occupied.some(r=>r.blocking))throw new Error('Compte '+target.account_id+' : travail en cours, en retard ou incertain à résoudre avant planification automatique.');
  const times=occupied.map(r=>{const t=+new Date(r.effective_at);if(!Number.isFinite(t))throw new Error('Occupation sans date exploitable.');return t;});
  const counts=new Map();for(const t of times){const d=parts(t).day;counts.set(d,(counts.get(d)||0)+1);}
  let chosen;
  for(let t=first;t<last;t+=60000){const p=parts(t);
   if(p.minute%rules.slot_step_minutes||(counts.get(p.day)||0)>=rules.max_per_day||!rules.windows.some(w=>w.weekdays.includes(p.weekday)&&clock(w.start)<=p.minute&&p.minute<clock(w.end,true)))continue;
   if(times.some(x=>Math.abs(x-t)<rules.min_spacing_minutes*60000||x===t))continue;
   chosen=t;break;
  }
  if(chosen===undefined)throw new Error('Aucun créneau pour le compte '+target.account_id+' dans cet horizon. Aucun horaire existant déplacé.');
  selected.push({account_id:target.account_id,scheduled_at:new Date(chosen).toISOString()});
 }
 return selected;
}
