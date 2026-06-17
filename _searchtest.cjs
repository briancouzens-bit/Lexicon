const E = require("./script.js");
const names=(q,n=10)=>E.search(q,"").slice(0,n).map(r=>r.it.name);
let pass=0,fail=0;
const check=(l,c,d)=>{c?pass++:(fail++,console.log("FAIL:",l,"=>",JSON.stringify(d)));};

// A. Exact match priority
let r=names("PQC");
check("A exact PQC first", r[0]==="PQC", r.slice(0,4));
check("A PQC Governance+Migration in top 4", r.slice(0,4).includes("PQC Governance")&&r.slice(0,4).includes("PQC Migration"), r.slice(0,4));

// B. Prefix: every prefix match must rank ABOVE any non-prefix match; required terms present as prefix hits
let res=E.search("Quan","");
let firstNonPrefix=res.findIndex(x=>x.rank>1);
let lastPrefix=res.map(x=>x.rank).lastIndexOf(1);
check("B prefix tier precedes non-prefix", firstNonPrefix===-1||lastPrefix<firstNonPrefix, {firstNonPrefix,lastPrefix});
let prefixNames=res.filter(x=>x.rank===1).map(x=>x.it.name);
["Quantum-Safe","Quantum Readiness","Quantum Transformation","Quantum Risk Governance"].forEach(t=>
  check("B prefix includes "+t, prefixNames.includes(t), prefixNames.slice(0,6)));

// C. Definition search
let rc=E.search("randomness","").map(x=>x.it.name);
["Entropy","QRNG","Random Number Generator"].forEach(t=>check("C randomness -> "+t, rc.includes(t), rc.slice(0,8)));

// D. Fuzzy / misspellings
check("D governence->Governance", E.search("governence","").slice(0,5).some(x=>x.it.name==="Governance"), names("governence",4));
check("D cryptograpy->Cryptography", E.search("cryptograpy","").slice(0,5).some(x=>x.it.name==="Cryptography"), names("cryptograpy",4));
check("D quantom->Quantum*", E.search("quantom","").slice(0,8).some(x=>x.it.name.toLowerCase().startsWith("quantum")), names("quantom",4));

// E. Ranking non-decreasing
let re=E.search("key",""); let mono=true; for(let i=1;i<re.length;i++) if(re[i].rank<re[i-1].rank){mono=false;break;}
check("E ranks non-decreasing", mono, "");

// F. Plural/singular
check("F certificates->Certificate*", E.search("certificates","").slice(0,10).some(x=>x.it.name.toLowerCase().startsWith("certificate")), names("certificates",4));

// G. Category filter
let g=E.search("","pqc"); check("G category filter pqc", g.length>0&&g.every(x=>x.it.cat==="pqc"), g.length);
let gs=E.search("migration","pqc"); check("G search within category", gs.every(x=>x.it.cat==="pqc"), gs.slice(0,4).map(x=>x.it.name));

// H. Acronyms exact
["CBOM","HNDL","MFA","ML-KEM","SLH-DSA"].forEach(t=>check("H exact "+t, names(t,3)[0]===t, names(t,3)));

console.log("\nSAMPLES");
console.log("  PQC:",names("PQC",4).join(" | "));
console.log("  Quan(prefix):",prefixNames.slice(0,8).join(" | "));
console.log("  randomness:",rc.slice(0,5).join(" | "));
console.log("  governence:",names("governence",3).join(" | "));
console.log("ITEMS:",E.ITEMS.length,"| RESULT pass="+pass+" fail="+fail);
process.exit(fail?1:0);
