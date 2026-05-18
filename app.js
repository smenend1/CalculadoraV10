"use strict";

const $ = id => document.getElementById(id);
const tabs = document.querySelectorAll(".tab");
const forms = document.querySelectorAll(".calculator-form");
const resultBox = $("result-box");
const statusPill = $("status-pill");
const fmt = new Intl.NumberFormat("ca-ES", { maximumFractionDigits: 6 });

let history = [];

function formatNumber(x){ return Number.isFinite(x) ? fmt.format(x) : "No definit"; }
function getNumber(id){ const x = Number($(id).value); if(!Number.isFinite(x)) throw new Error("Introdueix nombres vàlids."); return x; }
function setStatus(text,type=""){ statusPill.textContent=text; statusPill.className=`status-pill ${type}`; }
function htmlSteps(steps){ return steps.map(s=>`<li>${s}</li>`).join(""); }
function render({title,summary,steps,type="ok",extra=""}) {
  resultBox.innerHTML = `<article class="result-card ${type==="error"?"error-message":type==="warning"?"warning-message":"success-message"}"><h3>${title}</h3><p>${summary}</p>${extra}<h4>Procediment</h4><ol class="steps">${htmlSteps(steps)}</ol></article>`;
  setStatus(type==="error"?"Revisa les dades":type==="warning"?"Atenció":"Resultat obtingut", type);
}
function renderError(summary, detail){ render({title:"No es pot completar el càlcul", summary, type:"error", steps:[detail,"Revisa les dades d'entrada i torna-ho a intentar.","Comprovar condicions i unitats forma part del procediment."]}); }
function resetResult(){ setStatus("Esperant dades"); resultBox.innerHTML="<p>Tria un mòdul, introdueix les dades i prem el botó. Aquí apareixeran el resultat, el procediment i, quan pertoqui, la gràfica.</p>"; }

tabs.forEach(tab=>tab.addEventListener("click",()=>{
  const m=tab.dataset.module;
  tabs.forEach(t=>{t.classList.remove("active");t.setAttribute("aria-selected","false");});
  tab.classList.add("active"); tab.setAttribute("aria-selected","true");
  forms.forEach(f=>f.classList.toggle("active", f.dataset.form===m));
  resetResult();
}));

/* Expression engine */
function factorial(n){ if(!Number.isInteger(n)||n<0||n>170) throw new Error("El factorial només admet enters entre 0 i 170."); let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function normalizeExpression(expr){ return expr.replaceAll("π","pi").replaceAll("÷","/").replaceAll("×","*").replaceAll(",",".").replace(/\s+/g,""); }
function prepareExpression(expr){
  let e = normalizeExpression(expr);
  e = e.replace(/(\d+(?:\.\d+)?|\([^()]*\))!/g, "factorial($1)");
  e = e.replace(/\^/g,"**").replace(/(\d+(?:\.\d+)?)%/g,"($1/100)");
  return e;
}
function evaluateExpression(expr, mode="rad", xValue=null){
  const raw = prepareExpression(expr);
  if(!raw) throw new Error("Escriu una expressió.");
  if(!/^[0-9+\-*/().,^%a-zA-Z_!]+$/.test(normalizeExpression(expr))) throw new Error("L'expressió conté caràcters no permesos.");
  const toRad = v => mode==="deg" ? v*Math.PI/180 : v;
  const scope = {
    x: xValue, pi:Math.PI, e:Math.E, factorial,
    sin:v=>Math.sin(toRad(v)), cos:v=>Math.cos(toRad(v)), tan:v=>Math.tan(toRad(v)),
    asin:v=> mode==="deg" ? Math.asin(v)*180/Math.PI : Math.asin(v),
    acos:v=> mode==="deg" ? Math.acos(v)*180/Math.PI : Math.acos(v),
    atan:v=> mode==="deg" ? Math.atan(v)*180/Math.PI : Math.atan(v),
    sqrt:Math.sqrt, abs:Math.abs, log:Math.log10, ln:Math.log, exp:Math.exp,
    root:(a,n)=>Math.sign(a)*Math.abs(a)**(1/n)
  };
  const names=Object.keys(scope), values=Object.values(scope);
  const words = raw.match(/[a-zA-Z_]+/g)||[];
  for(const w of words){ if(!names.includes(w)) throw new Error(`"${w}" no està reconegut.`); }
  const val = new Function(...names, `"use strict"; return (${raw});`)(...values);
  if(!Number.isFinite(val)) throw new Error("El resultat no és finit o no està definit.");
  return { value:val, normalized:raw };
}

/* Scientific */
document.querySelectorAll(".scientific-keypad button").forEach(b=>b.addEventListener("click",()=>{
  const input=$("scientific-expression"), ins=b.dataset.insert, action=b.dataset.action;
  const s=input.selectionStart??input.value.length, e=input.selectionEnd??input.value.length;
  if(ins){ input.value=input.value.slice(0,s)+ins+input.value.slice(e); input.selectionStart=input.selectionEnd=s+ins.length; }
  if(action==="clear") input.value="";
  if(action==="backspace" && s>0){ input.value=input.value.slice(0,s-1)+input.value.slice(e); input.selectionStart=input.selectionEnd=s-1; }
  input.focus();
}));
$("clear-history-button").addEventListener("click",()=>{history=[]; render({title:"Historial netejat",summary:"S'ha buidat l'historial de la sessió.",steps:["L'historial no s'emmagatzema fora del navegador.","Pots continuar calculant."]});});
$("scientific-form").addEventListener("submit",e=>{
  e.preventDefault();
  try{
    const expr=$("scientific-expression").value, mode=$("angle-mode").value;
    const res=evaluateExpression(expr,mode);
    history.unshift(`${expr} = ${formatNumber(res.value)} (${mode==="deg"?"graus":"radians"})`); history=history.slice(0,10);
    const extra=`<h4>Historial</h4><ul class="history-list">${history.map(h=>`<li>${h}</li>`).join("")}</ul>`;
    render({title:"Calculadora científica",summary:`<strong>${expr}</strong> = <strong>${formatNumber(res.value)}</strong>`,extra,steps:[
      `Normalitzem l'expressió: <span class="math">${res.normalized}</span>.`,
      `Mode angular: <strong>${mode==="deg"?"graus":"radians"}</strong>.`,
      "Apliquem la prioritat d'operacions: parèntesis, potències/arrels, productes/divisions i sumes/restes.",
      `Resultat final: <span class="math">${formatNumber(res.value)}</span>.`
    ]});
  }catch(err){ renderError("No s'ha pogut calcular l'expressió.",err.message); }
});

/* Fractions */
function gcd(a,b){ a=Math.abs(a); b=Math.abs(b); while(b){[a,b]=[b,a%b]} return a||1; }
function lcm(a,b){ return Math.abs(a*b)/gcd(a,b); }
function parseFrac(s){ s=s.trim(); if(!/^[-+]?\d+(\/[-+]?\d+)?$/.test(s)) throw new Error("Fracció no vàlida. Usa formats com 3/4 o -2."); const [n,d="1"]=s.split("/").map(Number); if(d===0) throw new Error("El denominador no pot ser 0."); const g=gcd(n,d); const sign=d<0?-1:1; return {n:sign*n/g,d:Math.abs(d)/g}; }
function fracStr(f){ return f.d===1?`${f.n}`:`${f.n}/${f.d}`; }
$("fractions-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const A=parseFrac($("frac-a").value), B=parseFrac($("frac-b").value), op=$("frac-op").value;
    let R;
    if(op==="+") R={n:A.n*B.d+B.n*A.d,d:A.d*B.d};
    if(op==="-") R={n:A.n*B.d-B.n*A.d,d:A.d*B.d};
    if(op==="*") R={n:A.n*B.n,d:A.d*B.d};
    if(op==="/"){ if(B.n===0) throw new Error("No es pot dividir per 0."); R={n:A.n*B.d,d:A.d*B.n};}
    const g=gcd(R.n,R.d); R={n:R.n/g,d:R.d/g}; if(R.d<0) R={n:-R.n,d:-R.d};
    render({title:"Operació amb fraccions",summary:`Resultat: <strong>${fracStr(R)}</strong> = <strong>${formatNumber(R.n/R.d)}</strong>`,steps:[
      `Identifiquem les fraccions: <span class="math">${fracStr(A)}</span> i <span class="math">${fracStr(B)}</span>.`,
      op==="+"||op==="-" ? "Per sumar o restar, fem servir denominador comú." : op==="*" ? "Per multiplicar, multipliquem numeradors i denominadors." : "Per dividir, multipliquem per la fracció inversa.",
      `Simplifiquem el resultat dividint numerador i denominador pel seu MCD.`,
      `Resultat final: <span class="math">${fracStr(R)}</span>.`
    ]});
  }catch(err){renderError("No s'ha pogut operar amb fraccions.",err.message);}
});

/* Equations */
const eqInputs={
  linear:`<label>a<input type="number" id="eq-a" step="any" value="2"></label><label>b<input type="number" id="eq-b" step="any" value="-8"></label>`,
  quadratic:`<label>a<input type="number" id="eq-a" step="any" value="1"></label><label>b<input type="number" id="eq-b" step="any" value="-5"></label><label>c<input type="number" id="eq-c" step="any" value="6"></label>`,
  cubic:`<label>a<input type="number" id="eq-a" step="any" value="1"></label><label>b<input type="number" id="eq-b" step="any" value="0"></label><label>c<input type="number" id="eq-c" step="any" value="-1"></label><label>d<input type="number" id="eq-d" step="any" value="0"></label>`,
  polynomial:`<label>Coeficients de grau més alt a terme independent<input type="text" id="poly-coefs" value="1,0,-1,0"></label>`
};
function updateEqInputs(){ $("equation-inputs").innerHTML=eqInputs[$("equation-type").value]; }
$("equation-type").addEventListener("change",updateEqInputs);
function polyVal(coefs,x){ return coefs.reduce((acc,c)=>acc*x+c,0); }
function approximateRoots(coefs,min=-50,max=50,step=.05){
  const roots=[]; let prevX=min, prevY=polyVal(coefs,prevX);
  for(let x=min+step;x<=max;x+=step){
    const y=polyVal(coefs,x);
    if(Math.abs(y)<1e-5) roots.push(x);
    if(prevY*y<0){
      let a=prevX,b=x;
      for(let i=0;i<50;i++){ const m=(a+b)/2, fm=polyVal(coefs,m); if(polyVal(coefs,a)*fm<=0)b=m; else a=m; }
      roots.push((a+b)/2);
    }
    prevX=x; prevY=y;
  }
  return [...new Set(roots.map(r=>Number(r.toFixed(5))))].filter((r,i,arr)=>i===0||Math.abs(r-arr[i-1])>.01);
}
$("equations-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const type=$("equation-type").value;
    if(type==="linear"){ const a=getNumber("eq-a"), b=getNumber("eq-b"); if(a===0) throw new Error("a no pot ser 0 en una equació lineal amb solució única."); const x=-b/a; return render({title:"Equació lineal",summary:`x = <strong>${formatNumber(x)}</strong>`,steps:[`Partim de <span class="math">${formatNumber(a)}x + ${formatNumber(b)} = 0</span>.`,`Aïllem: <span class="math">${formatNumber(a)}x = ${formatNumber(-b)}</span>.`,`Dividim per a: <span class="math">x = ${formatNumber(x)}</span>.`]});}
    if(type==="quadratic"){ const a=getNumber("eq-a"), b=getNumber("eq-b"), c=getNumber("eq-c"); if(a===0) throw new Error("a no pot ser 0."); const D=b*b-4*a*c; if(D<0) return render({title:"Equació quadràtica",type:"warning",summary:`Δ = ${formatNumber(D)}. No hi ha arrels reals.`,steps:[`Calculem <span class="math">Δ=b²-4ac=${formatNumber(D)}</span>.`,"Com que Δ<0, no hi ha solucions reals."]}); const x1=(-b+Math.sqrt(D))/(2*a), x2=(-b-Math.sqrt(D))/(2*a); return render({title:"Equació quadràtica",summary:`x₁=${formatNumber(x1)}, x₂=${formatNumber(x2)}`,steps:[`Calculem el discriminant: <span class="math">Δ=${formatNumber(D)}</span>.`,`Apliquem <span class="math">x=(-b±√Δ)/2a</span>.`,`Solucions: <span class="math">${formatNumber(x1)}</span> i <span class="math">${formatNumber(x2)}</span>.`]});}
    const coefs = type==="cubic" ? [getNumber("eq-a"),getNumber("eq-b"),getNumber("eq-c"),getNumber("eq-d")] : $("poly-coefs").value.split(",").map(Number);
    if(coefs.some(v=>!Number.isFinite(v))) throw new Error("Coeficients no vàlids.");
    const roots=approximateRoots(coefs);
    render({title:"Polinomi: arrels aproximades",summary:roots.length?`Arrels reals aproximades: <strong>${roots.map(formatNumber).join(", ")}</strong>`:"No s'han trobat arrels reals en l'interval [-50,50].",steps:["Avaluem el polinomi en molts punts de l'interval [-50,50].","Quan detectem canvi de signe, apliquem bisecció per aproximar l'arrel.","És un mètode numèric: pot no trobar arrels dobles o arrels fora de l'interval."]});
  }catch(err){renderError("No s'ha pogut resoldre l'equació.",err.message);}
});

/* Systems */
function updateSystemInputs(){
  $("system-inputs").innerHTML = $("system-type").value==="2x2" ?
  `<label>a<input type="number" id="s-a" value="2" step="any"></label><label>b<input type="number" id="s-b" value="1" step="any"></label><label>e<input type="number" id="s-e" value="7" step="any"></label><label>c<input type="number" id="s-c" value="1" step="any"></label><label>d<input type="number" id="s-d" value="-1" step="any"></label><label>f<input type="number" id="s-f" value="1" step="any"></label>` :
  `<label>Fila 1: a,b,c,e<input id="s-row1" value="1,1,1,6"></label><label>Fila 2: d,e,f,g<input id="s-row2" value="2,-1,1,3"></label><label>Fila 3: h,i,j,k<input id="s-row3" value="1,2,-1,3"></label>`;
}
$("system-type").addEventListener("change",updateSystemInputs);
function solveLinearSystem(A,b){
  const n=A.length, M=A.map((row,i)=>row.concat(b[i]));
  for(let k=0;k<n;k++){
    let max=k; for(let i=k+1;i<n;i++) if(Math.abs(M[i][k])>Math.abs(M[max][k])) max=i;
    [M[k],M[max]]=[M[max],M[k]];
    if(Math.abs(M[k][k])<1e-12) throw new Error("El sistema no té solució única.");
    for(let i=k+1;i<n;i++){ const factor=M[i][k]/M[k][k]; for(let j=k;j<=n;j++) M[i][j]-=factor*M[k][j];}
  }
  const x=Array(n).fill(0);
  for(let i=n-1;i>=0;i--){ let sum=M[i][n]; for(let j=i+1;j<n;j++) sum-=M[i][j]*x[j]; x[i]=sum/M[i][i];}
  return x;
}
$("systems-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    if($("system-type").value==="2x2"){
      const a=getNumber("s-a"),b=getNumber("s-b"),e0=getNumber("s-e"),c=getNumber("s-c"),d=getNumber("s-d"),f=getNumber("s-f");
      const D=a*d-b*c; if(D===0) throw new Error("Determinant 0: no hi ha solució única.");
      const x=(e0*d-b*f)/D, y=(a*f-e0*c)/D;
      render({title:"Sistema 2x2",summary:`x=${formatNumber(x)}, y=${formatNumber(y)}`,steps:[`Determinant: <span class="math">D=ad-bc=${formatNumber(D)}</span>.`,`Fem Cramer: <span class="math">x=Dₓ/D</span> i <span class="math">y=Dᵧ/D</span>.`,`Solució: <span class="math">(${formatNumber(x)}, ${formatNumber(y)})</span>.`]});
    } else {
      const rows=[$("s-row1").value,$("s-row2").value,$("s-row3").value].map(r=>r.split(",").map(Number));
      if(rows.some(r=>r.length!==4||r.some(v=>!Number.isFinite(v)))) throw new Error("Cada fila ha de tenir 4 nombres.");
      const A=rows.map(r=>r.slice(0,3)), b=rows.map(r=>r[3]); const sol=solveLinearSystem(A,b);
      render({title:"Sistema 3x3",summary:`x=${formatNumber(sol[0])}, y=${formatNumber(sol[1])}, z=${formatNumber(sol[2])}`,steps:["Construïm la matriu ampliada del sistema.","Apliquem eliminació de Gauss amb pivotatge.","Fem substitució enrere per obtenir x, y i z."]});
    }
  }catch(err){renderError("No s'ha pogut resoldre el sistema.",err.message);}
});

/* Graphing */
const functionTemplates={
  linear:`<label>m<input type="number" id="fn-m" value="2" step="any"></label><label>n<input type="number" id="fn-n" value="-1" step="any"></label>`,
  quadratic:`<label>a<input type="number" id="fn-a" value="1" step="any"></label><label>b<input type="number" id="fn-b" value="-4" step="any"></label><label>c<input type="number" id="fn-c" value="3" step="any"></label>`,
  cubic:`<label>a<input type="number" id="fn-a" value="1" step="any"></label><label>b<input type="number" id="fn-b" value="0" step="any"></label><label>c<input type="number" id="fn-c" value="-1" step="any"></label><label>d<input type="number" id="fn-d" value="0" step="any"></label>`,
  sinusoidal:`<label>A<input type="number" id="fn-A" value="1" step="any"></label><label>B<input type="number" id="fn-B" value="1" step="any"></label><label>C<input type="number" id="fn-C" value="0" step="any"></label><label>D<input type="number" id="fn-D" value="0" step="any"></label>`,
  custom:`<label>f(x)<input type="text" id="fn-expr" value="x^2-4"></label>`
};
function updateFunctionInputs(){ $("function-inputs").innerHTML=functionTemplates[$("function-type").value]; }
$("function-type").addEventListener("change",updateFunctionInputs);
function buildFn(){
  const t=$("function-type").value, mode=$("graph-angle-mode").value;
  if(t==="linear"){const m=getNumber("fn-m"),n=getNumber("fn-n"); return {expr:`${formatNumber(m)}x ${n>=0?"+":"-"} ${formatNumber(Math.abs(n))}`, fn:x=>m*x+n, type:t, coefs:[m,n]};}
  if(t==="quadratic"){const a=getNumber("fn-a"),b=getNumber("fn-b"),c=getNumber("fn-c"); return {expr:`${formatNumber(a)}x² ${b>=0?"+":"-"} ${formatNumber(Math.abs(b))}x ${c>=0?"+":"-"} ${formatNumber(Math.abs(c))}`, fn:x=>a*x*x+b*x+c, type:t, coefs:[a,b,c]};}
  if(t==="cubic"){const a=getNumber("fn-a"),b=getNumber("fn-b"),c=getNumber("fn-c"),d=getNumber("fn-d"); return {expr:`${formatNumber(a)}x³...`, fn:x=>a*x**3+b*x*x+c*x+d, type:t, coefs:[a,b,c,d]};}
  if(t==="sinusoidal"){const A=getNumber("fn-A"),B=getNumber("fn-B"),C=getNumber("fn-C"),D=getNumber("fn-D"); return {expr:`${formatNumber(A)}sin(${formatNumber(B)}x+${formatNumber(C)})+${formatNumber(D)}`, fn:x=>A*Math.sin(B*x+C)+D, type:t};}
  const expr=$("fn-expr").value; return {expr, fn:x=>evaluateExpression(expr,mode,x).value, type:t};
}
function derivative(fn,x){ const h=1e-5; return (fn(x+h)-fn(x-h))/(2*h); }
function rootsInRange(fn,xmin,xmax){ const roots=[]; const step=(xmax-xmin)/400; let px=xmin, py=fn(px); for(let x=xmin+step;x<=xmax;x+=step){let y; try{y=fn(x)}catch{px=x;py=NaN;continue} if(Number.isFinite(py)&&Number.isFinite(y)&&py*y<0){let a=px,b=x; for(let i=0;i<35;i++){let m=(a+b)/2; if(fn(a)*fn(m)<=0)b=m; else a=m;} roots.push((a+b)/2);} px=x; py=y;} return roots.filter((r,i,a)=>i===0||Math.abs(r-a[i-1])>.05); }
function extremaApprox(fn,xmin,xmax){ const out=[]; const step=(xmax-xmin)/200; let pd=derivative(fn,xmin); for(let x=xmin+step;x<=xmax;x+=step){ const d=derivative(fn,x); if(Number.isFinite(pd)&&Number.isFinite(d)&&pd*d<0) out.push(x); pd=d; } return out.slice(0,8); }
function drawGraph(fn,xmin,xmax,points=[]){
  const canvas=document.createElement("canvas"); canvas.className="function-canvas"; canvas.width=720; canvas.height=720; canvas.setAttribute("aria-label","Gràfica de la funció");
  const ctx=canvas.getContext("2d"), pad=46, W=canvas.width,H=canvas.height;
  const ys=[]; for(let i=0;i<=600;i++){const x=xmin+(xmax-xmin)*i/600; try{const y=fn(x); if(Number.isFinite(y))ys.push(y)}catch{}}
  let ymin=Math.min(-10,...ys), ymax=Math.max(10,...ys); if(ymax-ymin<1){ymax+=1;ymin-=1}
  const X=x=>pad+(x-xmin)/(xmax-xmin)*(W-2*pad), Y=y=>H-pad-(y-ymin)/(ymax-ymin)*(H-2*pad);
  ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H); ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let x=Math.ceil(xmin);x<=Math.floor(xmax);x++){ctx.beginPath();ctx.moveTo(X(x),pad);ctx.lineTo(X(x),H-pad);ctx.stroke();}
  for(let y=Math.ceil(ymin);y<=Math.floor(ymax);y++){ctx.beginPath();ctx.moveTo(pad,Y(y));ctx.lineTo(W-pad,Y(y));ctx.stroke();}
  ctx.strokeStyle="#374151";ctx.lineWidth=2; if(xmin<=0&&xmax>=0){ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();} if(ymin<=0&&ymax>=0){ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();}
  ctx.strokeStyle="#1d4ed8";ctx.lineWidth=4;ctx.beginPath();let started=false;
  for(let i=0;i<=900;i++){const x=xmin+(xmax-xmin)*i/900; let y; try{y=fn(x)}catch{started=false;continue} if(!Number.isFinite(y)){started=false;continue} const cx=X(x),cy=Y(y); if(!started){ctx.moveTo(cx,cy);started=true}else ctx.lineTo(cx,cy);}
  ctx.stroke(); ctx.fillStyle="#b91c1c"; points.forEach(p=>{if(p.x>=xmin&&p.x<=xmax&&p.y>=ymin&&p.y<=ymax){ctx.beginPath();ctx.arc(X(p.x),Y(p.y),6,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111827";ctx.fillText(p.label,X(p.x)+8,Y(p.y)-8);ctx.fillStyle="#b91c1c";}});
  return canvas.outerHTML;
}
$("functions-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const xmin=getNumber("graph-xmin"), xmax=getNumber("graph-xmax"), x0=getNumber("tangent-x0"); if(xmax<=xmin) throw new Error("X màx ha de ser més gran que X mín.");
    const F=buildFn(), fn=F.fn, y0=fn(x0), m=derivative(fn,x0), roots=rootsInRange(fn,xmin,xmax), ext=extremaApprox(fn,xmin,xmax);
    const pts=[{x:x0,y:y0,label:"x₀"}, ...roots.map((r,i)=>({x:r,y:0,label:`arrel ${i+1}`})), ...ext.map((x,i)=>({x,y:fn(x),label:`ext ${i+1}`}))];
    const table=[]; for(let x=Math.ceil(xmin); x<=Math.floor(xmax); x+=Math.max(1,Math.round((xmax-xmin)/8))) table.push(`<li>x=${formatNumber(x)} → f(x)=${formatNumber(fn(x))}</li>`);
    const extra=`<div>${drawGraph(fn,xmin,xmax,pts)}</div><h4>Taula de valors</h4><ul class="table-list">${table.join("")}</ul>`;
    render({title:"Estudi gràfic de funció",summary:`f(x)=<strong>${F.expr}</strong>`,extra,steps:[
      `Domini considerat per a la gràfica: <span class="math">[${formatNumber(xmin)}, ${formatNumber(xmax)}]</span>.`,
      roots.length?`Arrels aproximades: <span class="math">${roots.map(formatNumber).join(", ")}</span>.`:"No s'han detectat arrels en l'interval mostrat.",
      ext.length?`Extrems locals aproximats a x: <span class="math">${ext.map(formatNumber).join(", ")}</span>.`:"No s'han detectat extrems locals clars en l'interval.",
      `Tangent en x₀=${formatNumber(x0)}: pendent aproximat <span class="math">m=${formatNumber(m)}</span>.`,
      `Equació aproximada de la tangent: <span class="math">y-${formatNumber(y0)}=${formatNumber(m)}(x-${formatNumber(x0)})</span>.`
    ]});
  }catch(err){renderError("No s'ha pogut dibuixar o estudiar la funció.",err.message);}
});

/* Calculus */
$("calculus-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const expr=$("calculus-expression").value, a=getNumber("calc-a"), b=getNumber("calc-b"), type=$("calculus-type").value;
    const fn=x=>evaluateExpression(expr,"rad",x).value;
    if(type==="derivative"){ const d=derivative(fn,a); render({title:"Derivada numèrica",summary:`f'(${formatNumber(a)}) ≈ <strong>${formatNumber(d)}</strong>`,steps:["Fem servir una diferència central.","Fórmula aproximada: <span class='math'>(f(x+h)-f(x-h))/(2h)</span>.",`Resultat: <span class='math'>${formatNumber(d)}</span>.`]});}
    else { const n=1000, h=(b-a)/n; let sum=0.5*(fn(a)+fn(b)); for(let i=1;i<n;i++) sum+=fn(a+i*h); const I=sum*h; render({title:"Integral definida numèrica",summary:`∫ de ${formatNumber(a)} a ${formatNumber(b)} ≈ <strong>${formatNumber(I)}</strong>`,steps:["Fem servir la regla del trapezi.","Dividim l'interval en 1000 subintervals.","Sumem les àrees aproximades dels trapezis."]});}
  }catch(err){renderError("No s'ha pogut fer el càlcul numèric.",err.message);}
});


