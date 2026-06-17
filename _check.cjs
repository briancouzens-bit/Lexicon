const fs = require("fs");
const code = fs.readFileSync("_data.js","utf8");

eval(code + "\nglobalThis.__LEX=LEXDATA;");
const L=globalThis.__LEX;
console.log("raw entries:", L.length);
const cats = new Set(["gov","risk","res","trans","cyber","cloud","id","crypto","pqc","quantum","ai","std","arch"]);
let badCat=0, emptyDef=0, badShape=0;
const seen=new Map(); const dupes=[];
for(const row of L){
  if(!Array.isArray(row)||row.length!==3){badShape++;continue;}
  const [t,d,c]=row;
  if(!cats.has(c)){badCat++;console.log("  bad cat:",t,"=>",c);}
  if(!d||!d.trim())emptyDef++;
  const k=String(t).toLowerCase();
  if(seen.has(k))dupes.push(t);else seen.set(k,1);
}
console.log("unique terms:", seen.size);
console.log("bad shape:",badShape,"bad cat:",badCat,"empty def:",emptyDef);
console.log("dupes(",dupes.length,"):",dupes.slice(0,30).join(" | "));
const dist={};for(const r of L){dist[r[2]]=(dist[r[2]]||0)+1;}
console.log("distribution:",JSON.stringify(dist));
// SITG required terms present?
const req=["CBOM","Q-CORE","QCSL","HNDL","Independent Validation","Cryptographic Discovery","Cryptographic Visibility","Cryptographic Debt","Cryptographic Remediation","Quantum Migration Index","Quantum Readiness","Quantum Risk Assessment","Quantum Transformation","ML-KEM","ML-DSA","SLH-DSA","FIPS 203","FIPS 204","FIPS 205","NIST IR 8547"];
const have=new Set([...seen.keys()]);
const missing=req.filter(r=>!have.has(r.toLowerCase()));
console.log("SITG missing:", missing.length?missing.join(", "):"NONE");
