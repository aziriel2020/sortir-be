import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('public/events-snapshot.json','utf8'));
if(!p.generatedAt||Number.isNaN(Date.parse(p.generatedAt)))throw new Error('generatedAt invalid');
if(!Array.isArray(p.events))throw new Error('events missing');
if(p.events.length<8)throw new Error(`too few events: ${p.events.length}`);
for(const [i,e] of p.events.entries()){
 if(!e.title||!e.start||Number.isNaN(Date.parse(e.start)))throw new Error(`bad event ${i}`);
 if(!/^https?:/i.test(e.url||''))throw new Error(`bad event url ${i}`);
}
console.log(`Snapshot OK: ${p.events.length} events @ ${p.generatedAt}`);