/* Physics and Chemistry */
const PH_R=0.082057, PH_K=8.99e9, NA=6.022e23;
const AT={H:1.008,He:4.003,Li:6.94,Be:9.012,B:10.81,C:12.011,N:14.007,O:15.999,F:18.998,Ne:20.18,Na:22.99,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,Ar:39.948,K:39.098,Ca:40.078,Fe:55.845,Cu:63.546,Zn:65.38,Br:79.904,Ag:107.868,I:126.904,Ba:137.327,Pb:207.2};
function nz(v,n){if(v===0)throw new Error(n+" no pot ser 0.")} function posv(v,n){if(v<=0)throw new Error(n+" ha de ser positiu.")} function maybe(id){return $(id)?getNumber(id):null} function listNums(id){const a=$(id).value.split(",").map(x=>Number(x.trim())); if(!a.length||a.some(x=>!Number.isFinite(x)))throw new Error("Llista no vàlida."); return a}
const phT={
 mru:`<label>Δx (m)<input type="number" id="ph-a" value="100" step="any"></label><label>Δt (s)<input type="number" id="ph-b" value="20" step="any"></label>`,
 "mrua-v":`<label>v₀ (m/s)<input type="number" id="ph-a" value="3" step="any"></label><label>a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label><label>t (s)<input type="number" id="ph-c" value="5" step="any"></label>`,
 "mrua-x":`<label>x₀ (m)<input type="number" id="ph-a" value="0" step="any"></label><label>v₀ (m/s)<input type="number" id="ph-b" value="3" step="any"></label><label>a (m/s²)<input type="number" id="ph-c" value="2" step="any"></label><label>t (s)<input type="number" id="ph-d" value="5" step="any"></label>`,
 newton:`<label>m (kg)<input type="number" id="ph-a" value="10" step="any"></label><label>a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label>`,weight:`<label>m (kg)<input type="number" id="ph-a" value="60" step="any"></label><label>g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label>`,momentum:`<label>m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>v (m/s)<input type="number" id="ph-b" value="5" step="any"></label>`,centripetal:`<label>m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>v (m/s)<input type="number" id="ph-b" value="4" step="any"></label><label>r (m)<input type="number" id="ph-c" value="1.5" step="any"></label>`,
 work:`<label>F (N)<input type="number" id="ph-a" value="20" step="any"></label><label>d (m)<input type="number" id="ph-b" value="5" step="any"></label><label>θ (graus)<input type="number" id="ph-c" value="0" step="any"></label>`,power:`<label>W (J)<input type="number" id="ph-a" value="500" step="any"></label><label>t (s)<input type="number" id="ph-b" value="10" step="any"></label>`,kinetic:`<label>m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>v (m/s)<input type="number" id="ph-b" value="10" step="any"></label>`,potential:`<label>m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>h (m)<input type="number" id="ph-c" value="5" step="any"></label>`,spring:`<label>k (N/m)<input type="number" id="ph-a" value="100" step="any"></label><label>x (m)<input type="number" id="ph-b" value="0.2" step="any"></label>`,
 density:`<label>m (kg)<input type="number" id="ph-a" value="10" step="any"></label><label>V (m³)<input type="number" id="ph-b" value="2" step="any"></label>`,pressure:`<label>F (N)<input type="number" id="ph-a" value="100" step="any"></label><label>S (m²)<input type="number" id="ph-b" value="0.5" step="any"></label>`,hydrostatic:`<label>ρ (kg/m³)<input type="number" id="ph-a" value="1000" step="any"></label><label>g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>h (m)<input type="number" id="ph-c" value="2" step="any"></label>`,buoyancy:`<label>ρ fluid (kg/m³)<input type="number" id="ph-a" value="1000" step="any"></label><label>g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>V desplaçat (m³)<input type="number" id="ph-c" value="0.01" step="any"></label>`,
 wave:`<label>λ (m)<input type="number" id="ph-a" value="2" step="any"></label><label>f (Hz)<input type="number" id="ph-b" value="5" step="any"></label>`,period:`<label>f (Hz)<input type="number" id="ph-a" value="50" step="any"></label>`,lens:`<label>focal f (cm)<input type="number" id="ph-a" value="10" step="any"></label><label>objecte do (cm)<input type="number" id="ph-b" value="30" step="any"></label>`,
 ohm:`<label>I (A)<input type="number" id="ph-a" value="2" step="any"></label><label>R (Ω)<input type="number" id="ph-b" value="5" step="any"></label>`,epower:`<label>V (V)<input type="number" id="ph-a" value="230" step="any"></label><label>I (A)<input type="number" id="ph-b" value="2" step="any"></label>`,rseries:`<label>Resistències Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,rparallel:`<label>Resistències Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,coulomb:`<label>q₁ (C)<input type="number" id="ph-a" value="0.000001" step="any"></label><label>q₂ (C)<input type="number" id="ph-b" value="0.000002" step="any"></label><label>r (m)<input type="number" id="ph-c" value="0.1" step="any"></label>`,
 heat:`<label>m (kg)<input type="number" id="ph-a" value="1" step="any"></label><label>c (J/kg·K)<input type="number" id="ph-b" value="4180" step="any"></label><label>ΔT<input type="number" id="ph-c" value="10" step="any"></label>`,latent:`<label>m (kg)<input type="number" id="ph-a" value="0.5" step="any"></label><label>L (J/kg)<input type="number" id="ph-b" value="334000" step="any"></label>`,idealgas:`<label>P (atm)<input type="number" id="ph-a" value="1" step="any"></label><label>V (L)<input type="number" id="ph-b" value="22.4" step="any"></label><label>n (mol)<input type="number" id="ph-c" value="1" step="any"></label>`};
function updatePhysicsInputs(){ $("physics-inputs").innerHTML=phT[$("physics-type").value] } $("physics-type").addEventListener("change",updatePhysicsInputs);
$("physics-form").addEventListener("submit",e=>{e.preventDefault();try{const t=$("physics-type").value,a=maybe("ph-a"),b=maybe("ph-b"),c=maybe("ph-c"),d=maybe("ph-d");let title="Física",summary="",steps=[],note="";function done(T,F,U,formula,explain){title=T;summary=`${F} = <strong>${formatNumber(U.val)} ${U.unit}</strong>`;steps=[`Apliquem <span class="math">${formula}</span>.`,explain,`Resultat: <span class="math">${formatNumber(U.val)} ${U.unit}</span>.`]} if(t==="mru"){nz(b,"El temps");done("MRU","v",{val:a/b,unit:"m/s"},"v=Δx/Δt",`v=${formatNumber(a)}/${formatNumber(b)}`)} if(t==="mrua-v")done("MRUA velocitat","v",{val:a+b*c,unit:"m/s"},"v=v₀+at",`v=${formatNumber(a)}+${formatNumber(b)}·${formatNumber(c)}`); if(t==="mrua-x")done("MRUA posició","x",{val:a+b*d+.5*c*d*d,unit:"m"},"x=x₀+v₀t+½at²","Substituïm les dades i calculem."); if(t==="newton")done("Newton","F",{val:a*b,unit:"N"},"F=ma",`F=${formatNumber(a)}·${formatNumber(b)}`); if(t==="weight")done("Pes","P",{val:a*b,unit:"N"},"P=mg",`P=${formatNumber(a)}·${formatNumber(b)}`); if(t==="momentum")done("Quantitat de moviment","p",{val:a*b,unit:"kg·m/s"},"p=mv",`p=${formatNumber(a)}·${formatNumber(b)}`); if(t==="centripetal"){posv(c,"El radi");done("Força centrípeta","Fc",{val:a*b*b/c,unit:"N"},"Fc=mv²/r","Substituïm massa, velocitat i radi.")} if(t==="work")done("Treball","W",{val:a*b*Math.cos(c*Math.PI/180),unit:"J"},"W=Fd cosθ","Fem servir el cosinus de l'angle en graus."); if(t==="power"){nz(b,"El temps");done("Potència","P",{val:a/b,unit:"W"},"P=W/t",`P=${formatNumber(a)}/${formatNumber(b)}`)} if(t==="kinetic")done("Energia cinètica","Ec",{val:.5*a*b*b,unit:"J"},"Ec=½mv²","Substituïm massa i velocitat."); if(t==="potential")done("Energia potencial","Ep",{val:a*b*c,unit:"J"},"Ep=mgh","Substituïm massa, gravetat i altura."); if(t==="spring")done("Energia elàstica","Ee",{val:.5*a*b*b,unit:"J"},"Ee=½kx²","Substituïm constant elàstica i deformació."); if(t==="density"){nz(b,"El volum");done("Densitat","ρ",{val:a/b,unit:"kg/m³"},"ρ=m/V","Dividim massa entre volum.")} if(t==="pressure"){nz(b,"La superfície");done("Pressió","p",{val:a/b,unit:"Pa"},"p=F/S","Dividim força entre superfície.")} if(t==="hydrostatic"){done("Pressió hidrostàtica","p",{val:a*b*c,unit:"Pa"},"p=ρgh","Multipliquem densitat, gravetat i profunditat.");note="És la pressió deguda al fluid; per pressió absoluta cal sumar la pressió atmosfèrica."} if(t==="buoyancy")done("Empenta d'Arquímedes","E",{val:a*b*c,unit:"N"},"E=ρgV","Multipliquem densitat del fluid, gravetat i volum desplaçat."); if(t==="wave")done("Velocitat d'ona","v",{val:a*b,unit:"m/s"},"v=λf","Multipliquem longitud d'ona i freqüència."); if(t==="period"){nz(a,"La freqüència");done("Període","T",{val:1/a,unit:"s"},"T=1/f","Fem la inversa de la freqüència.")} if(t==="lens"){nz(a,"La focal");nz(b,"La distància objecte");let inv=1/a-1/b;nz(inv,"1/f-1/do");done("Lent prima","di",{val:1/inv,unit:"cm"},"1/f=1/do+1/di","Aïllem 1/di = 1/f - 1/do.");note="El signe depèn del conveni de signes utilitzat."} if(t==="ohm")done("Llei d'Ohm","V",{val:a*b,unit:"V"},"V=IR","Multipliquem intensitat i resistència."); if(t==="epower")done("Potència elèctrica","P",{val:a*b,unit:"W"},"P=VI","Multipliquem tensió i intensitat."); if(t==="rseries"){const R=listNums("ph-list").reduce((s,x)=>s+x,0);done("Resistències en sèrie","Req",{val:R,unit:"Ω"},"Req=R₁+R₂+...","Sumem totes les resistències.")} if(t==="rparallel"){const arr=listNums("ph-list");if(arr.some(x=>x===0))throw new Error("Cap resistència pot ser 0.");const R=1/arr.reduce((s,x)=>s+1/x,0);done("Resistències en paral·lel","Req",{val:R,unit:"Ω"},"1/Req=1/R₁+1/R₂+...","Sumem inverses i fem la inversa final.")} if(t==="coulomb"){nz(c,"La distància");done("Llei de Coulomb","F",{val:PH_K*a*b/(c*c),unit:"N"},"F=kq₁q₂/r²","Fem servir k≈8,99·10⁹.");note="El signe indica atracció o repulsió segons les càrregues."} if(t==="heat")done("Calor sensible","Q",{val:a*b*c,unit:"J"},"Q=mcΔT","Multipliquem massa, calor específica i canvi de temperatura."); if(t==="latent")done("Calor latent","Q",{val:a*b,unit:"J"},"Q=mL","Multipliquem massa i calor latent."); if(t==="idealgas"){nz(c,"Els mols");done("Gas ideal","T",{val:a*b/(c*PH_R),unit:"K"},"PV=nRT","Aïllem T=PV/(nR), amb R=0,082057.");note="Model ideal: és una aproximació."} render({title,summary,steps,extra:note?`<div class="subject-note">${note}</div>`:""})}catch(err){renderError("No s'ha pogut calcular l'apartat de física.",err.message)}});
const chT={"molar-mass":`<label>Fórmula química<input id="ch-formula" value="H2O"></label>`,"moles-mass":`<label>m (g)<input type="number" id="ch-a" value="18" step="any"></label><label>M (g/mol)<input type="number" id="ch-b" value="18.015" step="any"></label>`,"mass-moles":`<label>n (mol)<input type="number" id="ch-a" value="2" step="any"></label><label>M (g/mol)<input type="number" id="ch-b" value="18.015" step="any"></label>`,particles:`<label>n (mol)<input type="number" id="ch-a" value="0.5" step="any"></label>`,"percent-comp":`<label>Fórmula química<input id="ch-formula" value="CO2"></label>`,molarity:`<label>n (mol)<input type="number" id="ch-a" value="0.25" step="any"></label><label>V (L)<input type="number" id="ch-b" value="0.5" step="any"></label>`,dilution:`<label>C₁ (mol/L)<input type="number" id="ch-a" value="2" step="any"></label><label>V₁ (L)<input type="number" id="ch-b" value="0.1" step="any"></label><label>V₂ (L)<input type="number" id="ch-c" value="0.5" step="any"></label>`,"mass-percent":`<label>m solut (g)<input type="number" id="ch-a" value="5" step="any"></label><label>m dissolució (g)<input type="number" id="ch-b" value="100" step="any"></label>`,"sol-density":`<label>m (g)<input type="number" id="ch-a" value="120" step="any"></label><label>V (mL)<input type="number" id="ch-b" value="100" step="any"></label>`,"ph-h":`<label>[H⁺] (mol/L)<input type="number" id="ch-a" value="0.001" step="any"></label>`,"h-ph":`<label>pH<input type="number" id="ch-a" value="3" step="any"></label>`,poh:`<label>pOH<input type="number" id="ch-a" value="5" step="any"></label>`,"gas-n":`<label>P (atm)<input type="number" id="ch-a" value="1" step="any"></label><label>V (L)<input type="number" id="ch-b" value="22.4" step="any"></label><label>T (K)<input type="number" id="ch-c" value="273.15" step="any"></label>`,"gas-v":`<label>n (mol)<input type="number" id="ch-a" value="1" step="any"></label><label>T (K)<input type="number" id="ch-b" value="273.15" step="any"></label><label>P (atm)<input type="number" id="ch-c" value="1" step="any"></label>`,stoich:`<label>mols A<input type="number" id="ch-a" value="2" step="any"></label><label>coef A<input type="number" id="ch-b" value="2" step="any"></label><label>coef B<input type="number" id="ch-c" value="1" step="any"></label>`,limiting:`<label>mols A<input type="number" id="ch-a" value="3" step="any"></label><label>mols B<input type="number" id="ch-b" value="2" step="any"></label><label>coef A<input type="number" id="ch-c" value="1" step="any"></label><label>coef B<input type="number" id="ch-d" value="1" step="any"></label>`};
function updateChemistryInputs(){ $("chemistry-inputs").innerHTML=chT[$("chemistry-type").value] } $("chemistry-type").addEventListener("change",updateChemistryInputs);
function parseFormula(f){let i=0;function num(){let s="";while(i<f.length&&/[0-9]/.test(f[i]))s+=f[i++];return s?Number(s):1}function group(){const o={};while(i<f.length){if(f[i]==="("){i++;const inn=group();if(f[i]!==")")throw new Error("Parèntesi no tancat.");i++;const m=num();for(const e in inn)o[e]=(o[e]||0)+inn[e]*m}else if(f[i]===")")break;else if(/[A-Z]/.test(f[i])){let e=f[i++];if(i<f.length&&/[a-z]/.test(f[i]))e+=f[i++];if(!AT[e])throw new Error("Element no disponible: "+e);const m=num();o[e]=(o[e]||0)+m}else throw new Error("Fórmula no vàlida.")}return o}const c=group();if(i!==f.length)throw new Error("Fórmula no vàlida.");return c} function molMass(c){return Object.entries(c).reduce((s,[e,n])=>s+AT[e]*n,0)} function countStr(c){return Object.entries(c).map(([e,n])=>`${e}:${n}`).join(", ")}
$("chemistry-form").addEventListener("submit",e=>{e.preventDefault();try{const t=$("chemistry-type").value,a=maybe("ch-a"),b=maybe("ch-b"),c=maybe("ch-c"),d=maybe("ch-d");let title="Química",summary="",steps=[],note=""; if(t==="molar-mass"||t==="percent-comp"){const f=$("ch-formula").value.trim();const co=parseFormula(f),M=molMass(co); if(t==="molar-mass"){title="Massa molar";summary=`M(${f}) = <strong>${formatNumber(M)} g/mol</strong>`;steps=[`Interpretem la fórmula: <span class="math">${countStr(co)}</span>.`,`Multipliquem cada element per la seva massa atòmica.`,`Sumem: <span class="math">${formatNumber(M)} g/mol</span>.`];note="La taula interna cobreix els elements més habituals d'ESO i Batxillerat."}else{const parts=Object.entries(co).map(([e,n])=>`${e}: ${formatNumber(AT[e]*n/M*100)}%`);title="Composició percentual";summary=`<strong>${parts.join(" · ")}</strong>`;steps=[`Massa molar total: ${formatNumber(M)} g/mol.`,`Per cada element: massa de l'element / massa total · 100.`,`Resultat: ${parts.join("; ")}.`]}} if(t==="moles-mass"){nz(b,"La massa molar");title="Mols";summary=`n=<strong>${formatNumber(a/b)} mol</strong>`;steps=[`Apliquem <span class="math">n=m/M</span>.`,`Resultat: ${formatNumber(a/b)} mol.`]} if(t==="mass-moles"){title="Massa";summary=`m=<strong>${formatNumber(a*b)} g</strong>`;steps=[`Apliquem <span class="math">m=nM</span>.`,`Resultat: ${formatNumber(a*b)} g.`]} if(t==="particles"){title="Partícules";summary=`N=<strong>${formatNumber(a*NA)}</strong>`;steps=[`Apliquem <span class="math">N=n·NA</span>.`,`NA=6,022·10²³.`,`Resultat: ${formatNumber(a*NA)}.`]} if(t==="molarity"){nz(b,"El volum");title="Molaritat";summary=`C=<strong>${formatNumber(a/b)} mol/L</strong>`;steps=[`Apliquem C=n/V.`,`Resultat: ${formatNumber(a/b)} mol/L.`]} if(t==="dilution"){nz(c,"El volum final");title="Dilució";summary=`C₂=<strong>${formatNumber(a*b/c)} mol/L</strong>`;steps=[`Apliquem C₁V₁=C₂V₂.`,`Aïllem C₂=C₁V₁/V₂.`,`Resultat: ${formatNumber(a*b/c)} mol/L.`]} if(t==="mass-percent"){nz(b,"La massa de dissolució");title="% en massa";summary=`<strong>${formatNumber(a/b*100)}%</strong>`;steps=[`Apliquem % = m solut / m dissolució · 100.`,`Resultat: ${formatNumber(a/b*100)}%.`]} if(t==="sol-density"){nz(b,"El volum");title="Densitat de dissolució";summary=`ρ=<strong>${formatNumber(a/b)} g/mL</strong>`;steps=[`Apliquem ρ=m/V.`,`Resultat: ${formatNumber(a/b)} g/mL.`]} if(t==="ph-h"){posv(a,"[H⁺]");const p=-Math.log10(a);title="pH";summary=`pH=<strong>${formatNumber(p)}</strong>`;steps=[`Apliquem pH=-log[H⁺].`,`Resultat: ${formatNumber(p)}.`];note="A 25 °C: pH<7 àcid, pH=7 neutre, pH>7 bàsic."} if(t==="h-ph"){const H=10**(-a);title="[H⁺]";summary=`[H⁺]=<strong>${formatNumber(H)} mol/L</strong>`;steps=[`Aïllem [H⁺]=10^{-pH}.`,`Resultat: ${formatNumber(H)} mol/L.`]} if(t==="poh"){const pH=14-a;title="pOH i pH";summary=`pH=<strong>${formatNumber(pH)}</strong>`;steps=[`A 25 °C: pH+pOH=14.`,`pH=14-${formatNumber(a)}=${formatNumber(pH)}.`]} if(t==="gas-n"){nz(c,"La temperatura");title="Gas ideal";summary=`n=<strong>${formatNumber(a*b/(PH_R*c))} mol</strong>`;steps=[`PV=nRT.`,`Aïllem n=PV/RT amb R=0,082057.`,`Resultat: ${formatNumber(a*b/(PH_R*c))} mol.`]} if(t==="gas-v"){nz(c,"La pressió");title="Gas ideal";summary=`V=<strong>${formatNumber(a*PH_R*b/c)} L</strong>`;steps=[`PV=nRT.`,`Aïllem V=nRT/P.`,`Resultat: ${formatNumber(a*PH_R*b/c)} L.`]} if(t==="stoich"){nz(b,"coef A");title="Estequiometria";summary=`mols B=<strong>${formatNumber(a*c/b)} mol</strong>`;steps=[`Fem servir nB/nA=coefB/coefA.`,`nB=${formatNumber(a)}·${formatNumber(c)}/${formatNumber(b)}=${formatNumber(a*c/b)} mol.`]} if(t==="limiting"){posv(c,"coef A");posv(d,"coef B");const ra=a/c, rb=b/d, lim=ra<rb?"A":rb<ra?"B":"proporció exacta";title="Reactiu limitant";summary=`Limitant: <strong>${lim}</strong>`;steps=[`Comparem mols/coeficient.`,`A: ${formatNumber(ra)}; B: ${formatNumber(rb)}.`,`El valor més petit limita la reacció.`];note="Model simplificat per a coefA·A + coefB·B → productes."} render({title,summary,steps,extra:note?`<div class="subject-note">${note}</div>`:""})}catch(err){renderError("No s'ha pogut calcular l'apartat de química.",err.message)}});

