import fs from 'node:fs';

const file = 'public/assets/page-D8jKkO82.js';
const s = fs.readFileSync(file, 'utf8');

function extractBalanced(startIdx, open, close) {
  let depth = 0, quote = null, esc = false;
  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '`' || ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === open) depth++;
    if (ch === close) {
      depth--;
      if (depth === 0) return s.slice(startIdx, i + 1);
    }
  }
  throw new Error('unbalanced');
}

function exprAfter(marker, open='[', close=']') {
  const i = s.indexOf(marker);
  if (i < 0) throw new Error('marker not found: '+marker);
  const j = i + marker.indexOf(open);
  return extractBalanced(j, open, close);
}

const iExpr = exprAfter('i=[[');
const aExpr = exprAfter('a=[[');
const oExpr = exprAfter('o=[[');
const sExpr = exprAfter('s=[[');

const setMarker = 'c=new Set(';
const ci = s.indexOf(setMarker);
if (ci < 0) throw new Error('c set not found');
const cArrStart = s.indexOf('[', ci);
const cExpr = extractBalanced(cArrStart, '[', ']');

const pMarker = 'p=[';
const pi = s.indexOf(pMarker, ci);
if (pi < 0) throw new Error('p not found');
const pStart = s.indexOf('[', pi);
const pExpr = extractBalanced(pStart, '[', ']');

const code = `
const i=${iExpr};
const a=${aExpr};
const o=${oExpr};
const s=${sExpr};
const c=new Set(${cExpr});
const l=(e,t,n,r,i='jsonld',a={})=>{let o=c.has(e),s=a.access==='protected'||!!a.authEnv,l=a.national?void 0:a.city||(['official','venue','culture'].includes(n)?'Bruxelles':void 0),u={...a};delete u.national;return {id:e,name:t,kind:n,url:r,format:s||o?i:'public',access:s?'protected':o?'direct':'public',...(l?{city:l}:{}),...u}};
const u=(e,t,n,r)=>({id:e,name:t,kind:n,url:r,format:'public',access:'public'});
const d=(e,t,n,r)=>({id:e,name:t,kind:n,url:r,format:'protected',access:'protected'});
const f=(e,t,n,r,i={})=>l(e,t,n,r,'jsonld',{assumeBelgium:true,city:'Bruxelles',enrichImages:true,replaceGenericImages:true,groupImageFallback:true,imageEnrichMax:20,...i});
return ${pExpr};
`;
const p = new Function(code)();
fs.writeFileSync('config/sources.generated.json', JSON.stringify(p, null, 2));
const counts = p.reduce((a,x)=>{a[x.format]=(a[x.format]||0)+1; return a;},{});
console.log(JSON.stringify({count:p.length,formats:counts,protected:p.filter(x=>x.access==='protected').length},null,2));