/* Complex */
function cfmt(z){ return `${formatNumber(z.re)} ${z.im>=0?"+":"-"} ${formatNumber(Math.abs(z.im))}i`; }
$("complex-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const z={re:getNumber("z1-re"),im:getNumber("z1-im")}, w={re:getNumber("z2-re"),im:getNumber("z2-im")}, op=$("complex-op").value; let r, summary, steps=[];
    if(op==="+") r={re:z.re+w.re,im:z.im+w.im};
    if(op==="-") r={re:z.re-w.re,im:z.im-w.im};
    if(op==="*") r={re:z.re*w.re-z.im*w.im,im:z.re*w.im+z.im*w.re};
    if(op==="/"){ const den=w.re*w.re+w.im*w.im; if(den===0) throw new Error("No es pot dividir pel complex 0."); r={re:(z.re*w.re+z.im*w.im)/den,im:(z.im*w.re-z.re*w.im)/den};}
    if(op==="polar"){ const mod=Math.hypot(z.re,z.im), ang=Math.atan2(z.im,z.re)*180/Math.PI; return render({title:"Forma polar",summary:`${cfmt(z)} = <strong>${formatNumber(mod)} ∠ ${formatNumber(ang)}°</strong>`,steps:["El mòdul és <span class='math'>√(a²+b²)</span>.","L'argument és <span class='math'>atan2(b,a)</span>."]});}
    render({title:"Nombres complexos",summary:`Resultat: <strong>${cfmt(r)}</strong>`,steps:["Separem part real i part imaginària.","Apliquem les regles d'operació dels nombres complexos.",`Resultat final: <span class='math'>${cfmt(r)}</span>.`]});
  }catch(err){renderError("No s'ha pogut calcular amb complexos.",err.message);}
});

/* Matrix */
function updateMatrixInputs(){
  const op=$("matrix-op").value;
  const m2=`<label>A 2x2: a,b,c,d<input id="mat-a" value="1,2,3,4"></label>`;
  const b2=`<label>B 2x2: a,b,c,d<input id="mat-b" value="5,6,7,8"></label>`;
  const m3=`<label>A 3x3: 9 nombres per files<input id="mat-a" value="1,2,3,0,1,4,5,6,0"></label>`;
  $("matrix-inputs").innerHTML = op==="mul2" ? m2+b2 : op==="det3" ? m3 : m2;
}
$("matrix-op").addEventListener("change",updateMatrixInputs);
function parseList(id,n){ const a=$(id).value.split(",").map(Number); if(a.length!==n||a.some(v=>!Number.isFinite(v))) throw new Error(`Calen ${n} nombres.`); return a; }
$("matrix-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const op=$("matrix-op").value, A=parseList("mat-a",op==="det3"?9:4);
    if(op==="det2"||op==="inv2"){ const D=A[0]*A[3]-A[1]*A[2]; if(op==="det2") return render({title:"Determinant 2x2",summary:`det(A)=<strong>${formatNumber(D)}</strong>`,steps:[`Apliquem <span class='math'>ad-bc</span>.`,`det=${formatNumber(A[0])}·${formatNumber(A[3])}-${formatNumber(A[1])}·${formatNumber(A[2])}=${formatNumber(D)}.`]}); if(D===0) throw new Error("La matriu no té inversa perquè det=0."); return render({title:"Inversa 2x2",summary:`A⁻¹ = 1/${formatNumber(D)} · [[${formatNumber(A[3])}, ${formatNumber(-A[1])}], [${formatNumber(-A[2])}, ${formatNumber(A[0])}]]`,steps:["Calculem determinant.","Intercanviem a i d, canviem signe a b i c, i dividim per determinant."]});}
    if(op==="mul2"){ const B=parseList("mat-b",4); const R=[A[0]*B[0]+A[1]*B[2],A[0]*B[1]+A[1]*B[3],A[2]*B[0]+A[3]*B[2],A[2]*B[1]+A[3]*B[3]]; return render({title:"Producte 2x2",summary:`Resultat: <strong>[[${R.slice(0,2).map(formatNumber)}], [${R.slice(2).map(formatNumber)}]]</strong>`,steps:["Cada element surt de productes fila per columna.","Apliquem la regla del producte matricial."]});}
    const D=A[0]*(A[4]*A[8]-A[5]*A[7])-A[1]*(A[3]*A[8]-A[5]*A[6])+A[2]*(A[3]*A[7]-A[4]*A[6]);
    render({title:"Determinant 3x3",summary:`det(A)=<strong>${formatNumber(D)}</strong>`,steps:["Apliquem desenvolupament per la primera fila.","Calculem els menors 2x2 corresponents.","Sumem amb signes +, -, +."]});
  }catch(err){renderError("No s'ha pogut calcular la matriu.",err.message);}
});

/* Vectors */
function parseVector(id){ const v=$(id).value.split(",").map(Number); if(v.some(x=>!Number.isFinite(x))||v.length<2||v.length>3) throw new Error("Vector no vàlid. Usa x,y o x,y,z."); return v.length===2?[v[0],v[1],0]:v; }
$("vectors-form").addEventListener("submit",e=>{
  e.preventDefault(); try{
    const v=parseVector("vector-a"), w=parseVector("vector-b"), op=$("vector-op").value;
    const dot=v[0]*w[0]+v[1]*w[1]+v[2]*w[2], modv=Math.hypot(...v), modw=Math.hypot(...w);
    if(op==="add"){const r=v.map((x,i)=>x+w[i]); return render({title:"Suma de vectors",summary:`v+w = <strong>(${r.map(formatNumber).join(", ")})</strong>`,steps:["Sumem coordenada a coordenada."]});}
    if(op==="dot") return render({title:"Producte escalar",summary:`v·w = <strong>${formatNumber(dot)}</strong>`,steps:["Multipliquem components corresponents i les sumem."]});
    if(op==="cross"){const r=[v[1]*w[2]-v[2]*w[1],v[2]*w[0]-v[0]*w[2],v[0]*w[1]-v[1]*w[0]]; return render({title:"Producte vectorial",summary:`v×w = <strong>(${r.map(formatNumber).join(", ")})</strong>`,steps:["Fem servir la regla del determinant 3x3 amb i, j, k."]});}
    if(op==="modulus") return render({title:"Mòdul del vector",summary:`|v| = <strong>${formatNumber(modv)}</strong>`,steps:["Apliquem Pitàgores en 2D/3D: <span class='math'>√(x²+y²+z²)</span>."]});
    const angle=Math.acos(dot/(modv*modw))*180/Math.PI; render({title:"Angle entre vectors",summary:`θ = <strong>${formatNumber(angle)}°</strong>`,steps:["Fem servir <span class='math'>cosθ=(v·w)/(|v||w|)</span>.","Apliquem arccos per obtenir l'angle."]});
  }catch(err){renderError("No s'han pogut calcular els vectors.",err.message);}
});

/* Stats, combinatorics, number theory */
function parseData(){ const d=$("stats-data").value.split(",").map(Number).filter(Number.isFinite); if(!d.length) throw new Error("No hi ha dades vàlides."); return d; }
$("statistics-form").addEventListener("submit",e=>{ e.preventDefault(); try{ const d=parseData().sort((a,b)=>a-b), n=d.length, mean=d.reduce((a,b)=>a+b,0)/n, med=n%2?d[(n-1)/2]:(d[n/2-1]+d[n/2])/2, variance=d.reduce((s,x)=>s+(x-mean)**2,0)/n, sd=Math.sqrt(variance); render({title:"Estadística descriptiva",summary:`Mitjana=${formatNumber(mean)}, mediana=${formatNumber(med)}, σ=${formatNumber(sd)}`,steps:[`Ordenem les dades: <span class='math'>${d.join(", ")}</span>.`,`Mitjana: suma de dades dividida pel nombre de dades, <span class='math'>${formatNumber(mean)}</span>.`,`Mediana: valor central, <span class='math'>${formatNumber(med)}</span>.`,`Desviació típica: arrel de la variància, <span class='math'>${formatNumber(sd)}</span>.`]}); }catch(err){renderError("No s'ha pogut analitzar l'estadística.",err.message);} });
$("combinatorics-form").addEventListener("submit",e=>{ e.preventDefault(); try{ const op=$("comb-op").value, n=getNumber("comb-n"), r=getNumber("comb-r"), inter=getNumber("comb-intersection"); if(op==="factorial") return render({title:"Factorial",summary:`${n}! = <strong>${formatNumber(factorial(n))}</strong>`,steps:["Multipliquem tots els enters de 1 fins a n."]}); if(op==="perm") return render({title:"Permutacions",summary:`P(n,r)=<strong>${formatNumber(factorial(n)/factorial(n-r))}</strong>`,steps:["Importa l'ordre.","Apliquem <span class='math'>n!/(n-r)!</span>."]}); if(op==="comb") return render({title:"Combinacions",summary:`C(n,r)=<strong>${formatNumber(factorial(n)/(factorial(r)*factorial(n-r)))}</strong>`,steps:["No importa l'ordre.","Apliquem <span class='math'>n!/(r!(n-r)!)</span>."]}); render({title:"Probabilitat de la unió",summary:`P(A∪B)=<strong>${formatNumber(n+r-inter)}</strong>`,steps:["Apliquem inclusió-exclusió.","<span class='math'>P(A∪B)=P(A)+P(B)-P(A∩B)</span>."]}); }catch(err){renderError("No s'ha pogut calcular la combinatòria.",err.message);} });
function primeFactors(n){ n=Math.abs(Math.trunc(n)); const f=[]; for(let p=2;p*p<=n;p++){while(n%p===0){f.push(p);n/=p}} if(n>1) f.push(n); return f; }
$("numbertheory-form").addEventListener("submit",e=>{ e.preventDefault(); try{ const op=$("number-op").value, a=Math.trunc(getNumber("num-a")), b=Math.trunc(getNumber("num-b")); if(op==="prime-factors") return render({title:"Factors primers",summary:`${a} = <strong>${primeFactors(a).join(" · ")}</strong>`,steps:["Dividim successivament pels primers 2,3,5,7...","Quan ja no es pot dividir, passem al primer següent."]}); if(op==="gcd-lcm") return render({title:"MCD i mcm",summary:`MCD=${gcd(a,b)}, mcm=${lcm(a,b)}`,steps:["El MCD és el màxim divisor comú.","El mcm es calcula amb <span class='math'>|ab|/MCD</span>."]}); const min=Math.min(a,b), max=Math.max(a,b), val=Math.floor(Math.random()*(max-min+1))+min; render({title:"Nombre aleatori",summary:`Aleatori entre ${min} i ${max}: <strong>${val}</strong>`,steps:["Generem un enter dins de l'interval tancat.","És útil per simulacions senzilles i exercicis."]}); }catch(err){renderError("No s'ha pogut calcular.",err.message);} });

/* Geometry */
const geomTemplates={
 square:`<label>Costat<input type="number" id="g-a" value="5" step="any"></label>`,
 rectangle:`<label>Base<input type="number" id="g-a" value="8" step="any"></label><label>Altura<input type="number" id="g-b" value="3" step="any"></label>`,
 triangle:`<label>Base<input type="number" id="g-a" value="10" step="any"></label><label>Altura<input type="number" id="g-b" value="6" step="any"></label>`,
 trapezoid:`<label>Base major<input type="number" id="g-a" value="10" step="any"></label><label>Base menor<input type="number" id="g-b" value="6" step="any"></label><label>Altura<input type="number" id="g-c" value="4" step="any"></label>`,
 circle:`<label>Radi<input type="number" id="g-a" value="5" step="any"></label>`,
 "regular-polygon":`<label>Nombre de costats<input type="number" id="g-a" value="6" step="1"></label><label>Costat<input type="number" id="g-b" value="4" step="any"></label><label>Apotema<input type="number" id="g-c" value="3.46" step="any"></label>`,
 cube:`<label>Costat<input type="number" id="g-a" value="4" step="any"></label>`,
 "rect-prism":`<label>Llargada<input type="number" id="g-a" value="8" step="any"></label><label>Amplada<input type="number" id="g-b" value="5" step="any"></label><label>Altura<input type="number" id="g-c" value="3" step="any"></label>`,
 cylinder:`<label>Radi<input type="number" id="g-a" value="3" step="any"></label><label>Altura<input type="number" id="g-b" value="7" step="any"></label>`,
 cone:`<label>Radi<input type="number" id="g-a" value="3" step="any"></label><label>Altura<input type="number" id="g-b" value="7" step="any"></label>`,
 sphere:`<label>Radi<input type="number" id="g-a" value="6" step="any"></label>`,
 "pythagoras-h":`<label>Catet a<input type="number" id="g-a" value="3" step="any"></label><label>Catet b<input type="number" id="g-b" value="4" step="any"></label>`,
 "pythagoras-leg":`<label>Hipotenusa<input type="number" id="g-a" value="5" step="any"></label><label>Catet conegut<input type="number" id="g-b" value="4" step="any"></label>`
};
function updateGeom(){ $("geometry-inputs").innerHTML=geomTemplates[$("geometry-type").value]; }
$("geometry-type").addEventListener("change",updateGeom);
function pos(x,name){ if(x<=0) throw new Error(`${name} ha de ser positiu.`); }
$("geometry-form").addEventListener("submit",e=>{ e.preventDefault(); try{ const t=$("geometry-type").value, a=getNumber("g-a"), b=$("g-b")?getNumber("g-b"):0, c=$("g-c")?getNumber("g-c"):0; let title="",summary="",steps=[]; pos(a,"La primera mesura"); if(b)pos(b,"La segona mesura"); if(c)pos(c,"La tercera mesura");
 if(t==="square"){title="Quadrat";summary=`A=${formatNumber(a*a)}, P=${formatNumber(4*a)}`;steps=["Àrea costat² i perímetre 4·costat."];}
 if(t==="rectangle"){title="Rectangle";summary=`A=${formatNumber(a*b)}, P=${formatNumber(2*(a+b))}`;steps=["Àrea base·altura i perímetre 2(base+altura)."];}
 if(t==="triangle"){title="Triangle";summary=`A=${formatNumber(a*b/2)}`;steps=["Un triangle és la meitat d'un rectangle de la mateixa base i altura."];}
 if(t==="trapezoid"){title="Trapezi";summary=`A=${formatNumber((a+b)*c/2)}`;steps=["Fem la mitjana de les bases i multipliquem per l'altura."];}
 if(t==="circle"){title="Cercle";summary=`A=${formatNumber(Math.PI*a*a)}, C=${formatNumber(2*Math.PI*a)}`;steps=["Àrea πr² i circumferència 2πr."];}
 if(t==="regular-polygon"){title="Polígon regular";summary=`P=${formatNumber(a*b)}, A=${formatNumber(a*b*c/2)}`;steps=["Perímetre = nombre de costats · costat.","Àrea = perímetre · apotema / 2."];}
 if(t==="cube"){title="Cub";summary=`V=${formatNumber(a**3)}, S=${formatNumber(6*a*a)}`;steps=["Volum costat³ i superfície 6·costat²."];}
 if(t==="rect-prism"){title="Prisma rectangular";summary=`V=${formatNumber(a*b*c)}`;steps=["Volum = llargada · amplada · altura."];}
 if(t==="cylinder"){title="Cilindre";summary=`V=${formatNumber(Math.PI*a*a*b)}`;steps=["Àrea de la base πr² i volum base·altura."];}
 if(t==="cone"){title="Con";summary=`V=${formatNumber(Math.PI*a*a*b/3)}`;steps=["El con ocupa un terç del cilindre amb la mateixa base i altura."];}
 if(t==="sphere"){title="Esfera";summary=`V=${formatNumber(4*Math.PI*a**3/3)}`;steps=["Volum = (4/3)πr³."];}
 if(t==="pythagoras-h"){title="Pitàgores";summary=`Hipotenusa=${formatNumber(Math.hypot(a,b))}`;steps=["Apliquem a²+b²=c² i fem l'arrel quadrada."];}
 if(t==="pythagoras-leg"){ if(a<=b) throw new Error("La hipotenusa ha de ser més gran que el catet."); title="Pitàgores";summary=`Catet=${formatNumber(Math.sqrt(a*a-b*b))}`;steps=["Aïllem el catet: catet² = hipotenusa² - catet conegut²."];}
 render({title,summary:`<strong>${summary}</strong>`,steps}); }catch(err){renderError("No s'ha pogut calcular la geometria.",err.message);} });

/* Units and formulas */
const unitDefs={length:{base:"m",units:{km:1000,hm:100,dam:10,m:1,dm:.1,cm:.01,mm:.001}},mass:{base:"g",units:{kg:1000,hg:100,dag:10,g:1,dg:.1,cg:.01,mg:.001}},capacity:{base:"L",units:{kL:1000,hL:100,daL:10,L:1,dL:.1,cL:.01,mL:.001}},area:{base:"m²",units:{"km²":1e6,"hm²":1e4,"dam²":100,"m²":1,"dm²":.01,"cm²":1e-4,"mm²":1e-6}},volume:{base:"m³",units:{"m³":1,"dm³":.001,"cm³":1e-6,L:.001,mL:1e-6}},speed:{base:"m/s",units:{"m/s":1,"km/h":1/3.6}},energy:{base:"J",units:{J:1,kJ:1000,cal:4.184,kcal:4184}},temperature:{base:"°C",units:{"°C":"c","°F":"f",K:"k"}}};
function updateUnits(){ const def=unitDefs[$("unit-category").value], units=Object.keys(def.units); $("unit-from").innerHTML=units.map(u=>`<option>${u}</option>`).join(""); $("unit-to").innerHTML=units.map(u=>`<option>${u}</option>`).join(""); if(units[1]) $("unit-to").value=units[1]; }
$("unit-category").addEventListener("change",updateUnits);
function toC(v,u){return u==="°C"?v:u==="°F"?(v-32)*5/9:v-273.15} function fromC(v,u){return u==="°C"?v:u==="°F"?v*9/5+32:v+273.15}
$("units-form").addEventListener("submit",e=>{e.preventDefault(); try{const cat=$("unit-category").value,v=getNumber("unit-value"),from=$("unit-from").value,to=$("unit-to").value,def=unitDefs[cat]; let r,steps; if(cat==="temperature"){const c=toC(v,from);r=fromC(c,to);steps=[`Primer passem a Celsius: ${formatNumber(c)} °C.`,`Després passem a ${to}: ${formatNumber(r)} ${to}.`];} else {const base=v*def.units[from]; r=base/def.units[to]; steps=[`Convertim a unitat base ${def.base}: ${formatNumber(base)} ${def.base}.`,`Convertim a la unitat final: ${formatNumber(r)} ${to}.`];} render({title:"Conversió d'unitats",summary:`${formatNumber(v)} ${from} = <strong>${formatNumber(r)} ${to}</strong>`,steps});}catch(err){renderError("No s'ha pogut convertir.",err.message);}});

const formulaBank={math:[
["Equació quadràtica","x=(-b±√(b²-4ac))/(2a)","Resol equacions de segon grau."],["Pitàgores","a²+b²=c²","Relaciona els costats d'un triangle rectangle."],["Pendent","m=(y₂-y₁)/(x₂-x₁)","Mesura la inclinació d'una recta."],["Combinacions","C(n,r)=n!/(r!(n-r)!)","Tria elements sense importar l'ordre."],["Mitjana","x̄=(Σxᵢ)/n","Resumeix un conjunt de dades."]
],physics:[
["MRU","v=Δx/Δt","Moviment rectilini uniforme."],["MRUA","v=v₀+at; x=x₀+v₀t+½at²","Moviment amb acceleració constant."],["Newton","F=ma","Relaciona força, massa i acceleració."],["Treball","W=Fd cosθ","Energia transferida per una força."],["Energia","Ec=½mv²; Ep=mgh","Energia cinètica i potencial."],["Fluids","p=F/S; p=ρgh","Pressió i pressió hidrostàtica."],["Ones","v=λf","Relació entre velocitat, longitud d'ona i freqüència."],["Ohm","V=IR","Electricitat bàsica."],["Gas ideal","PV=nRT","Model ideal de gasos."]
],chemistry:[
["Mols","n=m/M","Relaciona massa i massa molar."],["Partícules","N=n·NA","Relaciona mols i nombre de partícules."],["Molaritat","C=n/V","Concentració en mols per litre."],["Dilució","C₁V₁=C₂V₂","Conservació de mols de solut."],["pH","pH=-log[H⁺]","Mesura l'acidesa."],["pOH","pH+pOH=14","Relació a 25 °C."],["Gas ideal","PV=nRT","Gasos en química."],["Composició percentual","% element = massa element / massa total · 100","Percentatge en massa."],["Estequiometria","nB=nA·coefB/coefA","Relació molar segons l'equació ajustada."]
]};
function updateFormulaSelect(){ const cat=$("formula-category").value; $("formula-select").innerHTML=formulaBank[cat].map((f,i)=>`<option value="${i}">${f[0]}</option>`).join("");}
$("formula-category").addEventListener("change",updateFormulaSelect);
$("formulas-form").addEventListener("submit",e=>{e.preventDefault(); const f=formulaBank[$("formula-category").value][Number($("formula-select").value)]; render({title:f[0],summary:`<span class="math">${f[1]}</span>`,steps:[f[2],"Identifica les dades, substitueix-les amb unitats coherents i comprova si el resultat té sentit."]});});


/* Compact Physics/Chemistry support */
const G_EARTH = 9.81;
const GAS_R = 0.082057;
const AVOGADRO = 6.022e23;
const ATOMIC_MASS = {H:1.008,C:12.011,N:14.007,O:15.999,Na:22.990,Mg:24.305,Al:26.982,Si:28.085,P:30.974,S:32.06,Cl:35.45,K:39.098,Ca:40.078,Fe:55.845,Cu:63.546,Zn:65.38,Br:79.904,I:126.904};
const physicsTemplates = {
  mru:`<label>Δx (m)<input type="number" id="ph-a" value="100" step="any"></label><label>Δt (s)<input type="number" id="ph-b" value="20" step="any"></label>`,
  "mrua-velocity":`<label>v₀ (m/s)<input type="number" id="ph-a" value="3" step="any"></label><label>a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label><label>t (s)<input type="number" id="ph-c" value="5" step="any"></label>`,
  newton:`<label>m (kg)<input type="number" id="ph-a" value="10" step="any"></label><label>a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label>`,
  kinetic:`<label>m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>v (m/s)<input type="number" id="ph-b" value="10" step="any"></label>`,
  ohm:`<label>I (A)<input type="number" id="ph-a" value="2" step="any"></label><label>R (Ω)<input type="number" id="ph-b" value="5" step="any"></label>`,
  heat:`<label>m (kg)<input type="number" id="ph-a" value="1" step="any"></label><label>c (J/kg·K)<input type="number" id="ph-b" value="4180" step="any"></label><label>ΔT<input type="number" id="ph-c" value="10" step="any"></label>`,
  "ideal-gas":`<label>P (atm)<input type="number" id="ph-a" value="1" step="any"></label><label>V (L)<input type="number" id="ph-b" value="22.4" step="any"></label><label>n (mol)<input type="number" id="ph-c" value="1" step="any"></label>`
};
function updatePhysicsInputs(){ if($("physics-inputs")) $("physics-inputs").innerHTML = physicsTemplates[$("physics-type").value]; }
if($("physics-type")) $("physics-type").addEventListener("change", updatePhysicsInputs);
function getMaybe(id){ return $(id) ? getNumber(id) : null; }
function requireNonZero(value, name){ if(value===0) throw new Error(`${name} no pot ser 0.`); }
if($("physics-form")) $("physics-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const t=$("physics-type").value, a=getMaybe("ph-a"), b=getMaybe("ph-b"), c=getMaybe("ph-c");
    let title="Física", summary="", steps=[];
    if(t==="mru"){ requireNonZero(b,"El temps"); const v=a/b; title="MRU"; summary=`v=<strong>${formatNumber(v)} m/s</strong>`; steps=[`Apliquem <span class="math">v=Δx/Δt</span>.`,`Resultat: ${formatNumber(v)} m/s.`];}
    if(t==="mrua-velocity"){ const v=a+b*c; title="MRUA"; summary=`v=<strong>${formatNumber(v)} m/s</strong>`; steps=[`Apliquem <span class="math">v=v₀+at</span>.`,`Resultat: ${formatNumber(v)} m/s.`];}
    if(t==="newton"){ const F=a*b; title="Newton"; summary=`F=<strong>${formatNumber(F)} N</strong>`; steps=[`Apliquem <span class="math">F=ma</span>.`];}
    if(t==="kinetic"){ const E=0.5*a*b*b; title="Energia cinètica"; summary=`Ec=<strong>${formatNumber(E)} J</strong>`; steps=[`Apliquem <span class="math">Ec=½mv²</span>.`];}
    if(t==="ohm"){ const V=a*b; title="Llei d’Ohm"; summary=`V=<strong>${formatNumber(V)} V</strong>`; steps=[`Apliquem <span class="math">V=IR</span>.`];}
    if(t==="heat"){ const Q=a*b*c; title="Calor"; summary=`Q=<strong>${formatNumber(Q)} J</strong>`; steps=[`Apliquem <span class="math">Q=mcΔT</span>.`];}
    if(t==="ideal-gas"){ requireNonZero(c,"Els mols"); const T=a*b/(c*GAS_R); title="Gas ideal"; summary=`T=<strong>${formatNumber(T)} K</strong>`; steps=[`Apliquem <span class="math">PV=nRT</span>.`];}
    render({title, summary, steps});
  } catch(err) { renderError("No s'ha pogut calcular física.", err.message); }
});
function parseFormula(formula) {
  let i=0;
  function readNumber(){ let n=""; while(i<formula.length && /[0-9]/.test(formula[i])) n+=formula[i++]; return n?Number(n):1; }
  function group(){
    const counts={};
    while(i<formula.length){
      if(formula[i]==="("){ i++; const inner=group(); if(formula[i]!==")") throw new Error("Parèntesi no tancat."); i++; const mult=readNumber(); for(const [el,c] of Object.entries(inner)) counts[el]=(counts[el]||0)+c*mult; }
      else if(formula[i]===")") break;
      else if(/[A-Z]/.test(formula[i])){ let el=formula[i++]; if(i<formula.length && /[a-z]/.test(formula[i])) el+=formula[i++]; if(!ATOMIC_MASS[el]) throw new Error(`Element no disponible: ${el}`); counts[el]=(counts[el]||0)+readNumber(); }
      else throw new Error("Fórmula no vàlida.");
    }
    return counts;
  }
  const counts=group(); if(i!==formula.length) throw new Error("Fórmula no vàlida."); return counts;
}
function molarMassFromCounts(counts){ return Object.entries(counts).reduce((s,[el,c])=>s+ATOMIC_MASS[el]*c,0); }
function formulaBreakdown(counts){ return Object.entries(counts).map(([el,c])=>`${el}: ${c}`).join(", "); }
const chemistryTemplates = {
  "molar-mass":`<label>Fórmula química<input id="ch-formula" value="H2O"></label>`,
  "moles-from-mass":`<label>m (g)<input type="number" id="ch-a" value="18" step="any"></label><label>M (g/mol)<input type="number" id="ch-b" value="18.015" step="any"></label>`,
  molarity:`<label>n (mol)<input type="number" id="ch-a" value="0.25" step="any"></label><label>V (L)<input type="number" id="ch-b" value="0.5" step="any"></label>`,
  "ph-from-h":`<label>[H⁺] mol/L<input type="number" id="ch-a" value="0.001" step="any"></label>`,
  "gas-moles":`<label>P (atm)<input type="number" id="ch-a" value="1" step="any"></label><label>V (L)<input type="number" id="ch-b" value="22.4" step="any"></label><label>T (K)<input type="number" id="ch-c" value="273.15" step="any"></label>`
};
function updateChemistryInputs(){ if($("chemistry-inputs")) $("chemistry-inputs").innerHTML = chemistryTemplates[$("chemistry-type").value]; }
if($("chemistry-type")) $("chemistry-type").addEventListener("change", updateChemistryInputs);
if($("chemistry-form")) $("chemistry-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const t=$("chemistry-type").value, a=getMaybe("ch-a"), b=getMaybe("ch-b"), c=getMaybe("ch-c");
    let title="Química", summary="", steps=[];
    if(t==="molar-mass"){ const f=$("ch-formula").value.trim(); const counts=parseFormula(f); const M=molarMassFromCounts(counts); title="Massa molar"; summary=`M(${f})=<strong>${formatNumber(M)} g/mol</strong>`; steps=[`Interpretem: ${formulaBreakdown(counts)}.`,`Sumem les masses atòmiques.`];}
    if(t==="moles-from-mass"){ requireNonZero(b,"M"); const n=a/b; title="Mols"; summary=`n=<strong>${formatNumber(n)} mol</strong>`; steps=[`Apliquem <span class="math">n=m/M</span>.`];}
    if(t==="molarity"){ requireNonZero(b,"V"); const C=a/b; title="Molaritat"; summary=`C=<strong>${formatNumber(C)} mol/L</strong>`; steps=[`Apliquem <span class="math">C=n/V</span>.`];}
    if(t==="ph-from-h"){ const pH=-Math.log10(a); title="pH"; summary=`pH=<strong>${formatNumber(pH)}</strong>`; steps=[`Apliquem <span class="math">pH=-log[H⁺]</span>.`];}
    if(t==="gas-moles"){ const n=a*b/(GAS_R*c); title="Mols de gas"; summary=`n=<strong>${formatNumber(n)} mol</strong>`; steps=[`Apliquem <span class="math">n=PV/RT</span>.`];}
    render({title, summary, steps});
  } catch(err) { renderError("No s'ha pogut calcular química.", err.message); }
});


/* V7: periodic table and study mode */
const PERIODIC_ELEMENTS_V7 = [
  {n:1,s:"H",name:"Hidrogen",mass:1.008,group:"No metall",use:"Aigua, àcids, combustibles i química orgànica."},
  {n:2,s:"He",name:"Heli",mass:4.003,group:"Gas noble",use:"Globus, criogènia i atmosferes inertes."},
  {n:3,s:"Li",name:"Liti",mass:6.94,group:"Metall alcalí",use:"Bateries i aliatges lleugers."},
  {n:4,s:"Be",name:"Beril·li",mass:9.012,group:"Metall alcalinoterri",use:"Aliatges especials."},
  {n:5,s:"B",name:"Bor",mass:10.81,group:"Semimetall",use:"Vidres borosilicats i detergents."},
  {n:6,s:"C",name:"Carboni",mass:12.011,group:"No metall",use:"Base de la química orgànica."},
  {n:7,s:"N",name:"Nitrogen",mass:14.007,group:"No metall",use:"Aire, proteïnes i fertilitzants."},
  {n:8,s:"O",name:"Oxigen",mass:15.999,group:"No metall",use:"Respiració, combustió i òxids."},
  {n:9,s:"F",name:"Fluor",mass:18.998,group:"Halogen",use:"Fluorurs i materials especials."},
  {n:10,s:"Ne",name:"Neó",mass:20.180,group:"Gas noble",use:"Rètols lluminosos."},
  {n:11,s:"Na",name:"Sodi",mass:22.990,group:"Metall alcalí",use:"Sal comuna i reaccions iòniques."},
  {n:12,s:"Mg",name:"Magnesi",mass:24.305,group:"Metall alcalinoterri",use:"Aliatges i focs artificials."},
  {n:13,s:"Al",name:"Alumini",mass:26.982,group:"Metall",use:"Envasos, construcció i transport."},
  {n:14,s:"Si",name:"Silici",mass:28.085,group:"Semimetall",use:"Vidre, ceràmica i electrònica."},
  {n:15,s:"P",name:"Fòsfor",mass:30.974,group:"No metall",use:"ADN, fertilitzants i fosfats."},
  {n:16,s:"S",name:"Sofre",mass:32.06,group:"No metall",use:"Sulfats, vulcanització i àcid sulfúric."},
  {n:17,s:"Cl",name:"Clor",mass:35.45,group:"Halogen",use:"Sal, desinfecció i clorurs."},
  {n:18,s:"Ar",name:"Argó",mass:39.948,group:"Gas noble",use:"Bombetes i atmosferes inertes."},
  {n:19,s:"K",name:"Potassi",mass:39.098,group:"Metall alcalí",use:"Fertilitzants i equilibri cel·lular."},
  {n:20,s:"Ca",name:"Calci",mass:40.078,group:"Metall alcalinoterri",use:"Ossos, calcàries i ciments."},
  {n:26,s:"Fe",name:"Ferro",mass:55.845,group:"Metall de transició",use:"Acer, estructures i hemoglobina."},
  {n:29,s:"Cu",name:"Coure",mass:63.546,group:"Metall de transició",use:"Cables elèctrics i aliatges."},
  {n:30,s:"Zn",name:"Zinc",mass:65.38,group:"Metall de transició",use:"Galvanitzat i aliatges."},
  {n:35,s:"Br",name:"Brom",mass:79.904,group:"Halogen",use:"Sals bromur i química orgànica."},
  {n:47,s:"Ag",name:"Plata",mass:107.868,group:"Metall de transició",use:"Joieria, fotografia i conductivitat."},
  {n:53,s:"I",name:"Iode",mass:126.904,group:"Halogen",use:"Tiroides, antisèptics i iodurs."},
  {n:56,s:"Ba",name:"Bari",mass:137.327,group:"Metall alcalinoterri",use:"Contrasts radiològics i sals."},
  {n:82,s:"Pb",name:"Plom",mass:207.2,group:"Metall",use:"Bateries i protecció radiològica."}
];

function ensureAtomicMassV7(){
  if (typeof ATOMIC_MASS !== "undefined") {
    PERIODIC_ELEMENTS_V7.forEach(el => { if (!ATOMIC_MASS[el.s]) ATOMIC_MASS[el.s] = el.mass; });
  }
}

function updatePeriodicSelectV7(){
  if(!$("periodic-element")) return;
  ensureAtomicMassV7();
  $("periodic-element").innerHTML = PERIODIC_ELEMENTS_V7
    .map(el => `<option value="${el.s}">${el.n}. ${el.name} (${el.s})</option>`)
    .join("");
  updatePeriodicCardV7();
}

function updatePeriodicCardV7(){
  if(!$("periodic-card") || !$("periodic-element")) return;
  const el = PERIODIC_ELEMENTS_V7.find(item => item.s === $("periodic-element").value) || PERIODIC_ELEMENTS_V7[0];
  $("periodic-card").innerHTML = `
    <div class="periodic-symbol">${el.s}</div>
    <div class="periodic-meta">
      <strong>${el.name}</strong>
      <span>Número atòmic: ${el.n}</span>
      <span>Massa atòmica: ${formatNumber(el.mass)} u</span>
      <span>Família: ${el.group}</span>
      <span>Ús o context: ${el.use}</span>
    </div>
  `;
}

if($("periodic-element")) $("periodic-element").addEventListener("change", updatePeriodicCardV7);

if($("periodic-form")) $("periodic-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    ensureAtomicMassV7();
    const selected = PERIODIC_ELEMENTS_V7.find(item => item.s === $("periodic-element").value) || PERIODIC_ELEMENTS_V7[0];
    const formula = $("periodic-formula").value.trim();
    let summary = `<strong>${selected.name}</strong> (${selected.s}), Z=${selected.n}, massa atòmica=${formatNumber(selected.mass)} u.`;
    let steps = [
      `L'element seleccionat és <span class="math">${selected.s}</span>, de la família ${selected.group}.`,
      `La seva massa atòmica aproximada és <span class="math">${formatNumber(selected.mass)} u</span>.`
    ];

    if(formula){
      const counts = parseFormula(formula);
      const M = molarMassFromCounts(counts);
      summary += `<br>Massa molar de <strong>${formula}</strong>: <strong>${formatNumber(M)} g/mol</strong>.`;
      steps.push(`Interpretem la fórmula: <span class="math">${formulaBreakdown(counts)}</span>.`);
      steps.push("Multipliquem cada element pel nombre d'àtoms que apareixen a la fórmula.");
      steps.push(`Sumem les masses i obtenim <span class="math">${formatNumber(M)} g/mol</span>.`);
    }

    render({
      title: "Taula periòdica i massa molar",
      summary,
      steps,
      extra: `<div class="subject-note">La taula periòdica de la v7 és bàsica i pensada per ESO/Batxillerat. Es pot ampliar amb tots els elements en una v8.</div>`
    });
  } catch(err) {
    renderError("No s'ha pogut consultar la taula periòdica.", err.message);
  }
});

const STUDY_TOPICS_V7 = {
  mechanics: {
    title: "Física: mecànica",
    formulas: ["v=Δx/Δt", "a=Δv/Δt", "v=v₀+at", "x=x₀+v₀t+½at²", "F=ma", "P=mg"],
    steps: ["Identifica si el moviment és uniforme o accelerat.", "Tria el sistema d'unitats SI.", "Substitueix dades i comprova si el signe té sentit."],
    mistakes: ["Confondre massa i pes.", "Fer servir km/h amb segons sense convertir.", "Oblidar que l'acceleració pot ser negativa."]
  },
  energy: {
    title: "Física: energia i treball",
    formulas: ["W=Fd cosθ", "P=W/t", "Ec=½mv²", "Ep=mgh", "Em=Ec+Ep"],
    steps: ["Identifica si hi ha treball, energia cinètica o potencial.", "Comprova si hi ha fregament o si es conserva l'energia.", "Expressa el resultat en joules."],
    mistakes: ["Oblidar el cosinus de l'angle.", "No elevar la velocitat al quadrat.", "Barrejar massa en grams amb kg."]
  },
  electricity: {
    title: "Física: electricitat",
    formulas: ["V=IR", "P=VI", "E=Pt", "R_sèrie=R₁+R₂+...", "1/R_paral·lel=1/R₁+1/R₂+..."],
    steps: ["Dibuixa o identifica el circuit.", "Decideix si les resistències són en sèrie o paral·lel.", "Aplica Ohm o potència elèctrica."],
    mistakes: ["Sumar resistències en paral·lel com si fossin en sèrie.", "Confondre V, I i R.", "No convertir hores a segons si cal energia en joules."]
  },
  waves: {
    title: "Física: ones i òptica",
    formulas: ["v=λf", "T=1/f", "1/f=1/do+1/di"],
    steps: ["Identifica longitud d'ona, freqüència i període.", "Usa unitats coherents.", "En òptica, vigila el conveni de signes."],
    mistakes: ["Confondre període amb freqüència.", "Fer servir cm i m barrejats.", "Oblidar que la freqüència es mesura en Hz."]
  },
  "chem-moles": {
    title: "Química: mols i massa molar",
    formulas: ["n=m/M", "m=nM", "N=n·NA", "NA=6,022·10²³"],
    steps: ["Calcula primer la massa molar.", "Passa de grams a mols amb n=m/M.", "Passa de mols a partícules amb Avogadro."],
    mistakes: ["Fer servir massa atòmica sense multiplicar pels subíndexs.", "Confondre grams i mols.", "Oblidar els parèntesis en fórmules com Ca(OH)₂."]
  },
  solutions: {
    title: "Química: dissolucions",
    formulas: ["C=n/V", "C₁V₁=C₂V₂", "%m/m=m_solut/m_dissolució·100"],
    steps: ["Identifica solut, dissolvent i dissolució.", "Converteix el volum a litres si uses molaritat.", "En dilucions, conserva els mols de solut."],
    mistakes: ["Fer servir mL en lloc de L en molaritat.", "Confondre massa de solut amb massa de dissolució.", "Pensar que afegir aigua canvia els mols de solut."]
  },
  "acid-base": {
    title: "Química: pH i àcid-base",
    formulas: ["pH=-log[H⁺]", "[H⁺]=10^-pH", "pH+pOH=14"],
    steps: ["Identifica si tens concentració o pH.", "Aplica logaritmes amb base 10.", "Interpreta: pH<7 àcid, pH=7 neutre, pH>7 bàsic a 25 °C."],
    mistakes: ["Oblidar el signe menys del logaritme.", "Fer servir ln en lloc de log base 10.", "Aplicar pH+pOH=14 fora de condicions estàndard sense cura."]
  },
  stoich: {
    title: "Química: estequiometria",
    formulas: ["nB=nA·coefB/coefA", "n=m/M", "m=nM"],
    steps: ["Ajusta l'equació química.", "Passa les masses a mols.", "Aplica la proporció dels coeficients.", "Si hi ha dos reactius, busca el limitant."],
    mistakes: ["No ajustar l'equació.", "Fer proporcions amb grams directament.", "No detectar el reactiu limitant."]
  }
};

if($("study-form")) $("study-form").addEventListener("submit", event => {
  event.preventDefault();
  const topic = STUDY_TOPICS_V7[$("study-topic").value];
  const extra = `
    <div class="study-grid">
      <section class="study-block"><h4>Fórmules clau</h4><ul class="formula-mini-list">${topic.formulas.map(f=>`<li><span class="math">${f}</span></li>`).join("")}</ul></section>
      <section class="study-block"><h4>Passos recomanats</h4><ul class="formula-mini-list">${topic.steps.map(s=>`<li>${s}</li>`).join("")}</ul></section>
      <section class="study-block"><h4>Errors típics</h4><ul class="formula-mini-list">${topic.mistakes.map(s=>`<li>${s}</li>`).join("")}</ul></section>
    </div>
  `;
  render({
    title: topic.title,
    summary: "Fitxa de repàs generada per estudiar i comprovar exercicis.",
    extra,
    steps: [
      "Llegeix primer les fórmules i identifica quines magnituds apareixen.",
      "Fes un exemple senzill substituint dades.",
      "Revisa els errors típics abans de donar el resultat per bo."
    ]
  });
});

updatePeriodicSelectV7();


/* V8: advanced graphing, trace, themes, extra science helpers */
function evaluateExpressionWithT(expr, mode, tValue){
  const converted = expr.replace(/\bt\b/g, `(${tValue})`).replace(/\btheta\b/g, `(${tValue})`);
  return evaluateExpression(converted, mode).value;
}

function buildAdvancedCanvas(points, scale, title){
  const canvas = document.createElement("canvas");
  canvas.className = "function-canvas";
  canvas.width = 720;
  canvas.height = 720;
  canvas.setAttribute("aria-label", title || "Gràfica avançada");
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  let currentScale = scale || 5;
  let offsetX = 0, offsetY = 0;

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,W,H);
    const unit = (W * 0.42) / currentScale;
    const cx = W/2 + offsetX;
    const cy = H/2 + offsetY;

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for(let i=-Math.ceil(currentScale*2); i<=Math.ceil(currentScale*2); i++){
      ctx.beginPath(); ctx.moveTo(cx+i*unit, 0); ctx.lineTo(cx+i*unit, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy+i*unit); ctx.lineTo(W, cy+i*unit); ctx.stroke();
    }

    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();

    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    let started = false;
    for(const p of points){
      if(!Number.isFinite(p.x) || !Number.isFinite(p.y)){ started = false; continue; }
      const x = cx + p.x * unit;
      const y = cy - p.y * unit;
      if(!started){ ctx.moveTo(x,y); started = true; }
      else ctx.lineTo(x,y);
    }
    ctx.stroke();

    canvas.dataset.scale = String(currentScale);
  }

  canvas._advancedGraph = {
    draw,
    zoomIn(){ currentScale = Math.max(0.1, currentScale / 1.35); draw(); },
    zoomOut(){ currentScale = currentScale * 1.35; draw(); },
    pan(dx,dy){ offsetX += dx; offsetY += dy; draw(); },
    nearest(clientX, clientY){
      const rect = canvas.getBoundingClientRect();
      const px = (clientX - rect.left) * (canvas.width / rect.width);
      const py = (clientY - rect.top) * (canvas.height / rect.height);
      const unit = (W * 0.42) / currentScale;
      const cx = W/2 + offsetX;
      const cy = H/2 + offsetY;
      let best = null, bestD = Infinity;
      for(const p of points){
        const x = cx + p.x * unit, y = cy - p.y * unit;
        const d = (x-px)**2 + (y-py)**2;
        if(d < bestD){ bestD = d; best = p; }
      }
      return best;
    }
  };

  draw();
  return canvas;
}

function renderAdvancedGraph({title, summary, steps, points, scale}){
  const canvas = buildAdvancedCanvas(points, scale, title);
  const id = "adv-graph-" + Math.random().toString(36).slice(2);
  canvas.id = id;

  resultBox.innerHTML = `
    <article class="result-card success-message">
      <h3>${title}</h3>
      <p>${summary}</p>
      <div class="graph-toolbar">
        <button type="button" data-graph-action="zoom-in">Zoom +</button>
        <button type="button" data-graph-action="zoom-out">Zoom -</button>
        <button type="button" data-graph-action="left">←</button>
        <button type="button" data-graph-action="right">→</button>
        <button type="button" data-graph-action="up">↑</button>
        <button type="button" data-graph-action="down">↓</button>
      </div>
      ${canvas.outerHTML}
      <div id="trace-output" class="trace-output">Toca la gràfica per veure una traça aproximada.</div>
      <h4>Procediment</h4>
      <ol class="steps">${htmlSteps(steps)}</ol>
    </article>
  `;

  const realCanvas = $(id);
  realCanvas._advancedGraph = canvas._advancedGraph;
  // Recreate drawing context state because outerHTML loses custom draw output.
  const replacement = buildAdvancedCanvas(points, scale, title);
  replacement.id = id;
  realCanvas.replaceWith(replacement);
  const activeCanvas = $(id);

  document.querySelectorAll("[data-graph-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const g = activeCanvas._advancedGraph;
      const action = btn.dataset.graphAction;
      if(action === "zoom-in") g.zoomIn();
      if(action === "zoom-out") g.zoomOut();
      if(action === "left") g.pan(30,0);
      if(action === "right") g.pan(-30,0);
      if(action === "up") g.pan(0,30);
      if(action === "down") g.pan(0,-30);
    });
  });

  activeCanvas.addEventListener("click", evt => {
    const p = activeCanvas._advancedGraph.nearest(evt.clientX, evt.clientY);
    if(p) $("trace-output").textContent = `Traça: t=${formatNumber(p.t)}, x=${formatNumber(p.x)}, y=${formatNumber(p.y)}`;
  });

  setStatus("Gràfica dibuixada", "ok");
}

if($("polar-form")) $("polar-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const expr = $("polar-expression").value;
    const tmin = getNumber("polar-tmin");
    const tmax = getNumber("polar-tmax");
    const scale = getNumber("polar-scale");
    const mode = $("polar-angle-mode").value;
    if(tmax <= tmin) throw new Error("t màx ha de ser més gran que t mín.");
    const points = [];
    const samples = 900;
    for(let i=0;i<=samples;i++){
      const t = tmin + (tmax-tmin)*i/samples;
      const r = evaluateExpressionWithT(expr, mode, t);
      const angle = mode === "deg" ? t * Math.PI/180 : t;
      points.push({t, x:r*Math.cos(angle), y:r*Math.sin(angle)});
    }
    renderAdvancedGraph({
      title: "Gràfica polar",
      summary: `r(t) = <strong>${expr}</strong>`,
      points,
      scale,
      steps: [
        "Una gràfica polar converteix cada valor de t en un radi r.",
        "Passem de coordenades polars a cartesianes amb <span class='math'>x=r cos(t)</span> i <span class='math'>y=r sin(t)</span>.",
        "Dibuixem molts punts consecutius i els unim per formar la corba.",
        "Pots fer zoom, desplaçar la vista i tocar la corba per veure una traça aproximada."
      ]
    });
  } catch(err) { renderError("No s'ha pogut dibuixar la gràfica polar.", err.message); }
});

if($("parametric-form")) $("parametric-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const exprX = $("param-x").value;
    const exprY = $("param-y").value;
    const tmin = getNumber("param-tmin");
    const tmax = getNumber("param-tmax");
    const scale = getNumber("param-scale");
    const mode = $("param-angle-mode").value;
    if(tmax <= tmin) throw new Error("t màx ha de ser més gran que t mín.");
    const points = [];
    const samples = 900;
    for(let i=0;i<=samples;i++){
      const t = tmin + (tmax-tmin)*i/samples;
      points.push({
        t,
        x: evaluateExpressionWithT(exprX, mode, t),
        y: evaluateExpressionWithT(exprY, mode, t)
      });
    }
    renderAdvancedGraph({
      title: "Gràfica paramètrica",
      summary: `x(t)=<strong>${exprX}</strong>, y(t)=<strong>${exprY}</strong>`,
      points,
      scale,
      steps: [
        "Una corba paramètrica no calcula y a partir de x directament.",
        "Cada valor de t genera un punt: <span class='math'>(x(t), y(t))</span>.",
        "Dibuixem els punts en ordre creixent de t.",
        "Pots fer zoom, desplaçar la vista i tocar la corba per veure una traça aproximada."
      ]
    });
  } catch(err) { renderError("No s'ha pogut dibuixar la gràfica paramètrica.", err.message); }
});

if($("theme-form")) $("theme-form").addEventListener("submit", event => {
  event.preventDefault();
  const theme = $("theme-mode").value;
  const font = $("font-scale").value;
  document.body.classList.remove("theme-dark", "theme-contrast", "font-large", "font-xlarge");
  if(theme === "dark") document.body.classList.add("theme-dark");
  if(theme === "contrast") document.body.classList.add("theme-contrast");
  if(font === "large") document.body.classList.add("font-large");
  if(font === "xlarge") document.body.classList.add("font-xlarge");
  render({
    title: "Preferències aplicades",
    summary: "S'ha actualitzat l'aparença de l'aplicació.",
    steps: [
      `Mode visual: <strong>${theme}</strong>.`,
      `Mida de lletra: <strong>${font}</strong>.`,
      "Aquesta configuració és local de la sessió actual."
    ]
  });
});





/* V10: CAS simbòlic parcial ampliat */
const CAS10_TEMPLATES = {
  "simplify-poly": `<label>Polinomi en x<input id="cas10-expr" value="2*x + 3*x - 4 + 7"></label>`,
  "factor-quadratic": `<div class="two-cols"><label>a<input type="number" id="cas10-a" value="1" step="any"></label><label>b<input type="number" id="cas10-b" value="-5" step="any"></label><label>c<input type="number" id="cas10-c" value="6" step="any"></label></div>`,
  "difference-squares": `<div class="two-cols"><label>a en a²x² - b²<input type="number" id="cas10-a" value="3" step="any"></label><label>b en a²x² - b²<input type="number" id="cas10-b" value="5" step="any"></label></div>`,
  "expand-binomial": `<div class="two-cols"><label>a en (ax+b)²<input type="number" id="cas10-a" value="2" step="any"></label><label>b en (ax+b)²<input type="number" id="cas10-b" value="3" step="any"></label></div>`,
  "simplify-rational": `<label>Numerador<input id="cas10-num" value="x^2 - 1"></label><label>Denominador<input id="cas10-den" value="x - 1"></label>`,
  "derivative-poly": `<label>Polinomi en x<input id="cas10-expr" value="3*x^3 - 2*x^2 + 5*x - 7"></label>`,
  "integral-poly": `<label>Polinomi en x<input id="cas10-expr" value="6*x^2 - 4*x + 5"></label>`,
  "chain-rule": `<label>Exterior<select id="cas10-outer"><option value="sin">sin(u)</option><option value="cos">cos(u)</option><option value="ln">ln(u)</option><option value="sqrt">sqrt(u)</option><option value="square">u²</option></select></label><label>u(x), polinomi<input id="cas10-expr" value="x^2+1"></label>`,
  "product-rule": `<label>f(x), polinomi<input id="cas10-f" value="x^2+1"></label><label>g(x), polinomi<input id="cas10-g" value="3*x-2"></label>`,
  "immediate-integral": `<label>Integral<select id="cas10-immediate"><option value="sin">∫sin(x)dx</option><option value="cos">∫cos(x)dx</option><option value="exp">∫e^x dx</option><option value="invx">∫1/x dx</option><option value="kexp">∫k·e^(kx) dx</option></select></label><label>k si cal<input type="number" id="cas10-k" value="2" step="any"></label>`
};

function updateCasInputs(){
  if($("cas-inputs")) $("cas-inputs").innerHTML = CAS10_TEMPLATES[$("cas-operation").value];
}
if($("cas-operation")) $("cas-operation").addEventListener("change", updateCasInputs);

function casClean(expr){
  return expr.replace(/\s+/g,"").replaceAll("−","-").replaceAll("**","^");
}

function casParsePoly(expr){
  expr = casClean(expr).replace(/-/g, "+-");
  if(expr.startsWith("+")) expr = expr.slice(1);
  const terms = expr.split("+").filter(Boolean);
  const coefs = {};
  for(const term of terms){
    let coef, pow;
    if(term.includes("x")){
      const parts = term.split("x");
      let left = parts[0];
      const right = parts[1] || "";
      if(left === "" || left === "+") coef = 1;
      else if(left === "-") coef = -1;
      else coef = Number(left.replace("*",""));
      if(!Number.isFinite(coef)) throw new Error(`Coeficient no vàlid: ${term}`);
      pow = right.startsWith("^") ? Number(right.slice(1)) : 1;
    } else {
      coef = Number(term);
      pow = 0;
    }
    if(!Number.isInteger(pow) || pow < 0) throw new Error("Només s'admeten potències enteres no negatives.");
    coefs[pow] = (coefs[pow] || 0) + coef;
  }
  return coefs;
}

function casPolyToString(coefs, constant=""){
  const powers = Object.keys(coefs).map(Number).filter(p => Math.abs(coefs[p]) > 1e-12).sort((a,b)=>b-a);
  if(!powers.length) return "0" + constant;
  let out = "";
  for(const p of powers){
    const coef = coefs[p];
    const sign = coef < 0 ? " - " : (out ? " + " : "");
    const abs = Math.abs(coef);
    let term;
    if(p === 0) term = formatNumber(abs);
    else term = (abs === 1 ? "" : formatNumber(abs) + "*") + "x" + (p === 1 ? "" : "^" + p);
    out += sign + term;
  }
  return out.trim() + constant;
}

function casDerivative(expr){
  const coefs = casParsePoly(expr);
  const out = {};
  for(const [pStr, coef] of Object.entries(coefs)){
    const p = Number(pStr);
    if(p > 0) out[p-1] = (out[p-1] || 0) + coef*p;
  }
  return out;
}

function casIntegral(expr){
  const coefs = casParsePoly(expr);
  const out = {};
  for(const [pStr, coef] of Object.entries(coefs)){
    const p = Number(pStr);
    out[p+1] = (out[p+1] || 0) + coef/(p+1);
  }
  return out;
}

function casQuadraticFactor(a,b,c){
  const D = b*b - 4*a*c;
  if(D < 0) return {ok:false, D};
  const s = Math.sqrt(D);
  const r1 = (-b + s)/(2*a);
  const r2 = (-b - s)/(2*a);
  const isInt = v => Math.abs(v - Math.round(v)) < 1e-10;
  let text;
  if(a === 1 && isInt(r1) && isInt(r2)){
    const A = Math.round(r1), B = Math.round(r2);
    text = `(x ${A < 0 ? "+" : "-"} ${Math.abs(A)})(x ${B < 0 ? "+" : "-"} ${Math.abs(B)})`;
  } else {
    text = `${formatNumber(a)}(x - ${formatNumber(r1)})(x - ${formatNumber(r2)})`;
  }
  return {ok:true, D, r1, r2, text};
}

function casDetectLinear(expr){
  const p = casParsePoly(expr);
  const degree = Math.max(...Object.keys(p).map(Number));
  if(degree !== 1) return null;
  const a = p[1] || 0, b = p[0] || 0;
  if(Math.abs(a) < 1e-12) return null;
  return {a,b,root:-b/a};
}

function casSimplifyRational(num, den){
  const lin = casDetectLinear(den);
  if(!lin) return null;
  const q = casParsePoly(num);
  const degree = Math.max(...Object.keys(q).map(Number));
  if(degree !== 2) return null;
  const a=q[2]||0,b=q[1]||0,c=q[0]||0;
  const fac = casQuadraticFactor(a,b,c);
  if(!fac.ok) return null;
  const root = lin.root;
  let other = null;
  if(Math.abs(fac.r1-root)<1e-8) other=fac.r2;
  if(Math.abs(fac.r2-root)<1e-8) other=fac.r1;
  if(other === null) return null;
  const leading = a / lin.a;
  const text = Math.abs(leading-1)<1e-10
    ? `x ${other < 0 ? "+" : "-"} ${formatNumber(Math.abs(other))}`
    : `${formatNumber(leading)}*(x ${other < 0 ? "+" : "-"} ${formatNumber(Math.abs(other))})`;
  return {text, restriction: root};
}

if($("cas-form")) $("cas-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const op = $("cas-operation").value;
    let title = "CAS simbòlic parcial ampliat";
    let summary = "";
    let extra = "";
    let steps = [];

    if(op === "simplify-poly"){
      const expr = $("cas10-expr").value;
      const result = casPolyToString(casParsePoly(expr));
      title = "Simplificar polinomi";
      summary = `<strong>${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Separem termes.", "Agrupem termes semblants amb la mateixa potència de x.", `Resultat: <span class="math">${result}</span>.`];
    }

    if(op === "factor-quadratic"){
      const a=getNumber("cas10-a"), b=getNumber("cas10-b"), c=getNumber("cas10-c");
      if(a===0) throw new Error("a no pot ser 0.");
      const fac = casQuadraticFactor(a,b,c);
      title = "Factoritzar quadràtica";
      if(!fac.ok){
        summary = `No factoritza en factors reals perquè Δ=${formatNumber(fac.D)}.`;
        steps = ["Calculem el discriminant.", "Com que és negatiu, no hi ha arrels reals."];
      } else {
        summary = `<strong>${fac.text}</strong>`;
        extra = `<div class="cas-result">${fac.text}</div>`;
        steps = [`Δ=${formatNumber(fac.D)}.`, `Arrels: ${formatNumber(fac.r1)} i ${formatNumber(fac.r2)}.`, "Escrivim a(x-r1)(x-r2)."];
      }
    }

    if(op === "difference-squares"){
      const a=getNumber("cas10-a"), b=getNumber("cas10-b");
      const result = `(${formatNumber(a)}x - ${formatNumber(b)})(${formatNumber(a)}x + ${formatNumber(b)})`;
      title = "Diferència de quadrats";
      summary = `<strong>${formatNumber(a*a)}x² - ${formatNumber(b*b)} = ${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Apliquem A²-B²=(A-B)(A+B).", `Aquí A=${formatNumber(a)}x i B=${formatNumber(b)}.`];
    }

    if(op === "expand-binomial"){
      const a=getNumber("cas10-a"), b=getNumber("cas10-b");
      const result = casPolyToString({2:a*a, 1:2*a*b, 0:b*b});
      title = "Desenvolupar binomi";
      summary = `<strong>(${formatNumber(a)}x + ${formatNumber(b)})² = ${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Apliquem (u+v)²=u²+2uv+v².", `Resultat: ${result}.`];
    }

    if(op === "simplify-rational"){
      const num=$("cas10-num").value, den=$("cas10-den").value;
      const sim = casSimplifyRational(num, den);
      title = "Simplificar fracció algebraica";
      if(sim){
        summary = `<strong>(${num})/(${den}) = ${sim.text}</strong>`;
        extra = `<div class="cas-result">${sim.text}</div><div class="cas-v10-note">Restricció: x ≠ ${formatNumber(sim.restriction)}, perquè el denominador original no pot ser 0.</div>`;
        steps = ["Factoritzem numerador i denominador.", "Detectem un factor comú lineal.", "Cancel·lem el factor, però mantenim la restricció."];
      } else {
        summary = "Aquest CAS parcial no ha trobat una cancel·lació simple.";
        extra = `<div class="cas-v10-note">Funciona per casos com (x²-1)/(x-1).</div>`;
        steps = ["Busquem denominador lineal.", "Busquem numerador quadràtic factoritzable.", "No s'ha trobat un patró compatible."];
      }
    }

    if(op === "derivative-poly"){
      const expr=$("cas10-expr").value;
      const result = casPolyToString(casDerivative(expr));
      title = "Derivar polinomi";
      summary = `<strong>${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Apliquem d(xⁿ)/dx = n·xⁿ⁻¹.", "Derivem terme a terme."];
    }

    if(op === "integral-poly"){
      const expr=$("cas10-expr").value;
      const result = casPolyToString(casIntegral(expr), " + C");
      title = "Integrar polinomi";
      summary = `<strong>${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Apliquem ∫xⁿdx = xⁿ⁺¹/(n+1).", "Integrem terme a terme i afegim C."];
    }

    if(op === "chain-rule"){
      const outer=$("cas10-outer").value, u=casClean($("cas10-expr").value);
      const du=casPolyToString(casDerivative(u));
      const map = {
        sin:[`cos(${u})*(${du})`, "d/dx sin(u)=cos(u)·u'"],
        cos:[`-sin(${u})*(${du})`, "d/dx cos(u)=-sin(u)·u'"],
        ln:[`(${du})/(${u})`, "d/dx ln(u)=u'/u"],
        sqrt:[`(${du})/(2*sqrt(${u}))`, "d/dx sqrt(u)=u'/(2sqrt(u))"],
        square:[`2*(${u})*(${du})`, "d/dx u²=2u·u'"]
      };
      const row = map[outer];
      title = "Regla de la cadena";
      summary = `<strong>${row[0]}</strong>`;
      extra = `<div class="cas-result">${row[0]}</div>`;
      steps = [`Interior: u=${u}.`, `u'=${du}.`, `Regla: ${row[1]}.`];
    }

    if(op === "product-rule"){
      const f=casClean($("cas10-f").value), g=casClean($("cas10-g").value);
      const df=casPolyToString(casDerivative(f)), dg=casPolyToString(casDerivative(g));
      const result = `(${df})*(${g}) + (${f})*(${dg})`;
      title = "Regla del producte";
      summary = `<strong>${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Apliquem (fg)'=f'g+fg'.", `f'=${df}.`, `g'=${dg}.`];
    }

    if(op === "immediate-integral"){
      const kind=$("cas10-immediate").value, k=getNumber("cas10-k");
      const map = {
        sin:"-cos(x) + C",
        cos:"sin(x) + C",
        exp:"e^x + C",
        invx:"ln|x| + C",
        kexp:`e^(${formatNumber(k)}x) + C`
      };
      const result = map[kind];
      title = "Integral immediata";
      summary = `<strong>${result}</strong>`;
      extra = `<div class="cas-result">${result}</div>`;
      steps = ["Fem servir una integral immediata coneguda.", "Afegim la constant d'integració C."];
    }

    extra += `<div class="cas-v10-note">CAS parcial: cobreix patrons educatius controlats, no totes les expressions possibles.</div>`;
    render({title, summary, steps, extra});
  } catch(err) {
    renderError("No s'ha pogut aplicar el CAS simbòlic parcial.", err.message);
  }
});

updateCasInputs();


/* V11: geometria analítica amb vectors i rectes */
const ANALYTIC_TEMPLATES = {
  "point-vector": `
    <div class="two-cols">
      <label>Punt P: x₀<input type="number" id="an-x0" value="1" step="any"></label>
      <label>Punt P: y₀<input type="number" id="an-y0" value="2" step="any"></label>
      <label>Vector director vx<input type="number" id="an-vx" value="3" step="any"></label>
      <label>Vector director vy<input type="number" id="an-vy" value="1" step="any"></label>
    </div>
  `,
  "two-points": `
    <div class="two-cols">
      <label>Punt A: x₁<input type="number" id="an-x1" value="1" step="any"></label>
      <label>Punt A: y₁<input type="number" id="an-y1" value="2" step="any"></label>
      <label>Punt B: x₂<input type="number" id="an-x2" value="4" step="any"></label>
      <label>Punt B: y₂<input type="number" id="an-y2" value="3" step="any"></label>
    </div>
  `,
  "general": `
    <div class="two-cols">
      <label>A<input type="number" id="an-A" value="2" step="any"></label>
      <label>B<input type="number" id="an-B" value="-3" step="any"></label>
      <label>C<input type="number" id="an-C" value="6" step="any"></label>
    </div>
  `,
  "explicit": `
    <div class="two-cols">
      <label>Pendent m<input type="number" id="an-m" value="2" step="any"></label>
      <label>Ordenada n<input type="number" id="an-n" value="-1" step="any"></label>
    </div>
  `,
  "vector-ops": `
    <div class="two-cols">
      <label>Vector u = ux,uy<input id="an-u" value="3,1"></label>
      <label>Vector v = vx,vy<input id="an-v" value="-1,2"></label>
    </div>
  `
};

function updateAnalyticInputs(){
  if($("analytic-inputs")) $("analytic-inputs").innerHTML = ANALYTIC_TEMPLATES[$("analytic-type").value];
}
if($("analytic-type")) $("analytic-type").addEventListener("change", updateAnalyticInputs);

function anFmt(x){
  if(Math.abs(x) < 1e-10) return "0";
  return formatNumber(x);
}
function signTerm(value, variable=""){
  if(value < 0) return ` - ${anFmt(Math.abs(value))}${variable}`;
  return ` + ${anFmt(value)}${variable}`;
}
function parseVector2(value){
  const parts = value.split(",").map(v => Number(v.trim()));
  if(parts.length !== 2 || parts.some(v => !Number.isFinite(v))) throw new Error("El vector ha de tenir format x,y.");
  return {x: parts[0], y: parts[1]};
}
function gcdInt(a,b){
  a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
  while(b){ const t = b; b = a % b; a = t; }
  return a || 1;
}
function simplifyGeneral(A,B,C){
  const vals = [A,B,C];
  if(vals.every(v => Number.isInteger(v))){
    const g = vals.reduce((acc,v)=>gcdInt(acc,v), 0);
    if(g > 1){ A/=g; B/=g; C/=g; }
  }
  if(A < 0 || (A === 0 && B < 0)){ A=-A; B=-B; C=-C; }
  return {A,B,C};
}
function lineFromPointVector(x0,y0,vx,vy){
  if(Math.abs(vx) < 1e-12 && Math.abs(vy) < 1e-12) throw new Error("El vector director no pot ser el vector nul.");
  // Director (vx,vy). Normal can be (vy, -vx)
  let A = vy, B = -vx, C = -(A*x0 + B*y0);
  const simp = simplifyGeneral(A,B,C);
  A=simp.A; B=simp.B; C=simp.C;
  const m = Math.abs(vx) < 1e-12 ? null : vy/vx;
  const n = m === null ? null : y0 - m*x0;
  return {x0,y0,vx,vy,A,B,C,m,n};
}
function lineFromGeneral(A,B,C){
  if(Math.abs(A) < 1e-12 && Math.abs(B) < 1e-12) throw new Error("A i B no poden ser tots dos 0.");
  // director is (-B, A)
  const vx = -B, vy = A;
  let x0, y0;
  if(Math.abs(B) > 1e-12){ x0 = 0; y0 = -C/B; }
  else { y0 = 0; x0 = -C/A; }
  const m = Math.abs(B) < 1e-12 ? null : -A/B;
  const n = m === null ? null : -C/B;
  return {x0,y0,vx,vy,A,B,C,m,n};
}
function equationsHTML(line){
  const {x0,y0,vx,vy,A,B,C,m,n} = line;
  const vectorial = `(x,y) = (${anFmt(x0)}, ${anFmt(y0)}) + t·(${anFmt(vx)}, ${anFmt(vy)})`;
  const param = `x = ${anFmt(x0)} ${signTerm(vx, "t")}<br>y = ${anFmt(y0)} ${signTerm(vy, "t")}`;
  let continuous;
  if(Math.abs(vx) < 1e-12) continuous = `x = ${anFmt(x0)} <span class="math">(recta vertical)</span>`;
  else if(Math.abs(vy) < 1e-12) continuous = `y = ${anFmt(y0)} <span class="math">(recta horitzontal)</span>`;
  else continuous = `(x - ${anFmt(x0)}) / ${anFmt(vx)} = (y - ${anFmt(y0)}) / ${anFmt(vy)}`;
  const explicit = m === null ? `No existeix forma explícita y=mx+n perquè és vertical: x = ${anFmt(x0)}` : `y = ${anFmt(m)}x ${n < 0 ? "- " + anFmt(Math.abs(n)) : "+ " + anFmt(n)}`;
  const general = `${anFmt(A)}x ${B < 0 ? "- " + anFmt(Math.abs(B)) : "+ " + anFmt(B)}y ${C < 0 ? "- " + anFmt(Math.abs(C)) : "+ " + anFmt(C)} = 0`;
  return `
    <div class="line-equations">
      <div class="line-equation-card"><strong>Forma vectorial</strong><br><span class="math">${vectorial}</span></div>
      <div class="line-equation-card"><strong>Forma paramètrica</strong><br><span class="math">${param}</span></div>
      <div class="line-equation-card"><strong>Forma contínua</strong><br><span class="math">${continuous}</span></div>
      <div class="line-equation-card"><strong>Forma explícita</strong><br><span class="math">${explicit}</span></div>
      <div class="line-equation-card"><strong>Forma general</strong><br><span class="math">${general}</span></div>
      <div class="line-equation-card"><strong>Vector director</strong><br><span class="vector-badge">v = (${anFmt(vx)}, ${anFmt(vy)})</span></div>
    </div>
  `;
}
function drawAnalyticCanvasById(canvasId, line, points=[]){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const cssSize = Math.max(320, Math.round(rect.width || 720));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  canvas.style.height = cssSize + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssSize;
  const H = cssSize;
  const pad = Math.max(34, Math.round(W * 0.07));

  const Q = {x: line.x0 + line.vx, y: line.y0 + line.vy, label: "Q = P + v"};
  const allPoints = [...points, Q];

  const xs = [line.x0, Q.x, ...points.map(p => p.x), -10, 10];
  const ys = [line.y0, Q.y, ...points.map(p => p.y), -10, 10];
  const maxAbs = Math.max(10, ...xs.map(Math.abs), ...ys.map(Math.abs)) + 2;
  const min = -maxAbs;
  const max = maxAbs;

  const X = x => pad + (x - min) / (max - min) * (W - 2 * pad);
  const Y = y => H - pad - (y - min) / (max - min) * (H - 2 * pad);

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for(let i = Math.ceil(min); i <= Math.floor(max); i++){
    ctx.beginPath(); ctx.moveTo(X(i), pad); ctx.lineTo(X(i), H - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, Y(i)); ctx.lineTo(W - pad, Y(i)); ctx.stroke();
  }

  // Axes
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(0), pad); ctx.lineTo(X(0), H - pad); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pad, Y(0)); ctx.lineTo(W - pad, Y(0)); ctx.stroke();

  ctx.fillStyle = "#374151";
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillText("x", W - pad + 8, Y(0) + 5);
  ctx.fillText("y", X(0) + 6, pad - 10);

  // Infinite line
  ctx.strokeStyle = "#1d4ed8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if(Math.abs(line.vx) < 1e-12){
    ctx.moveTo(X(line.x0), pad);
    ctx.lineTo(X(line.x0), H - pad);
  } else {
    const xA = min;
    const xB = max;
    const yA = line.m === null ? line.y0 : line.m * xA + line.n;
    const yB = line.m === null ? line.y0 : line.m * xB + line.n;
    ctx.moveTo(X(xA), Y(yA));
    ctx.lineTo(X(xB), Y(yB));
  }
  ctx.stroke();

  // Direction vector from P to Q
  const ax = line.x0, ay = line.y0, bx = Q.x, by = Q.y;
  ctx.strokeStyle = "#b91c1c";
  ctx.fillStyle = "#b91c1c";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(X(ax), Y(ay));
  ctx.lineTo(X(bx), Y(by));
  ctx.stroke();

  // Arrow head
  const dx = X(bx) - X(ax);
  const dy = Y(by) - Y(ay);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const ah = 14;
  ctx.beginPath();
  ctx.moveTo(X(bx), Y(by));
  ctx.lineTo(X(bx) - ux * ah - uy * ah * 0.6, Y(by) - uy * ah + ux * ah * 0.6);
  ctx.lineTo(X(bx) - ux * ah + uy * ah * 0.6, Y(by) - uy * ah - ux * ah * 0.6);
  ctx.closePath();
  ctx.fill();

  // Points
  allPoints.forEach((p, idx) => {
    const isQ = p.label && p.label.startsWith("Q");
    ctx.fillStyle = isQ ? "#b91c1c" : "#047857";
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillText(p.label || `P${idx + 1}`, X(p.x) + 9, Y(p.y) - 9);
  });

  // Vector label
  const mx = (X(ax) + X(bx)) / 2;
  const my = (Y(ay) + Y(by)) / 2;
  ctx.fillStyle = "#991b1b";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.fillText(`v = (${anFmt(line.vx)}, ${anFmt(line.vy)})`, mx + 8, my - 8);
}

function renderAnalyticLine(line, points, originText){
  const graphId = `analytic-graph-${Math.random().toString(36).slice(2)}`;
  const extra = equationsHTML(line) + `
    <div class="analytic-canvas-wrap">
      <canvas id="${graphId}" aria-label="Gràfica de la recta amb punt i vector director"></canvas>
    </div>
  `;

  render({
    title: "Recta en el pla",
    summary: `${originText}<br>Vector director: <strong>(${anFmt(line.vx)}, ${anFmt(line.vy)})</strong>.`,
    extra,
    steps: [
      "Identifiquem un punt de la recta i un vector director.",
      "Amb el punt i el vector escrivim la forma vectorial.",
      "Separant coordenades obtenim la forma paramètrica.",
      "Si cap component del vector és 0, podem escriure la forma contínua.",
      "A partir del vector director obtenim un vector normal i la forma general.",
      "Si la recta no és vertical, aïllem y per obtenir la forma explícita.",
      "Al dibuix es mostra el punt P, el punt Q=P+v, el vector director i la recta completa."
    ]
  });

  requestAnimationFrame(() => {
    drawAnalyticCanvasById(graphId, line, points);
  });

  window.addEventListener("resize", () => {
    const canvas = document.getElementById(graphId);
    if(canvas) drawAnalyticCanvasById(graphId, line, points);
  }, { once: true });
}

if($("analytic-form")) $("analytic-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const type = $("analytic-type").value;

    if(type === "point-vector"){
      const x0=getNumber("an-x0"), y0=getNumber("an-y0"), vx=getNumber("an-vx"), vy=getNumber("an-vy");
      const line = lineFromPointVector(x0,y0,vx,vy);
      return renderAnalyticLine(line, [{x:x0,y:y0,label:"P"}], `Punt donat: <strong>P(${anFmt(x0)}, ${anFmt(y0)})</strong>.`);
    }

    if(type === "two-points"){
      const x1=getNumber("an-x1"), y1=getNumber("an-y1"), x2=getNumber("an-x2"), y2=getNumber("an-y2");
      const vx=x2-x1, vy=y2-y1;
      const line = lineFromPointVector(x1,y1,vx,vy);
      return renderAnalyticLine(line, [{x:x1,y:y1,label:"A"},{x:x2,y:y2,label:"B"}], `Punts donats: <strong>A(${anFmt(x1)}, ${anFmt(y1)})</strong> i <strong>B(${anFmt(x2)}, ${anFmt(y2)})</strong>.`);
    }

    if(type === "general"){
      const A=getNumber("an-A"), B=getNumber("an-B"), C=getNumber("an-C");
      const line = lineFromGeneral(A,B,C);
      return renderAnalyticLine(line, [{x:line.x0,y:line.y0,label:"P"}], `Equació general donada: <strong>${anFmt(A)}x ${B < 0 ? "- " + anFmt(Math.abs(B)) : "+ " + anFmt(B)}y ${C < 0 ? "- " + anFmt(Math.abs(C)) : "+ " + anFmt(C)} = 0</strong>.`);
    }

    if(type === "explicit"){
      const m=getNumber("an-m"), n=getNumber("an-n");
      const line = lineFromPointVector(0,n,1,m);
      return renderAnalyticLine(line, [{x:0,y:n,label:"Tall Y"}], `Equació explícita donada: <strong>y = ${anFmt(m)}x ${n < 0 ? "- " + anFmt(Math.abs(n)) : "+ " + anFmt(n)}</strong>.`);
    }

    if(type === "vector-ops"){
      const u = parseVector2($("an-u").value);
      const v = parseVector2($("an-v").value);
      const sum = {x:u.x+v.x, y:u.y+v.y};
      const diff = {x:u.x-v.x, y:u.y-v.y};
      const dot = u.x*v.x + u.y*v.y;
      const det = u.x*v.y - u.y*v.x;
      const modU = Math.hypot(u.x,u.y);
      const modV = Math.hypot(v.x,v.y);
      const angle = modU*modV === 0 ? null : Math.acos(Math.max(-1, Math.min(1, dot/(modU*modV))))*180/Math.PI;
      return render({
        title: "Operacions amb vectors directors",
        summary: `u = <strong>(${anFmt(u.x)}, ${anFmt(u.y)})</strong>, v = <strong>(${anFmt(v.x)}, ${anFmt(v.y)})</strong>.`,
        extra: `
          <div class="line-equations">
            <div class="line-equation-card"><strong>Suma</strong><br><span class="math">u+v = (${anFmt(sum.x)}, ${anFmt(sum.y)})</span></div>
            <div class="line-equation-card"><strong>Resta</strong><br><span class="math">u-v = (${anFmt(diff.x)}, ${anFmt(diff.y)})</span></div>
            <div class="line-equation-card"><strong>Producte escalar</strong><br><span class="math">u·v = ${anFmt(dot)}</span></div>
            <div class="line-equation-card"><strong>Determinant 2D</strong><br><span class="math">det(u,v) = ${anFmt(det)}</span></div>
            <div class="line-equation-card"><strong>Mòduls</strong><br><span class="math">|u|=${anFmt(modU)}, |v|=${anFmt(modV)}</span></div>
            <div class="line-equation-card"><strong>Angle</strong><br><span class="math">${angle === null ? "No definit si algun vector és nul" : anFmt(angle) + "°"}</span></div>
          </div>
        `,
        steps: [
          "La suma i la resta es fan component a component.",
          "El producte escalar permet estudiar angles i perpendicularitat.",
          "El determinant 2D indica si dos vectors són paral·lels: si det=0, són dependents.",
          "L'angle s'obté amb cosθ = (u·v)/(|u||v|)."
        ]
      });
    }
  } catch(err) {
    renderError("No s'ha pogut calcular la recta o els vectors.", err.message);
  }
});
updateAnalyticInputs();


/* V13: geometria analítica avançada */
const ANALYTIC_TOOL_TEMPLATES = {
  "intersection-2d": `
    <div class="formula-card">Recta 1: A₁x + B₁y + C₁ = 0 · Recta 2: A₂x + B₂y + C₂ = 0</div>
    <div class="two-cols">
      <label>A₁<input type="number" id="at-A1" value="2" step="any"></label>
      <label>B₁<input type="number" id="at-B1" value="-3" step="any"></label>
      <label>C₁<input type="number" id="at-C1" value="-7" step="any"></label>
      <label>A₂<input type="number" id="at-A2" value="1" step="any"></label>
      <label>B₂<input type="number" id="at-B2" value="1" step="any"></label>
      <label>C₂<input type="number" id="at-C2" value="-5" step="any"></label>
    </div>
  `,
  "distance-point-line": `
    <div class="formula-card">Distància de P(x₀,y₀) a la recta Ax + By + C = 0</div>
    <div class="two-cols">
      <label>Punt x₀<input type="number" id="at-x0" value="1" step="any"></label>
      <label>Punt y₀<input type="number" id="at-y0" value="2" step="any"></label>
      <label>A<input type="number" id="at-A1" value="2" step="any"></label>
      <label>B<input type="number" id="at-B1" value="-3" step="any"></label>
      <label>C<input type="number" id="at-C1" value="-7" step="any"></label>
    </div>
  `,
  "angle-lines": `
    <div class="formula-card">Angle entre dues rectes a partir dels seus vectors directors.</div>
    <div class="two-cols">
      <label>Vector director u = ux,uy<input id="at-u" value="3,2"></label>
      <label>Vector director v = vx,vy<input id="at-v" value="1,-1"></label>
    </div>
  `,
  "line-relation": `
    <div class="formula-card">Rectes en forma general: A₁x+B₁y+C₁=0 i A₂x+B₂y+C₂=0</div>
    <div class="two-cols">
      <label>A₁<input type="number" id="at-A1" value="2" step="any"></label>
      <label>B₁<input type="number" id="at-B1" value="-3" step="any"></label>
      <label>C₁<input type="number" id="at-C1" value="-7" step="any"></label>
      <label>A₂<input type="number" id="at-A2" value="4" step="any"></label>
      <label>B₂<input type="number" id="at-B2" value="-6" step="any"></label>
      <label>C₂<input type="number" id="at-C2" value="2" step="any"></label>
    </div>
  `,
  "line3d": `
    <div class="formula-card">Recta 3D: (x,y,z) = P + t·v</div>
    <div class="two-cols">
      <label>Punt P: x₀<input type="number" id="at-x0" value="1" step="any"></label>
      <label>Punt P: y₀<input type="number" id="at-y0" value="2" step="any"></label>
      <label>Punt P: z₀<input type="number" id="at-z0" value="3" step="any"></label>
      <label>Vector vx<input type="number" id="at-vx" value="2" step="any"></label>
      <label>Vector vy<input type="number" id="at-vy" value="-1" step="any"></label>
      <label>Vector vz<input type="number" id="at-vz" value="4" step="any"></label>
    </div>
  `,
  "plane3d": `
    <div class="formula-card">Pla 3D a partir de punt P i normal n: A(x-x₀)+B(y-y₀)+C(z-z₀)=0</div>
    <div class="two-cols">
      <label>Punt P: x₀<input type="number" id="at-x0" value="1" step="any"></label>
      <label>Punt P: y₀<input type="number" id="at-y0" value="2" step="any"></label>
      <label>Punt P: z₀<input type="number" id="at-z0" value="3" step="any"></label>
      <label>Normal A<input type="number" id="at-A1" value="2" step="any"></label>
      <label>Normal B<input type="number" id="at-B1" value="-1" step="any"></label>
      <label>Normal C<input type="number" id="at-C1" value="4" step="any"></label>
    </div>
  `,
  "point-plane-distance": `
    <div class="formula-card">Distància de P(x₀,y₀,z₀) al pla Ax + By + Cz + D = 0</div>
    <div class="two-cols">
      <label>Punt x₀<input type="number" id="at-x0" value="1" step="any"></label>
      <label>Punt y₀<input type="number" id="at-y0" value="2" step="any"></label>
      <label>Punt z₀<input type="number" id="at-z0" value="3" step="any"></label>
      <label>A<input type="number" id="at-A1" value="2" step="any"></label>
      <label>B<input type="number" id="at-B1" value="-1" step="any"></label>
      <label>C<input type="number" id="at-C1" value="4" step="any"></label>
      <label>D<input type="number" id="at-D1" value="-5" step="any"></label>
    </div>
  `,
  "line-plane-intersection": `
    <div class="formula-card">Recta: P+t·v · Pla: Ax+By+Cz+D=0</div>
    <div class="two-cols">
      <label>Recta P: x₀<input type="number" id="at-x0" value="1" step="any"></label>
      <label>Recta P: y₀<input type="number" id="at-y0" value="2" step="any"></label>
      <label>Recta P: z₀<input type="number" id="at-z0" value="3" step="any"></label>
      <label>Vector vx<input type="number" id="at-vx" value="2" step="any"></label>
      <label>Vector vy<input type="number" id="at-vy" value="-1" step="any"></label>
      <label>Vector vz<input type="number" id="at-vz" value="4" step="any"></label>
      <label>Pla A<input type="number" id="at-A1" value="2" step="any"></label>
      <label>Pla B<input type="number" id="at-B1" value="-1" step="any"></label>
      <label>Pla C<input type="number" id="at-C1" value="4" step="any"></label>
      <label>Pla D<input type="number" id="at-D1" value="-5" step="any"></label>
    </div>
  `
};

function updateAnalyticToolsInputs(){
  if($("analytic-tools-inputs")) $("analytic-tools-inputs").innerHTML = ANALYTIC_TOOL_TEMPLATES[$("analytic-tool-type").value];
}
if($("analytic-tool-type")) $("analytic-tool-type").addEventListener("change", updateAnalyticToolsInputs);

function atNumber(id){ return getNumber(id); }
function atVec2(id){ return parseVector2($(id).value); }
function atVec3(x,y,z){ return {x,y,z}; }
function atDot2(u,v){ return u.x*v.x + u.y*v.y; }
function atDot3(u,v){ return u.x*v.x + u.y*v.y + u.z*v.z; }
function atNorm2(u){ return Math.hypot(u.x,u.y); }
function atNorm3(u){ return Math.hypot(u.x,u.y,u.z); }
function atCross2(u,v){ return u.x*v.y - u.y*v.x; }
function atLineText(A,B,C){
  return `${anFmt(A)}x ${B < 0 ? "- " + anFmt(Math.abs(B)) : "+ " + anFmt(B)}y ${C < 0 ? "- " + anFmt(Math.abs(C)) : "+ " + anFmt(C)} = 0`;
}
function atPlaneText(A,B,C,D){
  return `${anFmt(A)}x ${B < 0 ? "- " + anFmt(Math.abs(B)) : "+ " + anFmt(B)}y ${C < 0 ? "- " + anFmt(Math.abs(C)) : "+ " + anFmt(C)}z ${D < 0 ? "- " + anFmt(Math.abs(D)) : "+ " + anFmt(D)} = 0`;
}
function analyticCards(items){
  return `<div class="analytic-summary-grid">${items.map(item => `<div class="analytic-summary-card"><strong>${item[0]}</strong><br><span class="math">${item[1]}</span></div>`).join("")}</div>`;
}
function drawTwoLines(A1,B1,C1,A2,B2,C2,point=null){
  const l1 = lineFromGeneral(A1,B1,C1);
  const l2 = lineFromGeneral(A2,B2,C2);
  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 720; canvas.className = "function-canvas";
  const ctx = canvas.getContext("2d");
  const W=720,H=720,pad=46,min=-12,max=12;
  const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
  const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;
  for(let i=min;i<=max;i++){
    ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();
  }
  ctx.strokeStyle="#374151";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();
  ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();
  function drawLine(line,color){
    ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();
    if(Math.abs(line.vx)<1e-12){ctx.moveTo(X(line.x0),pad);ctx.lineTo(X(line.x0),H-pad);}
    else{ctx.moveTo(X(min),Y(line.m*min+line.n));ctx.lineTo(X(max),Y(line.m*max+line.n));}
    ctx.stroke();
  }
  drawLine(l1,"#1d4ed8"); drawLine(l2,"#b91c1c");
  if(point){
    ctx.fillStyle="#047857";ctx.beginPath();ctx.arc(X(point.x),Y(point.y),8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#111827";ctx.font="16px system-ui, sans-serif";ctx.fillText("Intersecció",X(point.x)+10,Y(point.y)-10);
  }
  return canvas.outerHTML;
}

if($("analytic-tools-form")) $("analytic-tools-form").addEventListener("submit", event => {
  event.preventDefault();
  try {
    const type = $("analytic-tool-type").value;

    if(type === "intersection-2d"){
      const A1=atNumber("at-A1"), B1=atNumber("at-B1"), C1=atNumber("at-C1");
      const A2=atNumber("at-A2"), B2=atNumber("at-B2"), C2=atNumber("at-C2");
      const D = A1*B2 - A2*B1;
      if(Math.abs(D) < 1e-12){
        const prop = Math.abs(A1*C2-A2*C1)<1e-12 && Math.abs(B1*C2-B2*C1)<1e-12;
        return render({
          title: "Intersecció de rectes",
          summary: prop ? "Les rectes són coincidents: tenen infinits punts en comú." : "Les rectes són paral·leles: no tenen intersecció.",
          extra: analyticCards([["Recta 1", atLineText(A1,B1,C1)], ["Recta 2", atLineText(A2,B2,C2)], ["Determinant", anFmt(D)]]),
          steps: [
            "Calculem el determinant del sistema format per les dues rectes.",
            "Si D=0, les rectes no tenen una intersecció única.",
            prop ? "Com que també són proporcionals els termes independents, són coincidents." : "Com que no són totalment proporcionals, són paral·leles."
          ],
          type: "warning"
        });
      }
      const x = (B1*C2 - B2*C1)/D;
      const y = (C1*A2 - C2*A1)/D;
      return render({
        title: "Intersecció de rectes",
        summary: `Punt d’intersecció: <strong>(${anFmt(x)}, ${anFmt(y)})</strong>.`,
        extra: analyticCards([["Recta 1", atLineText(A1,B1,C1)], ["Recta 2", atLineText(A2,B2,C2)], ["Determinant", anFmt(D)]]) + `<div>${drawTwoLines(A1,B1,C1,A2,B2,C2,{x,y})}</div>`,
        steps: [
          "Escrivim les dues rectes com un sistema lineal.",
          `Calculem el determinant: <span class="math">D = A₁B₂ - A₂B₁ = ${anFmt(D)}</span>.`,
          "Com que D≠0, hi ha una única solució.",
          `Resolem el sistema i obtenim <span class="math">(${anFmt(x)}, ${anFmt(y)})</span>.`
        ]
      });
    }

    if(type === "distance-point-line"){
      const x0=atNumber("at-x0"), y0=atNumber("at-y0"), A=atNumber("at-A1"), B=atNumber("at-B1"), C=atNumber("at-C1");
      const denom = Math.hypot(A,B);
      if(denom === 0) throw new Error("A i B no poden ser tots dos 0.");
      const numerator = Math.abs(A*x0+B*y0+C);
      const d = numerator/denom;
      return render({
        title: "Distància punt-recta",
        summary: `Distància: <strong>${anFmt(d)}</strong>.`,
        extra: analyticCards([["Punt", `P(${anFmt(x0)}, ${anFmt(y0)})`], ["Recta", atLineText(A,B,C)], ["Fórmula", "d = |Ax₀+By₀+C| / √(A²+B²)"]]),
        steps: [
          "Substituïm les coordenades del punt a l'expressió de la recta.",
          `Numerador: <span class="math">|${anFmt(A)}·${anFmt(x0)} + ${anFmt(B)}·${anFmt(y0)} + ${anFmt(C)}| = ${anFmt(numerator)}</span>.`,
          `Denominador: <span class="math">√(A²+B²) = ${anFmt(denom)}</span>.`,
          `Distància: <span class="math">${anFmt(d)}</span>.`
        ]
      });
    }

    if(type === "angle-lines"){
      const u=atVec2("at-u"), v=atVec2("at-v");
      const nu=atNorm2(u), nv=atNorm2(v);
      if(nu === 0 || nv === 0) throw new Error("Cap vector pot ser nul.");
      const dot=atDot2(u,v);
      const cos = Math.max(-1, Math.min(1, Math.abs(dot)/(nu*nv)));
      const angle = Math.acos(cos)*180/Math.PI;
      return render({
        title: "Angle entre rectes",
        summary: `Angle menor: <strong>${anFmt(angle)}°</strong>.`,
        extra: analyticCards([["u", `(${anFmt(u.x)}, ${anFmt(u.y)})`], ["v", `(${anFmt(v.x)}, ${anFmt(v.y)})`], ["Producte escalar", anFmt(dot)], ["Fórmula", "cosθ = |u·v|/(|u||v|)"]]),
        steps: [
          "Fem servir els vectors directors de les rectes.",
          "Calculem el producte escalar i els mòduls.",
          "Fem servir el valor absolut perquè volem l'angle menor entre rectes.",
          `Resultat: <span class="math">${anFmt(angle)}°</span>.`
        ]
      });
    }

    if(type === "line-relation"){
      const A1=atNumber("at-A1"), B1=atNumber("at-B1"), C1=atNumber("at-C1");
      const A2=atNumber("at-A2"), B2=atNumber("at-B2"), C2=atNumber("at-C2");
      const d1 = {x:-B1,y:A1};
      const d2 = {x:-B2,y:A2};
      const det = atCross2(d1,d2);
      const dot = atDot2(d1,d2);
      let relation;
      if(Math.abs(det) < 1e-12){
        const coincident = Math.abs(A1*C2-A2*C1)<1e-12 && Math.abs(B1*C2-B2*C1)<1e-12;
        relation = coincident ? "coincidents" : "paral·leles";
      } else if(Math.abs(dot) < 1e-12) relation = "perpendiculars";
      else relation = "secants no perpendiculars";
      return render({
        title: "Relació entre rectes",
        summary: `Les rectes són <strong>${relation}</strong>.`,
        extra: analyticCards([["Vector director r₁", `(${anFmt(d1.x)}, ${anFmt(d1.y)})`], ["Vector director r₂", `(${anFmt(d2.x)}, ${anFmt(d2.y)})`], ["Determinant", anFmt(det)], ["Producte escalar", anFmt(dot)]]),
        steps: [
          "Obtenim un vector director de cada recta a partir de la forma general.",
          "Si el determinant dels vectors directors és 0, són paral·leles o coincidents.",
          "Si el producte escalar és 0, són perpendiculars.",
          `Conclusió: <span class="math">${relation}</span>.`
        ]
      });
    }

    if(type === "line3d"){
      const x0=atNumber("at-x0"), y0=atNumber("at-y0"), z0=atNumber("at-z0");
      const vx=atNumber("at-vx"), vy=atNumber("at-vy"), vz=atNumber("at-vz");
      if(Math.hypot(vx,vy,vz) === 0) throw new Error("El vector director no pot ser nul.");
      const vectorial = `(x,y,z)=(${anFmt(x0)},${anFmt(y0)},${anFmt(z0)}) + t·(${anFmt(vx)},${anFmt(vy)},${anFmt(vz)})`;
      const param = `x=${anFmt(x0)} ${signTerm(vx,"t")}, y=${anFmt(y0)} ${signTerm(vy,"t")}, z=${anFmt(z0)} ${signTerm(vz,"t")}`;
      const continuous = `${Math.abs(vx)<1e-12 ? "x="+anFmt(x0) : "(x-"+anFmt(x0)+")/"+anFmt(vx)} = ${Math.abs(vy)<1e-12 ? "y="+anFmt(y0) : "(y-"+anFmt(y0)+")/"+anFmt(vy)} = ${Math.abs(vz)<1e-12 ? "z="+anFmt(z0) : "(z-"+anFmt(z0)+")/"+anFmt(vz)}`;
      return render({
        title: "Recta 3D",
        summary: `Vector director: <strong>(${anFmt(vx)}, ${anFmt(vy)}, ${anFmt(vz)})</strong>.`,
        extra: analyticCards([["Forma vectorial", vectorial], ["Forma paramètrica", param], ["Forma contínua", continuous], ["Punt Q=P+v", `(${anFmt(x0+vx)}, ${anFmt(y0+vy)}, ${anFmt(z0+vz)})`]]),
        steps: [
          "Una recta en 3D queda determinada per un punt i un vector director.",
          "La forma vectorial suma al punt inicial múltiples del vector director.",
          "La forma paramètrica separa les tres coordenades.",
          "La forma contínua només és directa per a les components del vector que no són 0."
        ]
      });
    }

    if(type === "plane3d"){
      const x0=atNumber("at-x0"), y0=atNumber("at-y0"), z0=atNumber("at-z0");
      const A=atNumber("at-A1"), B=atNumber("at-B1"), C=atNumber("at-C1");
      if(Math.hypot(A,B,C) === 0) throw new Error("El vector normal no pot ser nul.");
      const D = -(A*x0+B*y0+C*z0);
      return render({
        title: "Pla 3D",
        summary: `Equació del pla: <strong>${atPlaneText(A,B,C,D)}</strong>.`,
        extra: analyticCards([["Punt", `P(${anFmt(x0)}, ${anFmt(y0)}, ${anFmt(z0)})`], ["Vector normal", `n=(${anFmt(A)}, ${anFmt(B)}, ${anFmt(C)})`], ["Equació", atPlaneText(A,B,C,D)]]),
        steps: [
          "Un pla queda determinat per un punt i un vector normal.",
          "Fem servir A(x-x₀)+B(y-y₀)+C(z-z₀)=0.",
          "Desenvolupem l'expressió per obtenir Ax+By+Cz+D=0."
        ]
      });
    }

    if(type === "point-plane-distance"){
      const x0=atNumber("at-x0"), y0=atNumber("at-y0"), z0=atNumber("at-z0");
      const A=atNumber("at-A1"), B=atNumber("at-B1"), C=atNumber("at-C1"), D=atNumber("at-D1");
      const denom = Math.hypot(A,B,C);
      if(denom === 0) throw new Error("A, B i C no poden ser tots 0.");
      const numerator = Math.abs(A*x0+B*y0+C*z0+D);
      const dist = numerator/denom;
      return render({
        title: "Distància punt-pla",
        summary: `Distància: <strong>${anFmt(dist)}</strong>.`,
        extra: analyticCards([["Punt", `P(${anFmt(x0)}, ${anFmt(y0)}, ${anFmt(z0)})`], ["Pla", atPlaneText(A,B,C,D)], ["Fórmula", "d=|Ax₀+By₀+Cz₀+D|/√(A²+B²+C²)"]]),
        steps: [
          "Substituïm el punt a l'equació del pla.",
          `Numerador: <span class="math">${anFmt(numerator)}</span>.`,
          `Denominador: <span class="math">${anFmt(denom)}</span>.`,
          `Distància: <span class="math">${anFmt(dist)}</span>.`
        ]
      });
    }

    if(type === "line-plane-intersection"){
      const x0=atNumber("at-x0"), y0=atNumber("at-y0"), z0=atNumber("at-z0");
      const vx=atNumber("at-vx"), vy=atNumber("at-vy"), vz=atNumber("at-vz");
      const A=atNumber("at-A1"), B=atNumber("at-B1"), C=atNumber("at-C1"), D=atNumber("at-D1");
      const denom = A*vx+B*vy+C*vz;
      const num = -(A*x0+B*y0+C*z0+D);
      if(Math.abs(denom) < 1e-12){
        const contained = Math.abs(num) < 1e-12;
        return render({
          title: "Intersecció recta-pla",
          summary: contained ? "La recta està continguda en el pla." : "La recta és paral·lela al pla i no el talla.",
          extra: analyticCards([["Denominador", anFmt(denom)], ["Numerador", anFmt(num)], ["Pla", atPlaneText(A,B,C,D)]]),
          steps: [
            "Substituïm la recta paramètrica dins l'equació del pla.",
            "Si el coeficient de t és 0, no hi ha una intersecció única.",
            contained ? "Com que també es compleix l'equació, tota la recta és dins del pla." : "Com que no es compleix l'equació, és paral·lela sense tall."
          ],
          type: "warning"
        });
      }
      const t = num/denom;
      const x = x0+vx*t, y = y0+vy*t, z = z0+vz*t;
      return render({
        title: "Intersecció recta-pla",
        summary: `Punt d’intersecció: <strong>(${anFmt(x)}, ${anFmt(y)}, ${anFmt(z)})</strong>.`,
        extra: analyticCards([["Valor de t", anFmt(t)], ["Punt", `(${anFmt(x)}, ${anFmt(y)}, ${anFmt(z)})`], ["Pla", atPlaneText(A,B,C,D)]]),
        steps: [
          "Substituïm x=x₀+vxt, y=y₀+vyt, z=z₀+vzt al pla.",
          "Resolem l'equació lineal en t.",
          `Obtenim <span class="math">t=${anFmt(t)}</span>.`,
          "Substituïm t a la recta per trobar el punt d'intersecció."
        ]
      });
    }

  } catch(err) {
    renderError("No s'ha pogut calcular la geometria analítica avançada.", err.message);
  }
});

updateAnalyticToolsInputs();


/* V15: múltiples gràfiques, funcions pròpies, racionals, complexos i teoria de nombres */
function v15Eval(expr, vars = {}, mode = "rad"){
  const names = Object.keys(vars);
  const values = Object.values(vars);
  const toRad = v => mode === "deg" ? v * Math.PI / 180 : v;
  const scope = {
    pi: Math.PI, e: Math.E,
    sin: v => Math.sin(toRad(v)), cos: v => Math.cos(toRad(v)), tan: v => Math.tan(toRad(v)),
    sqrt: Math.sqrt, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp
  };
  let js = expr.replace(/\^/g, "**").replace(/π/g, "pi");
  const fn = new Function(...names, ...Object.keys(scope), `"use strict"; return (${js});`);
  const val = fn(...values, ...Object.values(scope));
  if(!Number.isFinite(val)) throw new Error("Resultat no finit en una expressió.");
  return val;
}
function v15CanvasSeries(series, scale=10){
  const canvas = document.createElement("canvas");
  canvas.width = 720; canvas.height = 720; canvas.className = "function-canvas";
  const ctx = canvas.getContext("2d");
  const W=720,H=720,pad=46,min=-scale,max=scale;
  const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
  const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;
  for(let i=Math.ceil(min);i<=Math.floor(max);i++){
    ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();
  }
  ctx.strokeStyle="#374151";ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();
  ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();
  const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309","#0f766e","#db2777"];
  series.forEach((s,idx)=>{
    ctx.strokeStyle=colors[idx%colors.length];ctx.lineWidth=3;ctx.beginPath();
    let started=false;
    s.points.forEach(p=>{
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){started=false;return;}
      const cx=X(p.x), cy=Y(p.y);
      if(!started){ctx.moveTo(cx,cy);started=true;} else ctx.lineTo(cx,cy);
    });
    ctx.stroke();
  });
  return canvas.outerHTML;
}
function v15ParseLines(text){ return text.split("\n").map(x=>x.trim()).filter(Boolean); }
if($("multi-graphs-form")) $("multi-graphs-form").addEventListener("submit", event => {
  event.preventDefault();
  try{
    const type=$("mg-type").value, lines=v15ParseLines($("mg-expressions").value);
    const min=getNumber("mg-min"), max=getNumber("mg-max"), scale=getNumber("mg-scale"), mode=$("mg-angle").value;
    if(max<=min) throw new Error("El màxim ha de ser més gran que el mínim.");
    const series=[];
    for(const line of lines){
      const pts=[];
      const samples=700;
      for(let i=0;i<=samples;i++){
        const t=min+(max-min)*i/samples;
        if(type==="cartesian") pts.push({x:t,y:v15Eval(line,{x:t},mode)});
        if(type==="polar"){
          const r=v15Eval(line,{t},mode);
          const a=mode==="deg"?t*Math.PI/180:t;
          pts.push({x:r*Math.cos(a),y:r*Math.sin(a)});
        }
        if(type==="parametric"){
          const [ex,ey]=line.split(";").map(s=>s.trim());
          if(!ex||!ey) throw new Error("En paramètriques usa format: x(t); y(t)");
          pts.push({x:v15Eval(ex,{t},mode),y:v15Eval(ey,{t},mode)});
        }
      }
      series.push({label:line,points:pts});
    }
    const legend=`<ul class="multi-legend">${series.map((s,i)=>`<li>${i+1}. ${s.label}</li>`).join("")}</ul>`;
    render({title:"Múltiples gràfiques",summary:`S'han dibuixat <strong>${series.length}</strong> funcions.`,extra:legend+v15CanvasSeries(series,scale),steps:[
      "Llegim una funció per línia.",
      "Generem molts punts per a cada expressió.",
      "Dibuixem totes les sèries al mateix sistema d'eixos.",
      "En polars convertim r,t a x,y; en paramètriques fem servir x(t), y(t)."
    ]});
  }catch(err){renderError("No s'han pogut dibuixar les múltiples funcions.",err.message);}
});
function v15SavedFunctions(){ return JSON.parse(localStorage.getItem("calc-v15-functions") || "{}"); }
function v15SaveFunctions(obj){ localStorage.setItem("calc-v15-functions", JSON.stringify(obj)); }
if($("custom-functions-form")) $("custom-functions-form").addEventListener("submit", event => {
  event.preventDefault();
  const name=$("cf-name").value.trim();
  const expr=$("cf-expression").value.trim();
  if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return renderError("Nom de funció no vàlid.","Usa un nom com F, G, area1...");
  const all=v15SavedFunctions(); all[name]=expr; v15SaveFunctions(all);
  const list=Object.entries(all).map(([k,v])=>`<li>${k}(x) = ${v}</li>`).join("");
  render({title:"Funció pròpia desada",summary:`S'ha desat <strong>${name}(x)=${expr}</strong>.`,extra:`<ul class="multi-legend">${list}</ul>`,steps:[
    "La funció queda guardada al navegador amb localStorage.",
    "Pots copiar l'expressió per usar-la als mòduls de gràfiques o càlcul."
  ]});
});
function v15Frac(n,d=1){ if(d===0) throw new Error("Denominador 0."); const g=gcd(n,d); if(d<0){n=-n;d=-d;} return {n:n/g,d:d/g}; }
function v15DecimalToFrac(x){
  const s=String(x);
  if(!s.includes(".")) return v15Frac(Number(x),1);
  const decimals=s.split(".")[1].length;
  const d=10**decimals;
  return v15Frac(Math.round(Number(x)*d),d);
}
if($("rational-plus-form")) $("rational-plus-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const op=$("rat-op").value, A=$("rat-a").value.trim(), B=$("rat-b").value.trim();
    if(op==="decimal-to-fraction"){
      const f=v15DecimalToFrac(A);
      return render({title:"Decimal a fracció",summary:`${A} = <strong>${f.n}/${f.d}</strong>`,steps:["Multipliquem pel valor de potència de 10 necessari.","Simplifiquem amb el MCD."]});
    }
    const fa=parseFrac(A);
    if(op==="power"){
      const exp=Number(B); if(!Number.isInteger(exp)) throw new Error("L'exponent ha de ser enter.");
      const f=v15Frac(fa.n**Math.abs(exp),fa.d**Math.abs(exp));
      const r=exp>=0?f:v15Frac(f.d,f.n);
      return render({title:"Potència de fracció",summary:`Resultat: <strong>${r.n}/${r.d}</strong>`,steps:["Elevem numerador i denominador a l'exponent.","Si l'exponent és negatiu, invertim la fracció."]});
    }
    const fb=parseFrac(B);
    const left=fa.n*fb.d, right=fb.n*fa.d;
    const comp=left===right?"=":left>right?">":"<";
    render({title:"Comparació de fraccions",summary:`<strong>${fracStr(fa)} ${comp} ${fracStr(fb)}</strong>`,steps:["Fem productes creuats.","Comparem els valors obtinguts."]});
  }catch(err){renderError("No s'ha pogut calcular el racional.",err.message);}
});
function v15Complex(re,im){return {re,im};}
function v15Cfmt(z){return `${formatNumber(z.re)} ${z.im>=0?"+":"-"} ${formatNumber(Math.abs(z.im))}i`;}
function v15ComplexCanvas(points){
  const series=[{label:"complexos",points:points.map(p=>({x:p.re,y:p.im}))}];
  return v15CanvasSeries(series, Math.max(5, ...points.map(p=>Math.hypot(p.re,p.im)))+1);
}
if($("complex-plus-form")) $("complex-plus-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const re=getNumber("cx-re"), im=getNumber("cx-im"), n=Math.trunc(getNumber("cx-n"));
    const op=$("cx-op").value, r=Math.hypot(re,im), theta=Math.atan2(im,re);
    if(op==="power"){
      const mag=r**n, ang=theta*n, z=v15Complex(mag*Math.cos(ang),mag*Math.sin(ang));
      return render({title:"Potència amb De Moivre",summary:`z^${n} = <strong>${v15Cfmt(z)}</strong>`,extra:v15ComplexCanvas([v15Complex(re,im),z]),steps:["Passem a forma polar.","Apliquem zⁿ=rⁿ(cos nθ + i sin nθ)."]});
    }
    if(op==="roots"){
      const roots=[]; for(let k=0;k<n;k++){ const mag=r**(1/n), ang=(theta+2*Math.PI*k)/n; roots.push(v15Complex(mag*Math.cos(ang),mag*Math.sin(ang))); }
      return render({title:"Arrels n-èsimes",summary:roots.map((z,i)=>`z${i+1}=${v15Cfmt(z)}`).join("<br>"),extra:v15ComplexCanvas(roots),steps:["Les arrels es reparteixen regularment al pla complex.","Usem angles (θ+2πk)/n."]});
    }
    render({title:"Pla complex",summary:`z=<strong>${v15Cfmt(v15Complex(re,im))}</strong>`,extra:v15ComplexCanvas([v15Complex(re,im)]),steps:["La part real va a l'eix x.","La part imaginària va a l'eix y."]});
  }catch(err){renderError("No s'ha pogut calcular el complex.",err.message);}
});
function v15IsPrime(n){ n=Math.abs(Math.trunc(n)); if(n<2)return false; for(let i=2;i*i<=n;i++)if(n%i===0)return false; return true; }
function v15Egcd(a,b){ if(b===0)return {g:Math.abs(a),x:a<0?-1:1,y:0}; const r=v15Egcd(b,a%b); return {g:r.g,x:r.y,y:r.x-Math.trunc(a/b)*r.y}; }
if($("number-plus-form")) $("number-plus-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const op=$("nt-op").value, a=Math.trunc(getNumber("nt-a")), b=Math.trunc(getNumber("nt-b"));
    if(op==="is-prime") return render({title:"Primer?",summary:`${a} <strong>${v15IsPrime(a)?"és primer":"no és primer"}</strong>.`,steps:["Provem divisors fins a √n."]});
    if(op==="mod") return render({title:"Congruència modular",summary:`${a} mod ${b} = <strong>${((a%b)+b)%b}</strong>`,steps:["Calculem el residu de dividir a per n."]});
    const eg=v15Egcd(a,b);
    if(op==="bezout") return render({title:"Bézout",summary:`MCD=${eg.g}, <strong>${a}·${eg.x} + ${b}·${eg.y} = ${eg.g}</strong>`,steps:["Apliquem l'algorisme d'Euclides estès."]});
    if(eg.g!==1) return render({title:"Invers modular",type:"warning",summary:"No existeix invers perquè MCD(a,n) ≠ 1.",steps:["Un invers modular existeix només si a i n són coprimers."]});
    const inv=((eg.x%b)+b)%b;
    render({title:"Invers modular",summary:`${a}⁻¹ mod ${b} = <strong>${inv}</strong>`,steps:["Fem servir Euclides estès.","El coeficient de a és l'invers modular."]});
  }catch(err){renderError("No s'ha pogut calcular teoria de nombres.",err.message);}
});


/* V16: implícites i interseccions */
function v16EvalXY(expr,x,y){
  return v15Eval(expr,{x,y},"rad");
}
function v16ImplicitCanvas(expressions,min,max,res){
  const canvas=document.createElement("canvas");
  canvas.width=720; canvas.height=720; canvas.className="function-canvas";
  const ctx=canvas.getContext("2d"), W=720,H=720,pad=46;
  const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
  const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
  ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;
  for(let i=Math.ceil(min);i<=Math.floor(max);i++){ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();}
  ctx.strokeStyle="#374151";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();
  const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309"];
  const step=(max-min)/res;
  expressions.forEach((expr,idx)=>{
    ctx.strokeStyle=colors[idx%colors.length];ctx.lineWidth=2;
    for(let ix=0;ix<res;ix++){
      for(let iy=0;iy<res;iy++){
        const x=min+ix*step,y=min+iy*step;
        let f00,f10,f01,f11;
        try{f00=v16EvalXY(expr,x,y);f10=v16EvalXY(expr,x+step,y);f01=v16EvalXY(expr,x,y+step);f11=v16EvalXY(expr,x+step,y+step);}catch{continue;}
        const vals=[f00,f10,f01,f11];
        if(Math.min(...vals)<=0 && Math.max(...vals)>=0){
          ctx.strokeRect(X(x),Y(y+step),Math.abs(X(x+step)-X(x)),Math.abs(Y(y)-Y(y+step)));
        }
      }
    }
  });
  return canvas.outerHTML;
}
if($("implicit-form")) $("implicit-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const exprs=v15ParseLines($("implicit-expressions").value);
    const min=getNumber("imp-min"), max=getNumber("imp-max"), res=Math.trunc(getNumber("imp-res"));
    if(max<=min||res<20) throw new Error("Interval o resolució no vàlids.");
    const legend=`<ul class="multi-legend">${exprs.map((e,i)=>`<li>${i+1}. ${e}=0</li>`).join("")}</ul>`;
    render({title:"Gràfiques implícites",summary:`S'han dibuixat <strong>${exprs.length}</strong> corbes implícites.`,extra:legend+v16ImplicitCanvas(exprs,min,max,res),steps:[
      "Una gràfica implícita té forma F(x,y)=0.",
      "Escanegem una graella de punts.",
      "Quan F canvia de signe dins una cel·la, dibuixem un segment aproximat de la corba.",
      "És una aproximació numèrica, no un CAS gràfic perfecte."
    ]});
  }catch(err){renderError("No s'han pogut dibuixar les implícites.",err.message);}
});
function v16RootsDiff(f,g,min,max){
  const roots=[], step=(max-min)/600;
  let px=min, py=v15Eval(f,{x:px})-v15Eval(g,{x:px});
  for(let x=min+step;x<=max;x+=step){
    let y; try{y=v15Eval(f,{x})-v15Eval(g,{x});}catch{px=x;py=NaN;continue;}
    if(Number.isFinite(py)&&py*y<0){
      let a=px,b=x;
      for(let i=0;i<40;i++){const m=(a+b)/2; const fm=v15Eval(f,{x:m})-v15Eval(g,{x:m}); const fa=v15Eval(f,{x:a})-v15Eval(g,{x:a}); if(fa*fm<=0)b=m;else a=m;}
      roots.push((a+b)/2);
    }
    px=x; py=y;
  }
  return roots.filter((r,i,a)=>i===0||Math.abs(r-a[i-1])>0.02);
}
if($("function-analysis-plus-form")) $("function-analysis-plus-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const f=$("fa-f").value, g=$("fa-g").value, min=getNumber("fa-min"), max=getNumber("fa-max");
    const roots=v16RootsDiff(f,g,min,max);
    const series=[
      {label:`f(x)=${f}`,points:[]},
      {label:`g(x)=${g}`,points:[]}
    ];
    for(let i=0;i<=700;i++){const x=min+(max-min)*i/700; series[0].points.push({x,y:v15Eval(f,{x})}); series[1].points.push({x,y:v15Eval(g,{x})});}
    const intersections=roots.map(r=>`(${formatNumber(r)}, ${formatNumber(v15Eval(f,{x:r}))})`);
    const legend=`<ul class="multi-legend"><li>f(x)=${f}</li><li>g(x)=${g}</li>${intersections.map(p=>`<li>Intersecció: ${p}</li>`).join("")}</ul>`;
    render({title:"Anàlisi de dues funcions",summary:roots.length?`Interseccions: <strong>${intersections.join(", ")}</strong>`:"No s'han trobat interseccions en l'interval.",extra:legend+v15CanvasSeries(series,Math.max(10,Math.abs(min),Math.abs(max))),steps:[
      "Calculem h(x)=f(x)-g(x).",
      "Busquem canvis de signe de h(x).",
      "Quan hi ha canvi de signe, apliquem bisecció.",
      "Dibuixem les dues funcions al mateix sistema d'eixos."
    ]});
  }catch(err){renderError("No s'ha pogut analitzar f i g.",err.message);}
});


/* V17: CAS simbòlic ampliat amb patrons */
function v17Clean(expr){ return expr.replace(/\s+/g,"").replaceAll("**","^"); }
function v17IsPoly(expr){ try{ casParsePoly ? casParsePoly(expr) : cas10ParsePoly(expr); return true; }catch{return false;} }
function v17PolyDerivative(expr){
  if(typeof casPolyToString==="function" && typeof casDerivative==="function") return casPolyToString(casDerivative(expr));
  if(typeof casPolyToString==="function" && typeof derivativePolynomial==="function") return casPolyToString(derivativePolynomial(expr));
  if(typeof casPolyToString==="function" && typeof casParsePoly==="function"){
    const coefs=casParsePoly(expr), out={}; for(const [p,c] of Object.entries(coefs)){const n=Number(p); if(n>0)out[n-1]=(out[n-1]||0)+c*n;} return casPolyToString(out);
  }
  throw new Error("No s'ha trobat el motor de polinomis.");
}
function v17Derivative(expr){
  expr=v17Clean(expr);
  try{return v17PolyDerivative(expr);}catch{}
  let m;
  if((m=expr.match(/^sin\((.+)\)$/))) return `cos(${m[1]})*(${v17Derivative(m[1])})`;
  if((m=expr.match(/^cos\((.+)\)$/))) return `-sin(${m[1]})*(${v17Derivative(m[1])})`;
  if((m=expr.match(/^tan\((.+)\)$/))) return `(1/cos(${m[1]})^2)*(${v17Derivative(m[1])})`;
  if((m=expr.match(/^ln\((.+)\)$/))) return `(${v17Derivative(m[1])})/(${m[1]})`;
  if((m=expr.match(/^sqrt\((.+)\)$/))) return `(${v17Derivative(m[1])})/(2*sqrt(${m[1]}))`;
  if((m=expr.match(/^exp\((.+)\)$/))) return `exp(${m[1]})*(${v17Derivative(m[1])})`;
  // Producte simple amb parèntesis: (f)*(g)
  if((m=expr.match(/^\((.+)\)\*\((.+)\)$/))) return `(${v17Derivative(m[1])})*(${m[2]})+(${m[1]})*(${v17Derivative(m[2])})`;
  // Quocient simple: (f)/(g)
  if((m=expr.match(/^\((.+)\)\/\((.+)\)$/))) return `((${v17Derivative(m[1])})*(${m[2]})-(${m[1]})*(${v17Derivative(m[2])}))/(${m[2]})^2`;
  throw new Error("Patró de derivada no reconegut. Prova polinomis, sin(u), cos(u), tan(u), ln(u), sqrt(u), exp(u), (f)*(g) o (f)/(g).");
}
function v17Integral(expr){
  expr=v17Clean(expr);
  let m;
  try{
    if(typeof casPolyToString==="function" && typeof casIntegral==="function") return casPolyToString(casIntegral(expr)," + C");
  }catch{}
  if(expr==="sin(x)") return "-cos(x)+C";
  if(expr==="cos(x)") return "sin(x)+C";
  if(expr==="exp(x)" || expr==="e^x") return "e^x+C";
  if(expr==="1/x") return "ln|x|+C";
  if((m=expr.match(/^sin\(([-+]?\d*\.?\d+)\*x\)$/))) return `-cos(${m[1]}x)/${m[1]}+C`;
  if((m=expr.match(/^cos\(([-+]?\d*\.?\d+)\*x\)$/))) return `sin(${m[1]}x)/${m[1]}+C`;
  if((m=expr.match(/^exp\(([-+]?\d*\.?\d+)\*x\)$/))) return `exp(${m[1]}x)/${m[1]}+C`;
  throw new Error("Patró d'integral no reconegut. Prova polinomis, sin(x), cos(x), e^x, 1/x, sin(k*x), cos(k*x), exp(k*x).");
}
function v17SolveNumeric(expr,min,max){
  const roots=[], step=(max-min)/1200;
  let px=min, py;
  try{py=v15Eval(expr,{x:px});}catch{py=NaN;}
  for(let x=min+step;x<=max;x+=step){
    let y; try{y=v15Eval(expr,{x});}catch{px=x;py=NaN;continue;}
    if(Number.isFinite(py)&&Number.isFinite(y)&&py*y<0){
      let a=px,b=x;
      for(let i=0;i<50;i++){const mid=(a+b)/2; const fm=v15Eval(expr,{x:mid}); const fa=v15Eval(expr,{x:a}); if(fa*fm<=0)b=mid; else a=mid;}
      roots.push((a+b)/2);
    }
    px=x; py=y;
  }
  return roots.filter((r,i,a)=>i===0||Math.abs(r-a[i-1])>0.001);
}
if($("cas-plus-form")) $("cas-plus-form").addEventListener("submit", event=>{
  event.preventDefault();
  try{
    const op=$("casp-op").value, expr=$("casp-expression").value.trim(), min=getNumber("casp-min"), max=getNumber("casp-max");
    if(op==="derive-pattern"){
      const d=v17Derivative(expr);
      return render({title:"Derivada simbòlica CAS +",summary:`d/dx(${expr}) = <strong>${d}</strong>`,extra:`<div class="cas-result">${d}</div>`,steps:[
        "Intentem reconèixer el patró de l'expressió.",
        "Apliquem regla de la potència, cadena, producte o quocient quan pertoqui.",
        "El resultat és simbòlic però no sempre simplificat al màxim."
      ]});
    }
    if(op==="integral-pattern"){
      const I=v17Integral(expr);
      return render({title:"Integral simbòlica CAS +",summary:`∫ ${expr} dx = <strong>${I}</strong>`,extra:`<div class="cas-result">${I}</div>`,steps:[
        "Intentem reconèixer una integral immediata o polinòmica.",
        "Apliquem el patró corresponent.",
        "Afegim la constant C."
      ]});
    }
    const roots=v17SolveNumeric(expr,min,max);
    render({title:"Equació arbitrària f(x)=0",summary:roots.length?`Solucions aproximades: <strong>${roots.map(formatNumber).join(", ")}</strong>`:"No s'han trobat canvis de signe en l'interval.",steps:[
      "Aquesta resolució és numèrica, no simbòlica general.",
      "Escanegem l'interval buscant canvis de signe.",
      "Quan en trobem un, apliquem bisecció.",
      "Pot no trobar arrels dobles o arrels fora de l'interval."
    ]});
  }catch(err){renderError("No s'ha pogut aplicar CAS +.",err.message);}
});


/* V18: correccio robusta de canvas per a grafiques */
function v18CanvasId(prefix="graph"){ return `${prefix}-${Math.random().toString(36).slice(2)}`; }
function v18PrepareCanvas(canvasId){
  const canvas=document.getElementById(canvasId); if(!canvas) return null;
  const rect=canvas.getBoundingClientRect();
  const cssSize=Math.max(320, Math.round(rect.width || 720));
  const dpr=window.devicePixelRatio || 1;
  canvas.width=Math.round(cssSize*dpr); canvas.height=Math.round(cssSize*dpr); canvas.style.height=cssSize+"px";
  const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
  return {canvas,ctx,W:cssSize,H:cssSize};
}
function v18DrawAxes(ctx,W,H,min,max){
  const pad=Math.max(34, Math.round(W*0.07));
  const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
  const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
  ctx.clearRect(0,0,W,H); ctx.fillStyle="#fff"; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle="#e5e7eb"; ctx.lineWidth=1;
  for(let i=Math.ceil(min); i<=Math.floor(max); i++){
    ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();
  }
  ctx.strokeStyle="#374151"; ctx.lineWidth=2;
  if(min<=0 && max>=0){ ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke(); ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke(); }
  ctx.fillStyle="#374151"; ctx.font="14px system-ui, sans-serif";
  if(min<=0 && max>=0){ ctx.fillText("x", W-pad+8, Y(0)+5); ctx.fillText("y", X(0)+6, pad-10); }
  return {X,Y,pad};
}
function v18DrawSeries(canvasId, series, scale=10){
  const p=v18PrepareCanvas(canvasId); if(!p) return; const {ctx,W,H}=p;
  const safe=Math.max(1, Number(scale)||10), min=-safe, max=safe;
  const {X,Y}=v18DrawAxes(ctx,W,H,min,max);
  const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309","#0f766e","#db2777","#374151"];
  series.forEach((s,idx)=>{ ctx.strokeStyle=colors[idx%colors.length]; ctx.lineWidth=3; ctx.beginPath(); let started=false;
    s.points.forEach(pt=>{ if(!Number.isFinite(pt.x)||!Number.isFinite(pt.y)){started=false; return;} const cx=X(pt.x), cy=Y(pt.y); if(!Number.isFinite(cx)||!Number.isFinite(cy)){started=false;return;} if(!started){ctx.moveTo(cx,cy); started=true;} else ctx.lineTo(cx,cy); }); ctx.stroke(); });
}
function v18DrawImplicit(canvasId, exprs, min, max, res){
  const p=v18PrepareCanvas(canvasId); if(!p) return; const {ctx,W,H}=p; const {X,Y}=v18DrawAxes(ctx,W,H,min,max);
  const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309","#0f766e","#db2777"]; const step=(max-min)/res;
  exprs.forEach((expr,idx)=>{ ctx.strokeStyle=colors[idx%colors.length]; ctx.lineWidth=2;
    for(let ix=0; ix<res; ix++) for(let iy=0; iy<res; iy++){
      const x=min+ix*step, y=min+iy*step; let f00,f10,f01,f11;
      try{ f00=v16EvalXY(expr,x,y); f10=v16EvalXY(expr,x+step,y); f01=v16EvalXY(expr,x,y+step); f11=v16EvalXY(expr,x+step,y+step); } catch { continue; }
      const vals=[f00,f10,f01,f11].filter(Number.isFinite); if(vals.length<4) continue;
      if(Math.min(...vals)<=0 && Math.max(...vals)>=0){ ctx.strokeRect(X(x), Y(y+step), Math.abs(X(x+step)-X(x)), Math.abs(Y(y)-Y(y+step))); }
    }
  });
}
function v18RenderGraphResult({title,summary,legendHtml,steps,series,scale}){
  const id=v18CanvasId("series"); const extra=`${legendHtml||""}<div class="graph-canvas-wrap"><canvas id="${id}" aria-label="Grafica"></canvas></div>`;
  render({title,summary,extra,steps}); requestAnimationFrame(()=>v18DrawSeries(id,series,scale));
  window.addEventListener("resize",()=>{ if(document.getElementById(id)) v18DrawSeries(id,series,scale); }, {once:true});
}
function v18RenderImplicitResult({title,summary,legendHtml,steps,expressions,min,max,res}){
  const id=v18CanvasId("implicit"); const extra=`${legendHtml||""}<div class="graph-canvas-wrap"><canvas id="${id}" aria-label="Grafica implicita"></canvas></div>`;
  render({title,summary,extra,steps}); requestAnimationFrame(()=>v18DrawImplicit(id,expressions,min,max,res));
  window.addEventListener("resize",()=>{ if(document.getElementById(id)) v18DrawImplicit(id,expressions,min,max,res); }, {once:true});
}


/* V18: handlers de grafiques que substitueixen els antics */
if($("functions-form")) $("functions-form").addEventListener("submit", event=>{
  event.preventDefault(); event.stopImmediatePropagation();
  try{
    const xmin=getNumber("graph-xmin"), xmax=getNumber("graph-xmax"), x0=getNumber("tangent-x0"); if(xmax<=xmin) throw new Error("X max ha de ser mes gran que X min.");
    const F=buildFn(), fn=F.fn, y0=fn(x0), m=derivative(fn,x0), roots=rootsInRange(fn,xmin,xmax), ext=extremaApprox(fn,xmin,xmax);
    const pts=[]; for(let i=0;i<=900;i++){ const x=xmin+(xmax-xmin)*i/900; let y; try{y=fn(x);}catch{y=NaN;} pts.push({x,y}); }
    const ys=pts.map(p=>Math.abs(p.y)).filter(Number.isFinite); const scale=Math.max(10,Math.abs(xmin),Math.abs(xmax),...ys);
    const table=[]; const jump=Math.max(1,Math.round((xmax-xmin)/8)); for(let x=Math.ceil(xmin); x<=Math.floor(xmax); x+=jump){ table.push(`<li>x=${formatNumber(x)} -> f(x)=${formatNumber(fn(x))}</li>`); }
    const legend=`<ul class="multi-legend"><li>f(x)=${F.expr}</li>${roots.map(r=>`<li>Arrel aproximada: x=${formatNumber(r)}</li>`).join("")}${ext.map(r=>`<li>Extrem local aproximat: x=${formatNumber(r)}</li>`).join("")}<li>Tangent en x0=${formatNumber(x0)}: pendent ${formatNumber(m)}</li></ul><h4>Taula de valors</h4><ul class="table-list">${table.join("")}</ul>`;
    v18RenderGraphResult({title:"Estudi grafic de funcio", summary:`f(x)=<strong>${F.expr}</strong>`, legendHtml:legend, series:[{label:F.expr,points:pts}], scale, steps:[`Domini considerat: <span class="math">[${formatNumber(xmin)}, ${formatNumber(xmax)}]</span>.`, roots.length?`Arrels aproximades: <span class="math">${roots.map(formatNumber).join(", ")}</span>.`:"No s'han detectat arrels en l'interval.", ext.length?`Extrems locals aproximats: <span class="math">${ext.map(formatNumber).join(", ")}</span>.`:"No s'han detectat extrems locals clars.", `Tangent en x0=${formatNumber(x0)}: pendent <span class="math">${formatNumber(m)}</span>.`, "La v18 pinta el canvas directament despres del render."]});
  }catch(err){ renderError("No s'ha pogut dibuixar o estudiar la funcio.", err.message); }
}, true);

if($("multi-graphs-form")) $("multi-graphs-form").addEventListener("submit", event=>{
  event.preventDefault(); event.stopImmediatePropagation();
  try{
    const type=$("mg-type").value, lines=v15ParseLines($("mg-expressions").value), min=getNumber("mg-min"), max=getNumber("mg-max"), scale=getNumber("mg-scale"), mode=$("mg-angle").value; if(max<=min) throw new Error("El maxim ha de ser mes gran que el minim.");
    const series=[];
    for(const line of lines){ const pts=[]; for(let i=0;i<=900;i++){ const t=min+(max-min)*i/900; if(type==="cartesian") pts.push({x:t,y:v15Eval(line,{x:t},mode)}); if(type==="polar"){ const r=v15Eval(line,{t},mode); const a=mode==="deg"?t*Math.PI/180:t; pts.push({x:r*Math.cos(a),y:r*Math.sin(a)}); } if(type==="parametric"){ const [ex,ey]=line.split(";").map(s=>s.trim()); if(!ex||!ey) throw new Error("En parametriques usa format: x(t); y(t)"); pts.push({x:v15Eval(ex,{t},mode),y:v15Eval(ey,{t},mode)}); } } series.push({label:line,points:pts}); }
    const legend=`<ul class="multi-legend">${series.map((s,i)=>`<li>${i+1}. ${s.label}</li>`).join("")}</ul>`;
    v18RenderGraphResult({title:"Multiples grafiques", summary:`S'han dibuixat <strong>${series.length}</strong> funcions.`, legendHtml:legend, series, scale, steps:["Llegim una funcio per linia.","Generem molts punts per a cada expressio.","Dibuixem totes les series al mateix sistema d'eixos.","La v18 evita el canvas buit pintant despres del render."]});
  }catch(err){ renderError("No s'han pogut dibuixar les multiples funcions.", err.message); }
}, true);

if($("implicit-form")) $("implicit-form").addEventListener("submit", event=>{
  event.preventDefault(); event.stopImmediatePropagation();
  try{
    const exprs=v15ParseLines($("implicit-expressions").value), min=getNumber("imp-min"), max=getNumber("imp-max"), res=Math.trunc(getNumber("imp-res")); if(max<=min||res<20) throw new Error("Interval o resolucio no valids.");
    const legend=`<ul class="multi-legend">${exprs.map((e,i)=>`<li>${i+1}. ${e}=0</li>`).join("")}</ul>`;
    v18RenderImplicitResult({title:"Grafiques implicites", summary:`S'han dibuixat <strong>${exprs.length}</strong> corbes implicites.`, legendHtml:legend, expressions:exprs, min, max, res, steps:["Una grafica implicita te forma F(x,y)=0.","Escanegem una graella de punts.","Quan F canvia de signe dins una cel.la, dibuixem una aproximacio.","El canvas es pinta despres del render."]});
  }catch(err){ renderError("No s'han pogut dibuixar les implicites.", err.message); }
}, true);

if($("function-analysis-plus-form")) $("function-analysis-plus-form").addEventListener("submit", event=>{
  event.preventDefault(); event.stopImmediatePropagation();
  try{
    const f=$("fa-f").value, g=$("fa-g").value, min=getNumber("fa-min"), max=getNumber("fa-max"), roots=v16RootsDiff(f,g,min,max);
    const series=[{label:`f(x)=${f}`,points:[]},{label:`g(x)=${g}`,points:[]}];
    for(let i=0;i<=900;i++){ const x=min+(max-min)*i/900; series[0].points.push({x,y:v15Eval(f,{x})}); series[1].points.push({x,y:v15Eval(g,{x})}); }
    const intersections=roots.map(r=>`(${formatNumber(r)}, ${formatNumber(v15Eval(f,{x:r}))})`);
    const legend=`<ul class="multi-legend"><li>f(x)=${f}</li><li>g(x)=${g}</li>${intersections.map(p=>`<li>Interseccio: ${p}</li>`).join("")}</ul>`;
    v18RenderGraphResult({title:"Analisi de dues funcions", summary:roots.length?`Interseccions: <strong>${intersections.join(", ")}</strong>`:"No s'han trobat interseccions en l'interval.", legendHtml:legend, series, scale:Math.max(10,Math.abs(min),Math.abs(max)), steps:["Calculem h(x)=f(x)-g(x).","Busquem canvis de signe de h(x).","Quan hi ha canvi de signe, apliquem biseccio.","Dibuixem les dues funcions amb canvas robust."]});
  }catch(err){ renderError("No s'ha pogut analitzar f i g.", err.message); }
}, true);

if($("complex-plus-form")) $("complex-plus-form").addEventListener("submit", event=>{
  event.preventDefault(); event.stopImmediatePropagation();
  try{
    const re=getNumber("cx-re"), im=getNumber("cx-im"), n=Math.trunc(getNumber("cx-n")), op=$("cx-op").value; const r=Math.hypot(re,im), theta=Math.atan2(im,re); let title="Complexos avancats", summary="", pts=[], steps=[];
    if(op==="power"){ const mag=r**n, ang=theta*n, z={re:mag*Math.cos(ang), im:mag*Math.sin(ang)}; title="Potencia amb De Moivre"; summary=`z^${n} = <strong>${v15Cfmt(z)}</strong>`; pts=[{x:re,y:im},{x:z.re,y:z.im}]; steps=["Passem a forma polar.","Apliquem z^n=r^n(cos nθ + i sin nθ).","Representem el complex inicial i el resultat."]; }
    else if(op==="roots"){ const roots=[]; for(let k=0;k<n;k++){ const mag=r**(1/n), ang=(theta+2*Math.PI*k)/n; roots.push({re:mag*Math.cos(ang), im:mag*Math.sin(ang)}); } title="Arrels n-essimes"; summary=roots.map((z,i)=>`z${i+1}=${v15Cfmt(z)}`).join("<br>"); pts=roots.map(z=>({x:z.re,y:z.im})); steps=["Les arrels es reparteixen regularment al pla complex.","Usem angles (θ+2πk)/n.","Representem totes les arrels."]; }
    else { title="Pla complex"; summary=`z=<strong>${v15Cfmt({re,im})}</strong>`; pts=[{x:re,y:im}]; steps=["La part real va a l'eix x.","La part imaginaria va a l'eix y.","El punt representa el nombre complex."]; }
    const scale=Math.max(5,...pts.map(p=>Math.hypot(p.x,p.y)))+1;
    v18RenderGraphResult({title, summary, legendHtml:`<ul class="multi-legend">${pts.map((p,i)=>`<li>P${i+1}=(${formatNumber(p.x)}, ${formatNumber(p.y)})</li>`).join("")}</ul>`, series:[{label:"complexos",points:pts}], scale, steps});
  }catch(err){ renderError("No s'ha pogut calcular el complex.", err.message); }
}, true);

/* PWA */
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn)); }

updateEqInputs(); updateSystemInputs(); updateFunctionInputs(); updatePhysicsInputs(); updateChemistryInputs(); updateMatrixInputs(); updateGeom(); updateUnits(); updateFormulaSelect();


/* V7 safe init */
try { if (typeof updatePhysicsInputs === "function") updatePhysicsInputs(); } catch(e) {}
try { if (typeof updateChemistryInputs === "function") updateChemistryInputs(); } catch(e) {}
try { if (typeof updatePeriodicSelectV7 === "function") updatePeriodicSelectV7(); } catch(e) {}


/* calculadora-v19-offline-update */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(registration => registration.update())
      .catch(console.warn);
  });
}
