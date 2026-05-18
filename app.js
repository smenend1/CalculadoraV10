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
  mru: `<label>Desplaçament Δx (m)<input type="number" id="ph-a" value="100" step="any"></label><label>Temps Δt (s)<input type="number" id="ph-b" value="20" step="any"></label>`,
  "mrua-velocity": `<label>Velocitat inicial v₀ (m/s)<input type="number" id="ph-a" value="3" step="any"></label><label>Acceleració a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label><label>Temps t (s)<input type="number" id="ph-c" value="5" step="any"></label>`,
  "mrua-position": `<label>Posició inicial x₀ (m)<input type="number" id="ph-a" value="0" step="any"></label><label>Velocitat inicial v₀ (m/s)<input type="number" id="ph-b" value="3" step="any"></label><label>Acceleració a (m/s²)<input type="number" id="ph-c" value="2" step="any"></label><label>Temps t (s)<input type="number" id="ph-d" value="5" step="any"></label>`,
  newton: `<label>Massa m (kg)<input type="number" id="ph-a" value="10" step="any"></label><label>Acceleració a (m/s²)<input type="number" id="ph-b" value="2" step="any"></label>`,
  weight: `<label>Massa m (kg)<input type="number" id="ph-a" value="60" step="any"></label><label>Gravetat g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label>`,
  momentum: `<label>Massa m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>Velocitat v (m/s)<input type="number" id="ph-b" value="5" step="any"></label>`,
  impulse: `<label>Força F (N)<input type="number" id="ph-a" value="10" step="any"></label><label>Temps Δt (s)<input type="number" id="ph-b" value="3" step="any"></label>`,
  centripetal: `<label>Massa m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>Velocitat v (m/s)<input type="number" id="ph-b" value="4" step="any"></label><label>Radi r (m)<input type="number" id="ph-c" value="1.5" step="any"></label>`,
  work: `<label>Força F (N)<input type="number" id="ph-a" value="20" step="any"></label><label>Desplaçament d (m)<input type="number" id="ph-b" value="5" step="any"></label><label>Angle θ (graus)<input type="number" id="ph-c" value="0" step="any"></label>`,
  power: `<label>Treball W (J)<input type="number" id="ph-a" value="500" step="any"></label><label>Temps t (s)<input type="number" id="ph-b" value="10" step="any"></label>`,
  kinetic: `<label>Massa m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>Velocitat v (m/s)<input type="number" id="ph-b" value="10" step="any"></label>`,
  potential: `<label>Massa m (kg)<input type="number" id="ph-a" value="2" step="any"></label><label>Gravetat g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>Altura h (m)<input type="number" id="ph-c" value="5" step="any"></label>`,
  spring: `<label>Constant elàstica k (N/m)<input type="number" id="ph-a" value="100" step="any"></label><label>Deformació x (m)<input type="number" id="ph-b" value="0.2" step="any"></label>`,
  mechanical: `<label>Energia cinètica Ec (J)<input type="number" id="ph-a" value="100" step="any"></label><label>Energia potencial Ep (J)<input type="number" id="ph-b" value="50" step="any"></label>`,
  density: `<label>Massa m (kg)<input type="number" id="ph-a" value="10" step="any"></label><label>Volum V (m³)<input type="number" id="ph-b" value="2" step="any"></label>`,
  pressure: `<label>Força F (N)<input type="number" id="ph-a" value="100" step="any"></label><label>Superfície S (m²)<input type="number" id="ph-b" value="0.5" step="any"></label>`,
  hydrostatic: `<label>Densitat ρ (kg/m³)<input type="number" id="ph-a" value="1000" step="any"></label><label>Gravetat g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>Profunditat h (m)<input type="number" id="ph-c" value="2" step="any"></label>`,
  buoyancy: `<label>Densitat del fluid ρ (kg/m³)<input type="number" id="ph-a" value="1000" step="any"></label><label>Gravetat g (m/s²)<input type="number" id="ph-b" value="9.81" step="any"></label><label>Volum desplaçat V (m³)<input type="number" id="ph-c" value="0.01" step="any"></label>`,
  wave: `<label>Longitud d’ona λ (m)<input type="number" id="ph-a" value="2" step="any"></label><label>Freqüència f (Hz)<input type="number" id="ph-b" value="5" step="any"></label>`,
  period: `<label>Freqüència f (Hz)<input type="number" id="ph-a" value="50" step="any"></label>`,
  lens: `<label>Distància focal f (cm)<input type="number" id="ph-a" value="10" step="any"></label><label>Distància objecte do (cm)<input type="number" id="ph-b" value="30" step="any"></label>`,
  ohm: `<label>Intensitat I (A)<input type="number" id="ph-a" value="2" step="any"></label><label>Resistència R (Ω)<input type="number" id="ph-b" value="5" step="any"></label>`,
  "electric-power": `<label>Tensió V (V)<input type="number" id="ph-a" value="230" step="any"></label><label>Intensitat I (A)<input type="number" id="ph-b" value="2" step="any"></label>`,
  "resistance-series": `<label>Resistències en Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,
  "resistance-parallel": `<label>Resistències en Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,
  coulomb: `<label>Càrrega q₁ (C)<input type="number" id="ph-a" value="0.000001" step="any"></label><label>Càrrega q₂ (C)<input type="number" id="ph-b" value="0.000002" step="any"></label><label>Distància r (m)<input type="number" id="ph-c" value="0.1" step="any"></label>`,
  heat: `<label>Massa m (kg)<input type="number" id="ph-a" value="1" step="any"></label><label>Calor específica c (J/kg·K)<input type="number" id="ph-b" value="4180" step="any"></label><label>Canvi de temperatura ΔT (K o °C)<input type="number" id="ph-c" value="10" step="any"></label>`,
  phase: `<label>Massa m (kg)<input type="number" id="ph-a" value="0.5" step="any"></label><label>Calor latent L (J/kg)<input type="number" id="ph-b" value="334000" step="any"></label>`,
  "ideal-gas": `<label>Pressió P (atm)<input type="number" id="ph-a" value="1" step="any"></label><label>Volum V (L)<input type="number" id="ph-b" value="22.4" step="any"></label><label>Mols n (mol)<input type="number" id="ph-c" value="1" step="any"></label>`
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
  {n:1,s:"H",name:"Hidrogen",mass:1.008,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:2,s:"He",name:"Heli",mass:4.0026,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:3,s:"Li",name:"Liti",mass:6.94,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:4,s:"Be",name:"Beril·li",mass:9.0122,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:5,s:"B",name:"Bor",mass:10.81,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:6,s:"C",name:"Carboni",mass:12.011,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:7,s:"N",name:"Nitrogen",mass:14.007,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:8,s:"O",name:"Oxigen",mass:15.999,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:9,s:"F",name:"Fluor",mass:18.998,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:10,s:"Ne",name:"Neó",mass:20.18,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:11,s:"Na",name:"Sodi",mass:22.99,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:12,s:"Mg",name:"Magnesi",mass:24.305,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:13,s:"Al",name:"Alumini",mass:26.982,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:14,s:"Si",name:"Silici",mass:28.085,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:15,s:"P",name:"Fòsfor",mass:30.974,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:16,s:"S",name:"Sofre",mass:32.06,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:17,s:"Cl",name:"Clor",mass:35.45,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:18,s:"Ar",name:"Argó",mass:39.948,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:19,s:"K",name:"Potassi",mass:39.0983,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:20,s:"Ca",name:"Calci",mass:40.078,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:21,s:"Sc",name:"Escandi",mass:44.956,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:22,s:"Ti",name:"Titani",mass:47.867,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:23,s:"V",name:"Vanadi",mass:50.942,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:24,s:"Cr",name:"Crom",mass:51.996,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:25,s:"Mn",name:"Manganès",mass:54.938,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:26,s:"Fe",name:"Ferro",mass:55.845,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:27,s:"Co",name:"Cobalt",mass:58.933,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:28,s:"Ni",name:"Níquel",mass:58.693,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:29,s:"Cu",name:"Coure",mass:63.546,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:30,s:"Zn",name:"Zinc",mass:65.38,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:31,s:"Ga",name:"Gal·li",mass:69.723,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:32,s:"Ge",name:"Germani",mass:72.63,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:33,s:"As",name:"Arsènic",mass:74.922,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:34,s:"Se",name:"Seleni",mass:78.971,group:"No metall",use:"Element de la taula periòdica completa."},
  {n:35,s:"Br",name:"Brom",mass:79.904,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:36,s:"Kr",name:"Criptó",mass:83.798,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:37,s:"Rb",name:"Rubidi",mass:85.468,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:38,s:"Sr",name:"Estronci",mass:87.62,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:39,s:"Y",name:"Itri",mass:88.906,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:40,s:"Zr",name:"Zirconi",mass:91.224,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:41,s:"Nb",name:"Niobi",mass:92.906,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:42,s:"Mo",name:"Molibdè",mass:95.95,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:43,s:"Tc",name:"Tecneci",mass:98,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:44,s:"Ru",name:"Ruteni",mass:101.07,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:45,s:"Rh",name:"Rodi",mass:102.91,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:46,s:"Pd",name:"Pal·ladi",mass:106.42,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:47,s:"Ag",name:"Plata",mass:107.87,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:48,s:"Cd",name:"Cadmi",mass:112.41,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:49,s:"In",name:"Indi",mass:114.82,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:50,s:"Sn",name:"Estany",mass:118.71,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:51,s:"Sb",name:"Antimoni",mass:121.76,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:52,s:"Te",name:"Tel·luri",mass:127.6,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:53,s:"I",name:"Iode",mass:126.9,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:54,s:"Xe",name:"Xenó",mass:131.29,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:55,s:"Cs",name:"Cesi",mass:132.91,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:56,s:"Ba",name:"Bari",mass:137.33,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:57,s:"La",name:"Lantani",mass:138.91,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:58,s:"Ce",name:"Ceri",mass:140.12,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:59,s:"Pr",name:"Praseodimi",mass:140.91,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:60,s:"Nd",name:"Neodimi",mass:144.24,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:61,s:"Pm",name:"Prometi",mass:145,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:62,s:"Sm",name:"Samari",mass:150.36,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:63,s:"Eu",name:"Europi",mass:151.96,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:64,s:"Gd",name:"Gadolini",mass:157.25,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:65,s:"Tb",name:"Terbi",mass:158.93,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:66,s:"Dy",name:"Disprosi",mass:162.5,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:67,s:"Ho",name:"Holmi",mass:164.93,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:68,s:"Er",name:"Erbi",mass:167.26,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:69,s:"Tm",name:"Tuli",mass:168.93,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:70,s:"Yb",name:"Iterbi",mass:173.05,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:71,s:"Lu",name:"Luteci",mass:174.97,group:"Lantànid",use:"Element de la taula periòdica completa."},
  {n:72,s:"Hf",name:"Hafni",mass:178.49,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:73,s:"Ta",name:"Tàntal",mass:180.95,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:74,s:"W",name:"Tungstè",mass:183.84,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:75,s:"Re",name:"Reni",mass:186.21,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:76,s:"Os",name:"Osmi",mass:190.23,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:77,s:"Ir",name:"Iridi",mass:192.22,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:78,s:"Pt",name:"Platí",mass:195.08,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:79,s:"Au",name:"Or",mass:196.97,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:80,s:"Hg",name:"Mercuri",mass:200.59,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:81,s:"Tl",name:"Tal·li",mass:204.38,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:82,s:"Pb",name:"Plom",mass:207.2,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:83,s:"Bi",name:"Bismut",mass:208.98,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:84,s:"Po",name:"Poloni",mass:209,group:"Semimetall",use:"Element de la taula periòdica completa."},
  {n:85,s:"At",name:"Àstat",mass:210,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:86,s:"Rn",name:"Radó",mass:222,group:"Gas noble",use:"Element de la taula periòdica completa."},
  {n:87,s:"Fr",name:"Franci",mass:223,group:"Metall alcalí",use:"Element de la taula periòdica completa."},
  {n:88,s:"Ra",name:"Radi",mass:226,group:"Metall alcalinoterri",use:"Element de la taula periòdica completa."},
  {n:89,s:"Ac",name:"Actini",mass:227,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:90,s:"Th",name:"Tori",mass:232.04,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:91,s:"Pa",name:"Protactini",mass:231.04,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:92,s:"U",name:"Urani",mass:238.03,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:93,s:"Np",name:"Neptuni",mass:237,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:94,s:"Pu",name:"Plutoni",mass:244,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:95,s:"Am",name:"Americi",mass:243,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:96,s:"Cm",name:"Curi",mass:247,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:97,s:"Bk",name:"Berkeli",mass:247,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:98,s:"Cf",name:"Californi",mass:251,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:99,s:"Es",name:"Einsteini",mass:252,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:100,s:"Fm",name:"Fermi",mass:257,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:101,s:"Md",name:"Mendelevi",mass:258,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:102,s:"No",name:"Nobeli",mass:259,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:103,s:"Lr",name:"Laurenci",mass:266,group:"Actínid",use:"Element de la taula periòdica completa."},
  {n:104,s:"Rf",name:"Rutherfordi",mass:267,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:105,s:"Db",name:"Dubni",mass:268,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:106,s:"Sg",name:"Seaborgi",mass:269,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:107,s:"Bh",name:"Bohri",mass:270,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:108,s:"Hs",name:"Hassi",mass:269,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:109,s:"Mt",name:"Meitneri",mass:278,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:110,s:"Ds",name:"Darmstadti",mass:281,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:111,s:"Rg",name:"Roentgeni",mass:282,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:112,s:"Cn",name:"Copernici",mass:285,group:"Metall de transició",use:"Element de la taula periòdica completa."},
  {n:113,s:"Nh",name:"Nihoni",mass:286,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:114,s:"Fl",name:"Flerovi",mass:289,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:115,s:"Mc",name:"Moscovi",mass:290,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:116,s:"Lv",name:"Livermori",mass:293,group:"Metall",use:"Element de la taula periòdica completa."},
  {n:117,s:"Ts",name:"Tenness",mass:294,group:"Halogen",use:"Element de la taula periòdica completa."},
  {n:118,s:"Og",name:"Oganessó",mass:294,group:"Gas noble",use:"Element de la taula periòdica completa."}
];

const ATOMIC_MASS_V21 = {H:1.008, He:4.0026, Li:6.94, Be:9.0122, B:10.81, C:12.011, N:14.007, O:15.999, F:18.998, Ne:20.18, Na:22.99, Mg:24.305, Al:26.982, Si:28.085, P:30.974, S:32.06, Cl:35.45, Ar:39.948, K:39.0983, Ca:40.078, Sc:44.956, Ti:47.867, V:50.942, Cr:51.996, Mn:54.938, Fe:55.845, Co:58.933, Ni:58.693, Cu:63.546, Zn:65.38, Ga:69.723, Ge:72.63, As:74.922, Se:78.971, Br:79.904, Kr:83.798, Rb:85.468, Sr:87.62, Y:88.906, Zr:91.224, Nb:92.906, Mo:95.95, Tc:98, Ru:101.07, Rh:102.91, Pd:106.42, Ag:107.87, Cd:112.41, In:114.82, Sn:118.71, Sb:121.76, Te:127.6, I:126.9, Xe:131.29, Cs:132.91, Ba:137.33, La:138.91, Ce:140.12, Pr:140.91, Nd:144.24, Pm:145, Sm:150.36, Eu:151.96, Gd:157.25, Tb:158.93, Dy:162.5, Ho:164.93, Er:167.26, Tm:168.93, Yb:173.05, Lu:174.97, Hf:178.49, Ta:180.95, W:183.84, Re:186.21, Os:190.23, Ir:192.22, Pt:195.08, Au:196.97, Hg:200.59, Tl:204.38, Pb:207.2, Bi:208.98, Po:209, At:210, Rn:222, Fr:223, Ra:226, Ac:227, Th:232.04, Pa:231.04, U:238.03, Np:237, Pu:244, Am:243, Cm:247, Bk:247, Cf:251, Es:252, Fm:257, Md:258, No:259, Lr:266, Rf:267, Db:268, Sg:269, Bh:270, Hs:269, Mt:278, Ds:281, Rg:282, Cn:285, Nh:286, Fl:289, Mc:290, Lv:293, Ts:294, Og:294};
function ensureAtomicMassV7(){
  if (typeof ATOMIC_MASS !== "undefined") {
    Object.entries(ATOMIC_MASS_V21).forEach(([symbol, mass]) => { ATOMIC_MASS[symbol] = mass; });
    PERIODIC_ELEMENTS_V7.forEach(el => { ATOMIC_MASS[el.s] = el.mass; });
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
      extra: `<div class="subject-note">Taula periòdica completa amb els 118 elements. Les masses atòmiques són valors escolars aproximats.</div>`
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
  ctx.fillStyle = "#b1b";
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


/* V21 physics form repair */
function updatePhysicsInputsV21(){
  const box = $("physics-inputs");
  const selector = $("physics-type");
  if(!box || !selector) return;
  const template = physicsTemplates[selector.value];
  box.innerHTML = template || `<div class="subject-note">Aquest apartat encara no té camps configurats. Selecciona un altre apartat o actualitza l'aplicació.</div>`;
}
if($("physics-type")){
  $("physics-type").addEventListener("change", updatePhysicsInputsV21);
  updatePhysicsInputsV21();
}


/* V21 physics submit override */
if($("physics-form")) $("physics-form").addEventListener("submit", event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    const t = $("physics-type").value;
    let a = getMaybe("ph-a"), b = getMaybe("ph-b"), c = getMaybe("ph-c"), d = getMaybe("ph-d");
    let title = "Física", summary = "", steps = [], note = "";
    if(t==="mru"){ requireNonZero(b,"El temps"); const v=a/b; title="MRU"; summary=`v = <strong>${formatNumber(v)} m/s</strong>`; steps=[`Apliquem <span class="math">v = Δx/Δt</span>.`];}
    else if(t==="mrua-velocity"){ const v=a+b*c; title="MRUA: velocitat"; summary=`v = <strong>${formatNumber(v)} m/s</strong>`; steps=[`Apliquem <span class="math">v = v₀ + at</span>.`];}
    else if(t==="mrua-position"){ const x=a+b*d+0.5*c*d*d; title="MRUA: posició"; summary=`x = <strong>${formatNumber(x)} m</strong>`; steps=[`Apliquem <span class="math">x = x₀ + v₀t + ½at²</span>.`];}
    else if(t==="newton"){ const F=a*b; title="Segona llei de Newton"; summary=`F = <strong>${formatNumber(F)} N</strong>`; steps=[`Apliquem <span class="math">F = ma</span>.`];}
    else if(t==="weight"){ const P=a*b; title="Pes"; summary=`P = <strong>${formatNumber(P)} N</strong>`; steps=[`Apliquem <span class="math">P = mg</span>.`];}
    else if(t==="momentum"){ const p=a*b; title="Quantitat de moviment"; summary=`p = <strong>${formatNumber(p)} kg·m/s</strong>`; steps=[`Apliquem <span class="math">p = mv</span>.`];}
    else if(t==="impulse"){ const I=a*b; title="Impuls"; summary=`I = <strong>${formatNumber(I)} N·s</strong>`; steps=[`Apliquem <span class="math">I = FΔt</span>.`];}
    else if(t==="centripetal"){ requirePositive(c,"El radi"); const F=a*b*b/c; title="Força centrípeta"; summary=`Fc = <strong>${formatNumber(F)} N</strong>`; steps=[`Apliquem <span class="math">Fc = mv²/r</span>.`];}
    else if(t==="work"){ const W=a*b*Math.cos(c*Math.PI/180); title="Treball"; summary=`W = <strong>${formatNumber(W)} J</strong>`; steps=[`Apliquem <span class="math">W = Fd cosθ</span>.`];}
    else if(t==="power"){ requireNonZero(b,"El temps"); const P=a/b; title="Potència"; summary=`P = <strong>${formatNumber(P)} W</strong>`; steps=[`Apliquem <span class="math">P = W/t</span>.`];}
    else if(t==="kinetic"){ const E=0.5*a*b*b; title="Energia cinètica"; summary=`Ec = <strong>${formatNumber(E)} J</strong>`; steps=[`Apliquem <span class="math">Ec = ½mv²</span>.`];}
    else if(t==="potential"){ const E=a*b*c; title="Energia potencial"; summary=`Ep = <strong>${formatNumber(E)} J</strong>`; steps=[`Apliquem <span class="math">Ep = mgh</span>.`];}
    else if(t==="spring"){ const E=0.5*a*b*b; title="Energia elàstica"; summary=`Ee = <strong>${formatNumber(E)} J</strong>`; steps=[`Apliquem <span class="math">Ee = ½kx²</span>.`];}
    else if(t==="mechanical"){ const E=a+b; title="Energia mecànica"; summary=`Em = <strong>${formatNumber(E)} J</strong>`; steps=[`Apliquem <span class="math">Em = Ec + Ep</span>.`];}
    else if(t==="density"){ requireNonZero(b,"El volum"); const rho=a/b; title="Densitat"; summary=`ρ = <strong>${formatNumber(rho)} kg/m³</strong>`; steps=[`Apliquem <span class="math">ρ = m/V</span>.`];}
    else if(t==="pressure"){ requireNonZero(b,"La superfície"); const p=a/b; title="Pressió"; summary=`p = <strong>${formatNumber(p)} Pa</strong>`; steps=[`Apliquem <span class="math">p = F/S</span>.`];}
    else if(t==="hydrostatic"){ const p=a*b*c; title="Pressió hidrostàtica"; summary=`p = <strong>${formatNumber(p)} Pa</strong>`; steps=[`Apliquem <span class="math">p = ρgh</span>.`];}
    else if(t==="buoyancy"){ const E=a*b*c; title="Empenta d’Arquímedes"; summary=`E = <strong>${formatNumber(E)} N</strong>`; steps=[`Apliquem <span class="math">E = ρgV</span>.`];}
    else if(t==="wave"){ const v=a*b; title="Velocitat d’ona"; summary=`v = <strong>${formatNumber(v)} m/s</strong>`; steps=[`Apliquem <span class="math">v = λf</span>.`];}
    else if(t==="period"){ requireNonZero(a,"La freqüència"); const T=1/a; title="Període"; summary=`T = <strong>${formatNumber(T)} s</strong>`; steps=[`Apliquem <span class="math">T = 1/f</span>.`];}
    else if(t==="lens"){ requireNonZero(a,"La focal"); requireNonZero(b,"La distància objecte"); const inv=1/a-1/b; requireNonZero(inv,"1/f - 1/do"); const di=1/inv; title="Lent prima"; summary=`di = <strong>${formatNumber(di)} cm</strong>`; steps=[`Apliquem <span class="math">1/f = 1/do + 1/di</span>.`];}
    else if(t==="ohm"){ const V=a*b; title="Llei d’Ohm"; summary=`V = <strong>${formatNumber(V)} V</strong>`; steps=[`Apliquem <span class="math">V = IR</span>.`];}
    else if(t==="electric-power"){ const P=a*b; title="Potència elèctrica"; summary=`P = <strong>${formatNumber(P)} W</strong>`; steps=[`Apliquem <span class="math">P = VI</span>.`];}
    else if(t==="resistance-series"){ const arr=parseNumberList("ph-list"); const R=arr.reduce((s,x)=>s+x,0); title="Resistències en sèrie"; summary=`Req = <strong>${formatNumber(R)} Ω</strong>`; steps=[`En sèrie se sumen directament.`];}
    else if(t==="resistance-parallel"){ const arr=parseNumberList("ph-list"); if(arr.some(x=>x===0)) throw new Error("Cap resistència pot ser 0."); const inv=arr.reduce((s,x)=>s+1/x,0); const R=1/inv; title="Resistències en paral·lel"; summary=`Req = <strong>${formatNumber(R)} Ω</strong>`; steps=[`En paral·lel: 1/Req = 1/R₁ + 1/R₂ + ...`];}
    else if(t==="coulomb"){ requireNonZero(c,"La distància"); const F=COULOMB_K*a*b/(c*c); title="Llei de Coulomb"; summary=`F = <strong>${formatNumber(F)} N</strong>`; steps=[`Apliquem <span class="math">F = kq₁q₂/r²</span>.`];}
    else if(t==="heat"){ const Q=a*b*c; title="Calor sensible"; summary=`Q = <strong>${formatNumber(Q)} J</strong>`; steps=[`Apliquem <span class="math">Q = mcΔT</span>.`];}
    else if(t==="phase"){ const Q=a*b; title="Calor latent"; summary=`Q = <strong>${formatNumber(Q)} J</strong>`; steps=[`Apliquem <span class="math">Q = mL</span>.`];}
    else if(t==="ideal-gas"){ requireNonZero(c,"Els mols"); const T=a*b/(c*GAS_R); title="Gas ideal"; summary=`T = <strong>${formatNumber(T)} K</strong>`; steps=[`Apliquem <span class="math">PV = nRT</span>.`];}
    else throw new Error("Apartat de física no reconegut: " + t);
    render({title, summary, steps, extra: note ? `<div class="subject-note">${note}</div>` : ""});
  } catch(err) {
    renderError("No s'ha pogut calcular l'apartat de física.", err.message);
  }
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


/* V22: revisió global de física i gràfiques */
(function(){
  "use strict";

  const $v = id => document.getElementById(id);
  const fmt = (typeof formatNumber === "function")
    ? formatNumber
    : (n) => Number.isFinite(n) ? Number(n).toLocaleString("ca-ES", {maximumFractionDigits: 6}) : String(n);

  function num(id){
    const el = $v(id);
    if(!el) throw new Error("Falta el camp " + id + ".");
    const value = Number(String(el.value).replace(",", "."));
    if(!Number.isFinite(value)) throw new Error("El camp " + id + " ha de ser numèric.");
    return value;
  }
  function nonZero(value, name){ if(Math.abs(value) < 1e-14) throw new Error(name + " no pot ser 0."); }
  function positive(value, name){ if(value <= 0) throw new Error(name + " ha de ser positiu."); }
  function parseList(id){
    const el = $v(id);
    if(!el) throw new Error("Falta la llista " + id + ".");
    const arr = el.value.split(",").map(v => Number(v.trim().replace(",", ".")));
    if(!arr.length || arr.some(v => !Number.isFinite(v))) throw new Error("La llista ha de contenir nombres separats per comes.");
    return arr;
  }
  function ensureRender(payload){
    if(typeof render === "function") return render(payload);
    const box = $v("result");
    if(box) box.innerHTML = `<article class="result-card"><h3>${payload.title}</h3><p>${payload.summary}</p>${payload.extra || ""}<ol>${(payload.steps||[]).map(s=>`<li>${s}</li>`).join("")}</ol></article>`;
  }
  function ensureError(title, message){
    if(typeof renderError === "function") return renderError(title, message);
    const box = $v("result");
    if(box) box.innerHTML = `<article class="result-card error-message"><h3>${title}</h3><p>${message}</p></article>`;
  }
  function field(label, id, value, unit="", type="number"){
    const step = type === "number" ? ` step="any"` : "";
    return `<label>${label}${unit ? " (" + unit + ")" : ""}<input ${type === "number" ? 'type="number"' : ""} id="${id}" value="${value}"${step}></label>`;
  }

  const canonical = {
    "mrua-v": "mrua-velocity",
    "mrua-x": "mrua-position",
    "epower": "electric-power",
    "rseries": "resistance-series",
    "rparallel": "resistance-parallel",
    "latent": "phase",
    "idealgas": "ideal-gas"
  };
  function normType(t){ return canonical[t] || t; }

  const templatesCore = {
    mru: field("Desplaçament Δx","ph-a",100,"m") + field("Temps Δt","ph-b",20,"s"),
    "mrua-velocity": field("Velocitat inicial v₀","ph-a",3,"m/s") + field("Acceleració a","ph-b",2,"m/s²") + field("Temps t","ph-c",5,"s"),
    "mrua-position": field("Posició inicial x₀","ph-a",0,"m") + field("Velocitat inicial v₀","ph-b",3,"m/s") + field("Acceleració a","ph-c",2,"m/s²") + field("Temps t","ph-d",5,"s"),
    newton: field("Massa m","ph-a",10,"kg") + field("Acceleració a","ph-b",2,"m/s²"),
    weight: field("Massa m","ph-a",60,"kg") + field("Gravetat g","ph-b",9.81,"m/s²"),
    momentum: field("Massa m","ph-a",2,"kg") + field("Velocitat v","ph-b",5,"m/s"),
    impulse: field("Força F","ph-a",10,"N") + field("Temps Δt","ph-b",3,"s"),
    centripetal: field("Massa m","ph-a",2,"kg") + field("Velocitat v","ph-b",4,"m/s") + field("Radi r","ph-c",1.5,"m"),
    work: field("Força F","ph-a",20,"N") + field("Desplaçament d","ph-b",5,"m") + field("Angle θ","ph-c",0,"graus"),
    power: field("Treball W","ph-a",500,"J") + field("Temps t","ph-b",10,"s"),
    kinetic: field("Massa m","ph-a",2,"kg") + field("Velocitat v","ph-b",10,"m/s"),
    potential: field("Massa m","ph-a",2,"kg") + field("Gravetat g","ph-b",9.81,"m/s²") + field("Altura h","ph-c",5,"m"),
    spring: field("Constant elàstica k","ph-a",100,"N/m") + field("Deformació x","ph-b",0.2,"m"),
    mechanical: field("Energia cinètica Ec","ph-a",100,"J") + field("Energia potencial Ep","ph-b",50,"J"),
    density: field("Massa m","ph-a",10,"kg") + field("Volum V","ph-b",2,"m³"),
    pressure: field("Força F","ph-a",100,"N") + field("Superfície S","ph-b",0.5,"m²"),
    hydrostatic: field("Densitat ρ","ph-a",1000,"kg/m³") + field("Gravetat g","ph-b",9.81,"m/s²") + field("Profunditat h","ph-c",2,"m"),
    buoyancy: field("Densitat fluid ρ","ph-a",1000,"kg/m³") + field("Gravetat g","ph-b",9.81,"m/s²") + field("Volum desplaçat V","ph-c",0.01,"m³"),
    wave: field("Longitud d’ona λ","ph-a",2,"m") + field("Freqüència f","ph-b",5,"Hz"),
    period: field("Freqüència f","ph-a",50,"Hz"),
    lens: field("Distància focal f","ph-a",10,"cm") + field("Distància objecte do","ph-b",30,"cm"),
    ohm: field("Intensitat I","ph-a",2,"A") + field("Resistència R","ph-b",5,"Ω"),
    "electric-power": field("Tensió V","ph-a",230,"V") + field("Intensitat I","ph-b",2,"A"),
    "resistance-series": `<label>Resistències en Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,
    "resistance-parallel": `<label>Resistències en Ω separades per comes<input id="ph-list" value="10,20,30"></label>`,
    coulomb: field("Càrrega q₁","ph-a",0.000001,"C") + field("Càrrega q₂","ph-b",0.000002,"C") + field("Distància r","ph-c",0.1,"m"),
    heat: field("Massa m","ph-a",1,"kg") + field("Calor específica c","ph-b",4180,"J/kg·K") + field("Canvi de temperatura ΔT","ph-c",10,"K o °C"),
    phase: field("Massa m","ph-a",0.5,"kg") + field("Calor latent L","ph-b",334000,"J/kg"),
    "ideal-gas": field("Pressió P","ph-a",1,"atm") + field("Volum V","ph-b",22.4,"L") + field("Mols n","ph-c",1,"mol")
  };

  window.physicsTemplates = Object.assign({}, templatesCore, {
    "mrua-v": templatesCore["mrua-velocity"],
    "mrua-x": templatesCore["mrua-position"],
    epower: templatesCore["electric-power"],
    rseries: templatesCore["resistance-series"],
    rparallel: templatesCore["resistance-parallel"],
    latent: templatesCore.phase,
    idealgas: templatesCore["ideal-gas"]
  });

  window.updatePhysicsInputs = function updatePhysicsInputs(){
    const box = $v("physics-inputs");
    const select = $v("physics-type");
    if(!box || !select) return;
    const html = window.physicsTemplates[select.value] || templatesCore[normType(select.value)];
    box.innerHTML = html || `<div class="warning-box">Aquest apartat no té camps configurats.</div>`;
  };

  function calcPhysics(rawType){
    const type = normType(rawType);
    const K = 8.99e9, R = 0.082057;
    let title = "Física", summary = "", steps = [], note = "";

    if(type==="mru"){ const dx=num("ph-a"), t=num("ph-b"); nonZero(t,"El temps"); const v=dx/t; title="MRU"; summary=`v = <strong>${fmt(v)} m/s</strong>`; steps=[`v = Δx/Δt = ${fmt(dx)}/${fmt(t)}`];}
    else if(type==="mrua-velocity"){ const v0=num("ph-a"), a=num("ph-b"), t=num("ph-c"); const v=v0+a*t; title="MRUA: velocitat final"; summary=`v = <strong>${fmt(v)} m/s</strong>`; steps=[`v = v₀ + at`];}
    else if(type==="mrua-position"){ const x0=num("ph-a"), v0=num("ph-b"), a=num("ph-c"), t=num("ph-d"); const x=x0+v0*t+0.5*a*t*t; title="MRUA: posició"; summary=`x = <strong>${fmt(x)} m</strong>`; steps=[`x = x₀ + v₀t + ½at²`];}
    else if(type==="newton"){ const m=num("ph-a"), a=num("ph-b"); const F=m*a; title="Segona llei de Newton"; summary=`F = <strong>${fmt(F)} N</strong>`; steps=[`F = ma`];}
    else if(type==="weight"){ const m=num("ph-a"), g=num("ph-b"); const P=m*g; title="Pes"; summary=`P = <strong>${fmt(P)} N</strong>`; steps=[`P = mg`];}
    else if(type==="momentum"){ const m=num("ph-a"), v=num("ph-b"); const p=m*v; title="Quantitat de moviment"; summary=`p = <strong>${fmt(p)} kg·m/s</strong>`; steps=[`p = mv`];}
    else if(type==="impulse"){ const F=num("ph-a"), t=num("ph-b"); const I=F*t; title="Impuls"; summary=`I = <strong>${fmt(I)} N·s</strong>`; steps=[`I = FΔt`];}
    else if(type==="centripetal"){ const m=num("ph-a"), v=num("ph-b"), r=num("ph-c"); positive(r,"El radi"); const F=m*v*v/r; title="Força centrípeta"; summary=`Fc = <strong>${fmt(F)} N</strong>`; steps=[`Fc = mv²/r`];}
    else if(type==="work"){ const F=num("ph-a"), d=num("ph-b"), angle=num("ph-c"); const W=F*d*Math.cos(angle*Math.PI/180); title="Treball"; summary=`W = <strong>${fmt(W)} J</strong>`; steps=[`W = Fd cosθ`];}
    else if(type==="power"){ const W=num("ph-a"), t=num("ph-b"); nonZero(t,"El temps"); const P=W/t; title="Potència"; summary=`P = <strong>${fmt(P)} W</strong>`; steps=[`P = W/t`];}
    else if(type==="kinetic"){ const m=num("ph-a"), v=num("ph-b"); const E=0.5*m*v*v; title="Energia cinètica"; summary=`Ec = <strong>${fmt(E)} J</strong>`; steps=[`Ec = ½mv²`];}
    else if(type==="potential"){ const m=num("ph-a"), g=num("ph-b"), h=num("ph-c"); const E=m*g*h; title="Energia potencial"; summary=`Ep = <strong>${fmt(E)} J</strong>`; steps=[`Ep = mgh`];}
    else if(type==="spring"){ const k=num("ph-a"), x=num("ph-b"); const E=0.5*k*x*x; title="Energia elàstica"; summary=`Ee = <strong>${fmt(E)} J</strong>`; steps=[`Ee = ½kx²`];}
    else if(type==="mechanical"){ const Ec=num("ph-a"), Ep=num("ph-b"); const E=Ec+Ep; title="Energia mecànica"; summary=`Em = <strong>${fmt(E)} J</strong>`; steps=[`Em = Ec + Ep`];}
    else if(type==="density"){ const m=num("ph-a"), V=num("ph-b"); nonZero(V,"El volum"); const rho=m/V; title="Densitat"; summary=`ρ = <strong>${fmt(rho)} kg/m³</strong>`; steps=[`ρ = m/V`];}
    else if(type==="pressure"){ const F=num("ph-a"), S=num("ph-b"); nonZero(S,"La superfície"); const p=F/S; title="Pressió"; summary=`p = <strong>${fmt(p)} Pa</strong>`; steps=[`p = F/S`];}
    else if(type==="hydrostatic"){ const rho=num("ph-a"), g=num("ph-b"), h=num("ph-c"); const p=rho*g*h; title="Pressió hidrostàtica"; summary=`p = <strong>${fmt(p)} Pa</strong>`; steps=[`p = ρgh`];}
    else if(type==="buoyancy"){ const rho=num("ph-a"), g=num("ph-b"), V=num("ph-c"); const E=rho*g*V; title="Empenta d’Arquímedes"; summary=`E = <strong>${fmt(E)} N</strong>`; steps=[`E = ρgV`];}
    else if(type==="wave"){ const lambda=num("ph-a"), f=num("ph-b"); const v=lambda*f; title="Velocitat d’ona"; summary=`v = <strong>${fmt(v)} m/s</strong>`; steps=[`v = λf`];}
    else if(type==="period"){ const f=num("ph-a"); nonZero(f,"La freqüència"); const T=1/f; title="Període"; summary=`T = <strong>${fmt(T)} s</strong>`; steps=[`T = 1/f`];}
    else if(type==="lens"){ const focal=num("ph-a"), doo=num("ph-b"); nonZero(focal,"La focal"); nonZero(doo,"La distància objecte"); const inv=1/focal-1/doo; nonZero(inv,"1/f - 1/do"); const di=1/inv; title="Lent prima"; summary=`di = <strong>${fmt(di)} cm</strong>`; steps=[`1/di = 1/f - 1/do`]; note="El signe depèn del conveni de signes emprat.";}
    else if(type==="ohm"){ const I=num("ph-a"), Rr=num("ph-b"); const V=I*Rr; title="Llei d’Ohm"; summary=`V = <strong>${fmt(V)} V</strong>`; steps=[`V = IR`];}
    else if(type==="electric-power"){ const V=num("ph-a"), I=num("ph-b"); const P=V*I; title="Potència elèctrica"; summary=`P = <strong>${fmt(P)} W</strong>`; steps=[`P = VI`];}
    else if(type==="resistance-series"){ const arr=parseList("ph-list"); const Req=arr.reduce((s,x)=>s+x,0); title="Resistències en sèrie"; summary=`Req = <strong>${fmt(Req)} Ω</strong>`; steps=[`Req = R₁ + R₂ + ...`];}
    else if(type==="resistance-parallel"){ const arr=parseList("ph-list"); if(arr.some(x=>Math.abs(x)<1e-14)) throw new Error("Cap resistència pot ser 0."); const inv=arr.reduce((s,x)=>s+1/x,0); const Req=1/inv; title="Resistències en paral·lel"; summary=`Req = <strong>${fmt(Req)} Ω</strong>`; steps=[`1/Req = 1/R₁ + 1/R₂ + ...`];}
    else if(type==="coulomb"){ const q1=num("ph-a"), q2=num("ph-b"), r=num("ph-c"); nonZero(r,"La distància"); const F=K*q1*q2/(r*r); title="Llei de Coulomb"; summary=`F = <strong>${fmt(F)} N</strong>`; steps=[`F = kq₁q₂/r²`]; note="El signe indica atracció o repulsió segons els signes de les càrregues.";}
    else if(type==="heat"){ const m=num("ph-a"), c=num("ph-b"), dt=num("ph-c"); const Q=m*c*dt; title="Calor sensible"; summary=`Q = <strong>${fmt(Q)} J</strong>`; steps=[`Q = mcΔT`];}
    else if(type==="phase"){ const m=num("ph-a"), L=num("ph-b"); const Q=m*L; title="Calor latent"; summary=`Q = <strong>${fmt(Q)} J</strong>`; steps=[`Q = mL`];}
    else if(type==="ideal-gas"){ const P=num("ph-a"), V=num("ph-b"), n=num("ph-c"); nonZero(n,"Els mols"); const T=P*V/(n*0.082057); title="Gas ideal"; summary=`T = <strong>${fmt(T)} K</strong>`; steps=[`PV = nRT`, `T = PV/(nR), amb R = 0,082057 L·atm·mol⁻¹·K⁻¹`]; note="Model ideal; és una aproximació.";}
    else { throw new Error("Apartat de física no reconegut: " + rawType); }

    return {title, summary, steps, extra: note ? `<div class="subject-note">${note}</div>` : ""};
  }

  const physicsForm = $v("physics-form");
  if(physicsForm){
    $v("physics-type")?.addEventListener("change", window.updatePhysicsInputs);
    physicsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try { ensureRender(calcPhysics($v("physics-type").value)); }
      catch(err) { ensureError("No s'ha pogut calcular l'apartat de física.", err.message); }
    }, true);
    window.updatePhysicsInputs();
  }

  window.v22DrawSeriesOnCanvas = function(canvas, series, scale){
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(320, Math.round(rect.width || 720));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size*dpr; canvas.height = size*dpr; canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const W=size,H=size,pad=Math.max(34,Math.round(size*0.07));
    const safeScale = Math.max(1, Number(scale)||10);
    const min=-safeScale,max=safeScale;
    const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
    const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
    ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;
    for(let i=Math.ceil(min);i<=Math.floor(max);i++){ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();}
    ctx.strokeStyle="#374151";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();
    const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309","#0f766e","#db2777"];
    series.forEach((s,idx)=>{
      ctx.strokeStyle=colors[idx%colors.length];ctx.lineWidth=3;ctx.beginPath();
      let started=false;
      (s.points||[]).forEach(p=>{
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){started=false;return;}
        const cx=X(p.x), cy=Y(p.y);
        if(!started){ctx.moveTo(cx,cy);started=true;} else ctx.lineTo(cx,cy);
      });
      ctx.stroke();
    });
  };

  window.v22RenderGraph = function(payload){
    const id = "v22-graph-" + Math.random().toString(36).slice(2);
    const extra = `${payload.legend || ""}<div class="v22-canvas-wrap"><canvas id="${id}"></canvas></div>${payload.extra || ""}`;
    ensureRender({title:payload.title, summary:payload.summary, steps:payload.steps||[], extra});
    requestAnimationFrame(()=>window.v22DrawSeriesOnCanvas($v(id), payload.series || [], payload.scale || 10));
  };

  const functionsForm = $v("functions-form");
  if(functionsForm && typeof buildFn === "function"){
    functionsForm.addEventListener("submit", (event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        const xmin = num("graph-xmin"), xmax = num("graph-xmax");
        if(xmax <= xmin) throw new Error("X màx ha de ser més gran que X mín.");
        const F = buildFn();
        const pts = [];
        for(let i=0;i<=900;i++){ const x=xmin+(xmax-xmin)*i/900; let y; try{ y=F.fn(x); }catch{ y=NaN; } pts.push({x,y}); }
        const yAbs = pts.map(p=>Math.abs(p.y)).filter(Number.isFinite);
        const scale = Math.max(10, Math.abs(xmin), Math.abs(xmax), ...yAbs.slice(0,2000));
        window.v22RenderGraph({
          title:"Gràfica de funció",
          summary:`f(x)=<strong>${F.expr}</strong>`,
          series:[{label:F.expr, points:pts}],
          scale,
          steps:["Generem punts de la funció en l'interval triat.","Pintem el canvas després de renderitzar el resultat perquè sigui visible."]
        });
      }catch(err){ ensureError("No s'ha pogut dibuixar la funció.", err.message); }
    }, true);
  }

  // Override v15/v16 multi graph canvas if those forms exist, so the graph is visible on mobile.
  const multiForm = $v("multi-graphs-form");
  if(multiForm && typeof v15ParseLines === "function" && typeof v15Eval === "function"){
    multiForm.addEventListener("submit", (event)=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        const type = $v("mg-type").value;
        const lines = v15ParseLines($v("mg-expressions").value);
        const min = num("mg-min"), max = num("mg-max"), scale = num("mg-scale");
        const mode = $v("mg-angle").value;
        if(max <= min) throw new Error("El màxim ha de ser més gran que el mínim.");
        const series = [];
        for(const line of lines){
          const points = [];
          for(let i=0;i<=800;i++){
            const t = min + (max-min)*i/800;
            if(type==="cartesian") points.push({x:t, y:v15Eval(line,{x:t},mode)});
            else if(type==="polar"){ const r=v15Eval(line,{t},mode); const a=mode==="deg"?t*Math.PI/180:t; points.push({x:r*Math.cos(a),y:r*Math.sin(a)}); }
            else {
              const parts=line.split(";").map(s=>s.trim());
              if(parts.length<2) throw new Error("En paramètriques usa format: x(t); y(t)");
              points.push({x:v15Eval(parts[0],{t},mode),y:v15Eval(parts[1],{t},mode)});
            }
          }
          series.push({label:line, points});
        }
        const legend = `<ul class="multi-legend">${series.map((s,i)=>`<li>${i+1}. ${s.label}</li>`).join("")}</ul>`;
        window.v22RenderGraph({title:"Múltiples gràfiques",summary:`S'han dibuixat <strong>${series.length}</strong> funcions.`,legend,series,scale,steps:["Generem punts per a cada funció.","Pintem totes les sèries al mateix canvas."]});
      }catch(err){ ensureError("No s'han pogut dibuixar les múltiples funcions.", err.message); }
    }, true);
  }
})();


/* V23: revisió global de Química i gràfiques */
(function(){
  "use strict";

  const $v = id => document.getElementById(id);
  const fmt = (typeof formatNumber === "function")
    ? formatNumber
    : (n) => Number.isFinite(n) ? Number(n).toLocaleString("ca-ES", {maximumFractionDigits: 6}) : String(n);

  function asNumber(id){
    const el = $v(id);
    if(!el) throw new Error("Falta el camp " + id + ".");
    const value = Number(String(el.value).replace(",", "."));
    if(!Number.isFinite(value)) throw new Error("El camp " + id + " ha de ser numèric.");
    return value;
  }
  function nz(value, name){ if(Math.abs(value) < 1e-14) throw new Error(name + " no pot ser 0."); }
  function pos(value, name){ if(value <= 0) throw new Error(name + " ha de ser positiu."); }
  function out(payload){
    if(typeof render === "function") return render(payload);
    const box = $v("result");
    if(box) box.innerHTML = `<article class="result-card"><h3>${payload.title}</h3><p>${payload.summary}</p>${payload.extra || ""}<ol>${(payload.steps||[]).map(s=>`<li>${s}</li>`).join("")}</ol></article>`;
  }
  function err(title, message){
    if(typeof renderError === "function") return renderError(title, message);
    const box = $v("result");
    if(box) box.innerHTML = `<article class="result-card error-message"><h3>${title}</h3><p>${message}</p></article>`;
  }
  function input(label, id, value, unit="", type="number"){
    const step = type === "number" ? ` step="any"` : "";
    return `<label>${label}${unit ? " (" + unit + ")" : ""}<input ${type === "number" ? 'type="number"' : ""} id="${id}" value="${value}"${step}></label>`;
  }

  window.chemistryTemplatesV23 = {
    "molar-mass": input("Fórmula química","ch-formula","H2O","","text"),
    "moles-mass": input("Massa m","ch-a",18,"g") + input("Massa molar M","ch-b",18.015,"g/mol"),
    "mass-moles": input("Mols n","ch-a",2,"mol") + input("Massa molar M","ch-b",18.015,"g/mol"),
    particles: input("Mols n","ch-a",1,"mol"),
    "percent-comp": input("Fórmula química","ch-formula","H2O","","text"),
    molarity: input("Mols n","ch-a",0.25,"mol") + input("Volum V","ch-b",0.5,"L"),
    dilution: input("C₁","ch-a",2,"mol/L") + input("V₁","ch-b",0.1,"L") + input("V₂","ch-c",0.5,"L"),
    "mass-percent": input("Massa de solut","ch-a",5,"g") + input("Massa de dissolució","ch-b",100,"g"),
    "sol-density": input("Massa","ch-a",120,"g") + input("Volum","ch-b",100,"mL"),
    "ph-h": input("[H⁺]","ch-a",0.001,"mol/L"),
    "h-ph": input("pH","ch-a",3),
    poh: input("pOH","ch-a",5),
    "gas-n": input("Pressió P","ch-a",1,"atm") + input("Volum V","ch-b",22.4,"L") + input("Temperatura T","ch-c",273.15,"K"),
    "gas-v": input("Mols n","ch-a",1,"mol") + input("Temperatura T","ch-b",273.15,"K") + input("Pressió P","ch-c",1,"atm"),
    stoich: input("Mols A","ch-a",2,"mol") + input("Coeficient A","ch-b",2) + input("Coeficient B","ch-c",1),
    limiting: input("Mols A","ch-a",3,"mol") + input("Mols B","ch-b",2,"mol") + input("Coeficient A","ch-c",1) + input("Coeficient B","ch-d",1)
  };

  window.updateChemistryInputs = function updateChemistryInputs(){
    const box = $v("chemistry-inputs");
    const selector = $v("chemistry-type");
    if(!box || !selector) return;
    const html = window.chemistryTemplatesV23[selector.value];
    box.innerHTML = html || `<div class="warning-box">Aquest apartat de química no té camps configurats.</div>`;
  };

  const V23_AT = {H:1.008, He:4.0026, Li:6.94, Be:9.0122, B:10.81, C:12.011, N:14.007, O:15.999, F:18.998, Ne:20.18, Na:22.99, Mg:24.305, Al:26.982, Si:28.085, P:30.974, S:32.06, Cl:35.45, Ar:39.948, K:39.0983, Ca:40.078, Sc:44.956, Ti:47.867, V:50.942, Cr:51.996, Mn:54.938, Fe:55.845, Co:58.933, Ni:58.693, Cu:63.546, Zn:65.38, Ga:69.723, Ge:72.63, As:74.922, Se:78.971, Br:79.904, Kr:83.798, Rb:85.468, Sr:87.62, Y:88.906, Zr:91.224, Nb:92.906, Mo:95.95, Tc:98, Ru:101.07, Rh:102.91, Pd:106.42, Ag:107.87, Cd:112.41, In:114.82, Sn:118.71, Sb:121.76, Te:127.6, I:126.9, Xe:131.29, Cs:132.91, Ba:137.33, La:138.91, Ce:140.12, Pr:140.91, Nd:144.24, Pm:145, Sm:150.36, Eu:151.96, Gd:157.25, Tb:158.93, Dy:162.5, Ho:164.93, Er:167.26, Tm:168.93, Yb:173.05, Lu:174.97, Hf:178.49, Ta:180.95, W:183.84, Re:186.21, Os:190.23, Ir:192.22, Pt:195.08, Au:196.97, Hg:200.59, Tl:204.38, Pb:207.2, Bi:208.98, Po:209, At:210, Rn:222, Fr:223, Ra:226, Ac:227, Th:232.04, Pa:231.04, U:238.03, Np:237, Pu:244, Am:243, Cm:247, Bk:247, Cf:251, Es:252, Fm:257, Md:258, No:259, Lr:266, Rf:267, Db:268, Sg:269, Bh:270, Hs:269, Mt:278, Ds:281, Rg:282, Cn:285, Nh:286, Fl:289, Mc:290, Lv:293, Ts:294, Og:294};

  function parseFormulaV23(formula){
    let i = 0;
    formula = formula.trim();
    if(!formula) throw new Error("Cal escriure una fórmula química.");
    function readNumber(){
      let s = "";
      while(i < formula.length && /[0-9]/.test(formula[i])) s += formula[i++];
      return s ? Number(s) : 1;
    }
    function readGroup(){
      const counts = {};
      while(i < formula.length){
        const ch = formula[i];
        if(ch === "("){
          i++;
          const inner = readGroup();
          if(formula[i] !== ")") throw new Error("Parèntesi no tancat.");
          i++;
          const mult = readNumber();
          for(const [el, n] of Object.entries(inner)) counts[el] = (counts[el] || 0) + n * mult;
        } else if(ch === ")"){
          break;
        } else if(/[A-Z]/.test(ch)){
          let el = formula[i++];
          if(i < formula.length && /[a-z]/.test(formula[i])) el += formula[i++];
          if(!V23_AT[el]) throw new Error("Element no disponible o símbol incorrecte: " + el);
          const mult = readNumber();
          counts[el] = (counts[el] || 0) + mult;
        } else {
          throw new Error("Fórmula no vàlida prop de: " + ch);
        }
      }
      return counts;
    }
    const result = readGroup();
    if(i !== formula.length) throw new Error("Fórmula no vàlida.");
    return result;
  }
  function molarMassV23(counts){
    return Object.entries(counts).reduce((sum, [el, n]) => sum + V23_AT[el] * n, 0);
  }
  function countsText(counts){
    return Object.entries(counts).map(([el,n]) => `${el}: ${n}`).join(", ");
  }

  function calcChemistry(type){
    const R = 0.082057;
    const NA = 6.022e23;
    let title = "Química", summary = "", steps = [], extra = "";

    if(type === "molar-mass" || type === "percent-comp"){
      const formula = $v("ch-formula").value.trim();
      const counts = parseFormulaV23(formula);
      const M = molarMassV23(counts);
      if(type === "molar-mass"){
        title = "Massa molar";
        summary = `M(${formula}) = <strong>${fmt(M)} g/mol</strong>`;
        steps = [`Interpretem la fórmula: <span class="math">${countsText(counts)}</span>.`, "Multipliquem cada element per la seva massa atòmica.", `Sumem i obtenim <span class="math">${fmt(M)} g/mol</span>.`];
        extra = `<div class="v23-note">Taula periòdica completa amb masses atòmiques escolars aproximades.</div>`;
      } else {
        const parts = Object.entries(counts).map(([el,n]) => `${el}: ${fmt(V23_AT[el] * n / M * 100)}%`);
        title = "Composició percentual";
        summary = `<strong>${parts.join(" · ")}</strong>`;
        steps = [`Massa molar total: ${fmt(M)} g/mol.`, "Per cada element: massa de l'element / massa total · 100.", `Resultat: ${parts.join("; ")}.`];
      }
    }
    else if(type === "moles-mass"){ const m=asNumber("ch-a"), M=asNumber("ch-b"); nz(M,"La massa molar"); const n=m/M; title="Mols"; summary=`n = <strong>${fmt(n)} mol</strong>`; steps=[`n = m/M = ${fmt(m)}/${fmt(M)}`]; }
    else if(type === "mass-moles"){ const n=asNumber("ch-a"), M=asNumber("ch-b"); const m=n*M; title="Massa"; summary=`m = <strong>${fmt(m)} g</strong>`; steps=[`m = nM`]; }
    else if(type === "particles"){ const n=asNumber("ch-a"); const N=n*NA; title="Nombre de partícules"; summary=`N = <strong>${fmt(N)}</strong>`; steps=[`N = n·NA`, `NA = 6,022·10²³`]; }
    else if(type === "molarity"){ const n=asNumber("ch-a"), V=asNumber("ch-b"); nz(V,"El volum"); const C=n/V; title="Molaritat"; summary=`C = <strong>${fmt(C)} mol/L</strong>`; steps=[`C = n/V`]; }
    else if(type === "dilution"){ const C1=asNumber("ch-a"), V1=asNumber("ch-b"), V2=asNumber("ch-c"); nz(V2,"El volum final"); const C2=C1*V1/V2; title="Dilució"; summary=`C₂ = <strong>${fmt(C2)} mol/L</strong>`; steps=[`C₁V₁ = C₂V₂`, `C₂ = C₁V₁/V₂`]; }
    else if(type === "mass-percent"){ const ms=asNumber("ch-a"), md=asNumber("ch-b"); nz(md,"La massa de dissolució"); const p=ms/md*100; title="% en massa"; summary=`<strong>${fmt(p)}%</strong>`; steps=[`% = massa solut / massa dissolució · 100`]; }
    else if(type === "sol-density"){ const m=asNumber("ch-a"), V=asNumber("ch-b"); nz(V,"El volum"); const rho=m/V; title="Densitat de dissolució"; summary=`ρ = <strong>${fmt(rho)} g/mL</strong>`; steps=[`ρ = m/V`]; }
    else if(type === "ph-h"){ const H=asNumber("ch-a"); pos(H,"[H⁺]"); const pH=-Math.log10(H); title="pH"; summary=`pH = <strong>${fmt(pH)}</strong>`; steps=[`pH = -log[H⁺]`]; }
    else if(type === "h-ph"){ const pH=asNumber("ch-a"); const H=10**(-pH); title="[H⁺]"; summary=`[H⁺] = <strong>${fmt(H)} mol/L</strong>`; steps=[`[H⁺] = 10^(-pH)`]; }
    else if(type === "poh"){ const pOH=asNumber("ch-a"); const pH=14-pOH; title="pOH i pH"; summary=`pH = <strong>${fmt(pH)}</strong>`; steps=[`A 25 °C: pH + pOH = 14`]; }
    else if(type === "gas-n"){ const P=asNumber("ch-a"), V=asNumber("ch-b"), T=asNumber("ch-c"); nz(T,"La temperatura"); const n=P*V/(R*T); title="Gas ideal"; summary=`n = <strong>${fmt(n)} mol</strong>`; steps=[`PV = nRT`, `n = PV/RT`]; }
    else if(type === "gas-v"){ const n=asNumber("ch-a"), T=asNumber("ch-b"), P=asNumber("ch-c"); nz(P,"La pressió"); const V=n*R*T/P; title="Gas ideal"; summary=`V = <strong>${fmt(V)} L</strong>`; steps=[`PV = nRT`, `V = nRT/P`]; }
    else if(type === "stoich"){ const nA=asNumber("ch-a"), coefA=asNumber("ch-b"), coefB=asNumber("ch-c"); nz(coefA,"El coeficient A"); const nB=nA*coefB/coefA; title="Estequiometria"; summary=`Mols B = <strong>${fmt(nB)} mol</strong>`; steps=[`nB/nA = coefB/coefA`]; }
    else if(type === "limiting"){ const nA=asNumber("ch-a"), nB=asNumber("ch-b"), coefA=asNumber("ch-c"), coefB=asNumber("ch-d"); pos(coefA,"El coeficient A"); pos(coefB,"El coeficient B"); const ra=nA/coefA, rb=nB/coefB; const lim = Math.abs(ra-rb)<1e-12 ? "proporció exacta" : (ra<rb ? "A" : "B"); title="Reactiu limitant"; summary=`Limitant: <strong>${lim}</strong>`; steps=[`Comparem mols/coeficient.`, `A: ${fmt(ra)}; B: ${fmt(rb)}.`]; }
    else {
      throw new Error("Apartat de química no reconegut: " + type);
    }
    return {title, summary, steps, extra};
  }

  const chemForm = $v("chemistry-form");
  if(chemForm){
    $v("chemistry-type")?.addEventListener("change", window.updateChemistryInputs);
    chemForm.addEventListener("submit", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      try { out(calcChemistry($v("chemistry-type").value)); }
      catch(e) { err("No s'ha pogut calcular l'apartat de química.", e.message); }
    }, true);
    window.updateChemistryInputs();
  }

  function canvasSeries(canvas, series, scale){
    if(!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(320, Math.round(rect.width || 720));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size*dpr; canvas.height = size*dpr; canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const W=size,H=size,pad=Math.max(34,Math.round(size*0.07));
    const safeScale = Math.max(1, Number(scale)||10);
    const min=-safeScale,max=safeScale;
    const X=x=>pad+(x-min)/(max-min)*(W-2*pad);
    const Y=y=>H-pad-(y-min)/(max-min)*(H-2*pad);
    ctx.fillStyle="#fff";ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="#e5e7eb";ctx.lineWidth=1;
    for(let i=Math.ceil(min);i<=Math.floor(max);i++){ctx.beginPath();ctx.moveTo(X(i),pad);ctx.lineTo(X(i),H-pad);ctx.stroke();ctx.beginPath();ctx.moveTo(pad,Y(i));ctx.lineTo(W-pad,Y(i));ctx.stroke();}
    ctx.strokeStyle="#374151";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(X(0),pad);ctx.lineTo(X(0),H-pad);ctx.stroke();
    ctx.beginPath();ctx.moveTo(pad,Y(0));ctx.lineTo(W-pad,Y(0));ctx.stroke();
    const colors=["#1d4ed8","#b91c1c","#047857","#7c3aed","#b45309","#0f766e","#db2777","#111827"];
    series.forEach((s,idx)=>{
      ctx.strokeStyle=colors[idx%colors.length];ctx.lineWidth=3;ctx.beginPath();
      let started=false;
      (s.points||[]).forEach(p=>{
        if(!Number.isFinite(p.x)||!Number.isFinite(p.y)){started=false;return;}
        const cx=X(p.x), cy=Y(p.y);
        if(!started){ctx.moveTo(cx,cy);started=true;} else ctx.lineTo(cx,cy);
      });
      ctx.stroke();
    });
  }
  function renderGraph({title, summary, legend="", series, scale=10, steps=[]}){
    const id = "v23-graph-" + Math.random().toString(36).slice(2);
    out({title, summary, steps, extra:`${legend}<div class="v23-canvas-wrap"><canvas id="${id}"></canvas></div>`});
    requestAnimationFrame(()=>canvasSeries($v(id), series, scale));
  }
  function evalExpr(expr, vars={}, mode="rad"){
    if(typeof v15Eval === "function") return v15Eval(expr, vars, mode);
    const names = Object.keys(vars), vals = Object.values(vars);
    const scope = {pi:Math.PI,e:Math.E,sin:Math.sin,cos:Math.cos,tan:Math.tan,sqrt:Math.sqrt,abs:Math.abs,log:Math.log10,ln:Math.log,exp:Math.exp};
    const js = expr.replace(/\^/g,"**").replace(/π/g,"pi");
    return new Function(...names,...Object.keys(scope),`return (${js})`)(...vals,...Object.values(scope));
  }

  const polarForm = $v("polar-form");
  if(polarForm){
    polarForm.addEventListener("submit", (event)=>{
      event.preventDefault(); event.stopImmediatePropagation();
      try{
        const expr=$v("polar-expression").value;
        const tmin=asNumber("polar-tmin"), tmax=asNumber("polar-tmax"), scale=asNumber("polar-scale");
        const mode=$v("polar-angle-mode").value;
        if(tmax<=tmin) throw new Error("t màx ha de ser més gran que t mín.");
        const pts=[];
        for(let i=0;i<=900;i++){ const t=tmin+(tmax-tmin)*i/900; const r=evalExpr(expr,{t},mode); const a=mode==="deg"?t*Math.PI/180:t; pts.push({x:r*Math.cos(a),y:r*Math.sin(a)}); }
        renderGraph({title:"Gràfica polar",summary:`r(t)=<strong>${expr}</strong>`,series:[{label:expr,points:pts}],scale,steps:["Convertim coordenades polars a cartesianes: x=r cos(t), y=r sin(t).","El canvas es pinta després del render perquè sigui visible."]});
      }catch(e){ err("No s'ha pogut dibuixar la gràfica polar.",e.message); }
    }, true);
  }

  const paramForm = $v("parametric-form");
  if(paramForm){
    paramForm.addEventListener("submit", (event)=>{
      event.preventDefault(); event.stopImmediatePropagation();
      try{
        const ex=$v("param-x").value, ey=$v("param-y").value;
        const tmin=asNumber("param-tmin"), tmax=asNumber("param-tmax"), scale=asNumber("param-scale");
        const mode=$v("param-angle-mode").value;
        if(tmax<=tmin) throw new Error("t màx ha de ser més gran que t mín.");
        const pts=[];
        for(let i=0;i<=900;i++){ const t=tmin+(tmax-tmin)*i/900; pts.push({x:evalExpr(ex,{t},mode),y:evalExpr(ey,{t},mode)}); }
        renderGraph({title:"Gràfica paramètrica",summary:`x(t)=<strong>${ex}</strong>, y(t)=<strong>${ey}</strong>`,series:[{label:ex+";"+ey,points:pts}],scale,steps:["Cada valor de t genera un punt (x(t), y(t)).","Unim els punts per ordre creixent de t."]});
      }catch(e){ err("No s'ha pogut dibuixar la gràfica paramètrica.",e.message); }
    }, true);
  }

  const complexPlus = $v("complex-plus-form");
  if(complexPlus){
    complexPlus.addEventListener("submit", (event)=>{
      event.preventDefault(); event.stopImmediatePropagation();
      try{
        const re=asNumber("cx-re"), im=asNumber("cx-im"), n=Math.trunc(asNumber("cx-n"));
        const op=$v("cx-op").value;
        const r=Math.hypot(re,im), theta=Math.atan2(im,re);
        let pts=[], summary="", title="Pla complex";
        if(op==="power"){ const mag=r**n, ang=theta*n; const z={re:mag*Math.cos(ang),im:mag*Math.sin(ang)}; pts=[{x:re,y:im},{x:z.re,y:z.im}]; title="Potència complexa"; summary=`Resultat: <strong>${fmt(z.re)} ${z.im>=0?"+":"-"} ${fmt(Math.abs(z.im))}i</strong>`; }
        else if(op==="roots"){ for(let k=0;k<n;k++){ const mag=r**(1/n), ang=(theta+2*Math.PI*k)/n; pts.push({x:mag*Math.cos(ang),y:mag*Math.sin(ang)}); } title="Arrels n-èsimes"; summary=`S'han calculat <strong>${pts.length}</strong> arrels.`; }
        else { pts=[{x:re,y:im}]; summary=`z = <strong>${fmt(re)} ${im>=0?"+":"-"} ${fmt(Math.abs(im))}i</strong>`; }
        const scale=Math.max(5,...pts.map(p=>Math.hypot(p.x,p.y)))+1;
        const legend=`<ul class="multi-legend">${pts.map((p,i)=>`<li>P${i+1}=(${fmt(p.x)}, ${fmt(p.y)})</li>`).join("")}</ul>`;
        renderGraph({title,summary,legend,series:[{label:"complexos",points:pts}],scale,steps:["La part real es representa a l'eix x.","La part imaginària es representa a l'eix y."]});
      }catch(e){ err("No s'ha pogut representar el complex.",e.message); }
    }, true);
  }
})();


/* V24: més geometria i compendi ampliat de fórmules */
(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const fmt = (typeof formatNumber === "function") ? formatNumber : (n)=>Number(n).toLocaleString("ca-ES",{maximumFractionDigits:6});
  const pos = (v,name)=>{ if(!(Number.isFinite(v) && v>0)) throw new Error(name + " ha de ser positiu."); };
  const num = (id)=> {
    const el = $(id);
    if(!el) throw new Error("Falta el camp " + id + ".");
    const value = Number(String(el.value).replace(",", "."));
    if(!Number.isFinite(value)) throw new Error("El camp " + id + " ha de ser numèric.");
    return value;
  };
  const safeRender = payload => typeof render === "function" ? render(payload) : console.log(payload);
  const safeError = (title,msg) => typeof renderError === "function" ? renderError(title,msg) : console.error(title,msg);

  function L(label, id, value, extra=''){
    return `<label>${label}<input type="number" id="${id}" value="${value}" step="any" ${extra}></label>`;
  }

  const geometryTemplatesV24 = {
    square: L("Costat", "g-a", 5),
    rectangle: L("Base", "g-a", 8) + L("Altura", "g-b", 3),
    triangle: L("Base", "g-a", 10) + L("Altura", "g-b", 6),
    "equilateral-triangle": L("Costat", "g-a", 6),
    parallelogram: L("Base", "g-a", 8) + L("Altura", "g-b", 5),
    rhombus: L("Diagonal major D", "g-a", 10) + L("Diagonal menor d", "g-b", 8),
    kite: L("Diagonal major D", "g-a", 12) + L("Diagonal menor d", "g-b", 7),
    trapezoid: L("Base major", "g-a", 10) + L("Base menor", "g-b", 6) + L("Altura", "g-c", 4),
    circle: L("Radi", "g-a", 5),
    semicircle: L("Radi", "g-a", 5),
    annulus: L("Radi exterior R", "g-a", 7) + L("Radi interior r", "g-b", 3),
    ellipse: L("Semieix major a", "g-a", 6) + L("Semieix menor b", "g-b", 4),
    sector: L("Radi", "g-a", 6) + L("Angle central (graus)", "g-b", 60),
    "regular-polygon": L("Nombre de costats n", "g-a", 6, 'step="1"') + L("Costat", "g-b", 4) + L("Apotema", "g-c", 3.46),
    cube: L("Costat", "g-a", 4),
    "rect-prism": L("Llargada", "g-a", 8) + L("Amplada", "g-b", 5) + L("Altura", "g-c", 3),
    prism: L("Àrea de la base", "g-a", 24) + L("Altura", "g-b", 10),
    pyramid: L("Àrea de la base", "g-a", 36) + L("Altura", "g-b", 12),
    cylinder: L("Radi", "g-a", 3) + L("Altura", "g-b", 7),
    cone: L("Radi", "g-a", 3) + L("Altura", "g-b", 7),
    sphere: L("Radi", "g-a", 6),
    "frustum-cone": L("Radi major R", "g-a", 6) + L("Radi menor r", "g-b", 3) + L("Altura", "g-c", 8),
    "pythagoras-h": L("Catet a", "g-a", 3) + L("Catet b", "g-b", 4),
    "pythagoras-leg": L("Hipotenusa", "g-a", 5) + L("Catet conegut", "g-b", 4)
  };

  function ensureGeometryOptionsV24(){
    const select = $("geometry-type");
    if(!select) return;
    select.innerHTML = `
      <optgroup label="Figures planes">
        <option value="square">Quadrat</option>
        <option value="rectangle">Rectangle</option>
        <option value="triangle">Triangle</option>
        <option value="equilateral-triangle">Triangle equilàter</option>
        <option value="parallelogram">Paral·lelogram</option>
        <option value="rhombus">Rombe</option>
        <option value="kite">Deltoide / estel</option>
        <option value="trapezoid">Trapezi</option>
        <option value="circle">Cercle</option>
        <option value="semicircle">Semicercle</option>
        <option value="annulus">Corona circular</option>
        <option value="ellipse">El·lipse</option>
        <option value="sector">Sector circular</option>
        <option value="regular-polygon">Polígon regular</option>
      </optgroup>
      <optgroup label="Volums i superfícies">
        <option value="cube">Cub</option>
        <option value="rect-prism">Prisma rectangular</option>
        <option value="prism">Prisma (àrea base coneguda)</option>
        <option value="pyramid">Piràmide (àrea base coneguda)</option>
        <option value="cylinder">Cilindre</option>
        <option value="cone">Con</option>
        <option value="sphere">Esfera</option>
        <option value="frustum-cone">Tronc de con</option>
      </optgroup>
      <optgroup label="Pitàgores">
        <option value="pythagoras-h">Hipotenusa</option>
        <option value="pythagoras-leg">Catet</option>
      </optgroup>
    `;
  }
  function updateGeometryInputsV24(){
    const box = $("geometry-inputs");
    const select = $("geometry-type");
    if(!box || !select) return;
    box.innerHTML = geometryTemplatesV24[select.value] || '<div class="warning-box">Aquesta figura encara no té formulari definit.</div>';
  }

  function renderGeometryV24(type){
    const a = num("g-a");
    const b = $("g-b") ? num("g-b") : null;
    const c = $("g-c") ? num("g-c") : null;
    let title="", summary="", steps=[], extra="";
    const addFormula = (html) => extra = `<div class="formula-card"><strong>Fórmula:</strong> <span class="math">${html}</span></div>`;

    if(type === "square"){ pos(a,"El costat"); title="Quadrat"; summary=`Àrea = <strong>${fmt(a*a)}</strong>, perímetre = <strong>${fmt(4*a)}</strong>`; addFormula("A=costat²; P=4·costat"); steps=["L'àrea és costat per costat.", "El perímetre és la suma dels quatre costats iguals."]; }
    else if(type === "rectangle"){ pos(a,"La base"); pos(b,"L'altura"); title="Rectangle"; summary=`Àrea = <strong>${fmt(a*b)}</strong>, perímetre = <strong>${fmt(2*(a+b))}</strong>`; addFormula("A=b·h; P=2(b+h)"); steps=["Multipliquem base i altura per obtenir l'àrea.","Sumem base i altura i multipliquem per 2 per obtenir el perímetre."]; }
    else if(type === "triangle"){ pos(a,"La base"); pos(b,"L'altura"); title="Triangle"; summary=`Àrea = <strong>${fmt(a*b/2)}</strong>`; addFormula("A=(b·h)/2"); steps=["L'àrea del triangle és la meitat del rectangle equivalent de base b i altura h."]; }
    else if(type === "equilateral-triangle"){ pos(a,"El costat"); const area = Math.sqrt(3)/4*a*a; title="Triangle equilàter"; summary=`Àrea = <strong>${fmt(area)}</strong>, perímetre = <strong>${fmt(3*a)}</strong>, altura = <strong>${fmt(Math.sqrt(3)*a/2)}</strong>`; addFormula("A=(√3/4)c²; h=(√3/2)c"); steps=["En un triangle equilàter tots tres costats són iguals.","L'altura divideix el triangle en dos triangles rectangles especials 30°-60°-90°."]; }
    else if(type === "parallelogram"){ pos(a,"La base"); pos(b,"L'altura"); title="Paral·lelogram"; summary=`Àrea = <strong>${fmt(a*b)}</strong>`; addFormula("A=b·h"); steps=["L'àrea coincideix amb la d'un rectangle de la mateixa base i altura."]; }
    else if(type === "rhombus"){ pos(a,"La diagonal major"); pos(b,"La diagonal menor"); title="Rombe"; summary=`Àrea = <strong>${fmt(a*b/2)}</strong>`; addFormula("A=(D·d)/2"); steps=["L'àrea d'un rombe és la meitat del producte de les diagonals."]; }
    else if(type === "kite"){ pos(a,"La diagonal major"); pos(b,"La diagonal menor"); title="Deltoide / estel"; summary=`Àrea = <strong>${fmt(a*b/2)}</strong>`; addFormula("A=(D·d)/2"); steps=["La fórmula és la mateixa que per al rombe: la meitat del producte de les diagonals."]; }
    else if(type === "trapezoid"){ pos(a,"La base major"); pos(b,"La base menor"); pos(c,"L'altura"); title="Trapezi"; summary=`Àrea = <strong>${fmt((a+b)*c/2)}</strong>`; addFormula("A=((B+b)·h)/2"); steps=["Fem la mitjana de les dues bases.","Multipliquem aquest valor per l'altura."]; }
    else if(type === "circle"){ pos(a,"El radi"); title="Cercle"; summary=`Àrea = <strong>${fmt(Math.PI*a*a)}</strong>, longitud = <strong>${fmt(2*Math.PI*a)}</strong>`; addFormula("A=πr²; L=2πr"); steps=["L'àrea del cercle és proporcional al quadrat del radi.","La longitud de la circumferència és 2π vegades el radi."]; }
    else if(type === "semicircle"){ pos(a,"El radi"); title="Semicercle"; summary=`Àrea = <strong>${fmt(Math.PI*a*a/2)}</strong>, perímetre = <strong>${fmt(Math.PI*a + 2*a)}</strong>`; addFormula("A=(πr²)/2; P=πr+2r"); steps=["L'àrea és la meitat de la d'un cercle complet.","El perímetre és l'arc semicircular més el diàmetre."]; }
    else if(type === "annulus"){ pos(a,"El radi exterior"); pos(b,"El radi interior"); if(a<=b) throw new Error("El radi exterior ha de ser més gran que l'interior."); title="Corona circular"; summary=`Àrea = <strong>${fmt(Math.PI*(a*a-b*b))}</strong>`; addFormula("A=π(R²-r²)"); steps=["Restem l'àrea del cercle petit a l'àrea del cercle gran."]; }
    else if(type === "ellipse"){ pos(a,"El semieix major"); pos(b,"El semieix menor"); title="El·lipse"; summary=`Àrea = <strong>${fmt(Math.PI*a*b)}</strong>`; addFormula("A=πab"); steps=["Una el·lipse es calcula amb el producte dels dos semieixos i π."]; }
    else if(type === "sector"){ pos(a,"El radi"); pos(b,"L'angle"); title="Sector circular"; summary=`Àrea = <strong>${fmt(Math.PI*a*a*b/360)}</strong>, arc = <strong>${fmt(2*Math.PI*a*b/360)}</strong>`; addFormula("A=(θ/360)·πr²; arc=(θ/360)·2πr"); steps=["Calculem la fracció del cercle que representa l'angle central.","Apliquem aquesta mateixa fracció a l'àrea i a la longitud de l'arc."]; }
    else if(type === "regular-polygon"){ pos(a,"El nombre de costats"); pos(b,"El costat"); pos(c,"L'apotema"); title="Polígon regular"; summary=`Perímetre = <strong>${fmt(a*b)}</strong>, àrea = <strong>${fmt(a*b*c/2)}</strong>`; addFormula("P=n·c; A=(P·apotema)/2"); steps=["Primer trobem el perímetre multiplicant nombre de costats per costat.","Després multipliquem el perímetre per l'apotema i dividim per 2."]; }
    else if(type === "cube"){ pos(a,"El costat"); title="Cub"; summary=`Volum = <strong>${fmt(a**3)}</strong>, superfície = <strong>${fmt(6*a*a)}</strong>`; addFormula("V=c³; S=6c²"); steps=["El volum és costat al cub.","La superfície total és la suma de les 6 cares quadrades."]; }
    else if(type === "rect-prism"){ pos(a,"La llargada"); pos(b,"L'amplada"); pos(c,"L'altura"); title="Prisma rectangular"; summary=`Volum = <strong>${fmt(a*b*c)}</strong>, superfície = <strong>${fmt(2*(a*b+a*c+b*c))}</strong>`; addFormula("V=l·a·h; S=2(la+lh+ah)"); steps=["Multipliquem les tres dimensions per trobar el volum.","La superfície total suma les àrees de les sis cares."]; }
    else if(type === "prism"){ pos(a,"L'àrea de la base"); pos(b,"L'altura"); title="Prisma"; summary=`Volum = <strong>${fmt(a*b)}</strong>`; addFormula("V=A_base·h"); steps=["En qualsevol prisma, el volum és àrea de la base per altura."]; }
    else if(type === "pyramid"){ pos(a,"L'àrea de la base"); pos(b,"L'altura"); title="Piràmide"; summary=`Volum = <strong>${fmt(a*b/3)}</strong>`; addFormula("V=(A_base·h)/3"); steps=["Una piràmide ocupa un terç del prisma de la mateixa base i altura."]; }
    else if(type === "cylinder"){ pos(a,"El radi"); pos(b,"L'altura"); title="Cilindre"; summary=`Volum = <strong>${fmt(Math.PI*a*a*b)}</strong>, superfície = <strong>${fmt(2*Math.PI*a*(a+b))}</strong>`; addFormula("V=πr²h; S=2πr(r+h)"); steps=["El volum és àrea de la base per altura.","La superfície total és la suma de les dues bases i la superfície lateral."]; }
    else if(type === "cone"){ pos(a,"El radi"); pos(b,"L'altura"); const g = Math.hypot(a,b); title="Con"; summary=`Volum = <strong>${fmt(Math.PI*a*a*b/3)}</strong>, generatriu = <strong>${fmt(g)}</strong>`; addFormula("V=(πr²h)/3; g=√(r²+h²)"); steps=["El con ocupa un terç del cilindre equivalent.","La generatriu es pot obtenir amb Pitàgores."]; }
    else if(type === "sphere"){ pos(a,"El radi"); title="Esfera"; summary=`Volum = <strong>${fmt(4*Math.PI*a**3/3)}</strong>, superfície = <strong>${fmt(4*Math.PI*a*a)}</strong>`; addFormula("V=(4/3)πr³; S=4πr²"); steps=["El volum depèn del cub del radi.","La superfície depèn del quadrat del radi."]; }
    else if(type === "frustum-cone"){ pos(a,"El radi major"); pos(b,"El radi menor"); pos(c,"L'altura"); title="Tronc de con"; summary=`Volum = <strong>${fmt(Math.PI*c*(a*a+a*b+b*b)/3)}</strong>`; addFormula("V=(πh/3)(R²+Rr+r²)"); steps=["Fem servir la fórmula del tronc de con quan coneixem els dos radis i l'altura."]; }
    else if(type === "pythagoras-h"){ pos(a,"El catet a"); pos(b,"El catet b"); title="Pitàgores"; summary=`Hipotenusa = <strong>${fmt(Math.hypot(a,b))}</strong>`; addFormula("c=√(a²+b²)"); steps=["Sumem els quadrats dels catets i fem l'arrel quadrada."]; }
    else if(type === "pythagoras-leg"){ pos(a,"La hipotenusa"); pos(b,"El catet conegut"); if(a<=b) throw new Error("La hipotenusa ha de ser més gran que el catet conegut."); title="Pitàgores"; summary=`Catet = <strong>${fmt(Math.sqrt(a*a-b*b))}</strong>`; addFormula("catet=√(c²-b²)"); steps=["Aïllem el catet desconegut a partir de c²=a²+b²."]; }
    else throw new Error("Figura no reconeguda.");

    safeRender({ title, summary, extra, steps });
  }

  const formulaCatalogV24 = {
    algebra: {
      label: "Àlgebra",
      image: "./formula-images/algebra.png",
      items: [
        {name:"Producte notable: quadrat d'una suma", formula:"(a+b)² = a² + 2ab + b²", explanation:"Desenvolupa el quadrat d'un binomi.", parts:["a i b són els termes del binomi.","El terme central és el doble producte 2ab."]},
        {name:"Producte notable: quadrat d'una diferència", formula:"(a-b)² = a² - 2ab + b²", explanation:"Semblant al cas anterior, però amb signe negatiu al terme central.", parts:["El primer i l'últim terme són positius.","El terme central canvia de signe."]},
        {name:"Suma per diferència", formula:"(a+b)(a-b) = a² - b²", explanation:"Ajuda a factoritzar diferències de quadrats.", parts:["Es cancel·len els termes creuats.","Queda una diferència de quadrats."]},
        {name:"Potència d'una potència", formula:"(a^m)^n = a^(m·n)", explanation:"Multipliquem els exponents.", parts:["La base es manté.","Els exponents es multipliquen."]},
        {name:"Producte de potències", formula:"a^m · a^n = a^(m+n)", explanation:"Quan la base és la mateixa, sumem exponents.", parts:["Mateixa base.","Sumem exponents."]},
        {name:"Quocient de potències", formula:"a^m / a^n = a^(m-n)", explanation:"Quan la base és la mateixa, restem exponents.", parts:["Mateixa base.","Restem exponents."]},
        {name:"Logaritme del producte", formula:"log_a(xy) = log_a x + log_a y", explanation:"Transforma productes en sumes.", parts:["La base del logaritme es manté.","El producte es converteix en suma."]},
        {name:"Logaritme del quocient", formula:"log_a(x/y) = log_a x - log_a y", explanation:"Transforma quocients en restes.", parts:["La base es manté.","El quocient es converteix en resta."]},
        {name:"Canvi de base", formula:"log_a x = (log x)/(log a)", explanation:"Permet calcular qualsevol logaritme amb una calculadora científica.", parts:["Podem fer servir log decimal o log natural.","La relació és exacta."]}
      ]
    },
    trigonometry: {
      label: "Trigonometria",
      image: "./formula-images/trigonometry.png",
      items: [
        {name:"Relacions bàsiques", formula:"sin α = oposat/hipotenusa; cos α = adjacent/hipotenusa; tan α = oposat/adjacent", explanation:"Definicions en triangle rectangle.", parts:["Oposat: costat davant l'angle.","Adjacent: costat al costat de l'angle.","Hipotenusa: costat més llarg."]},
        {name:"Identitat fonamental", formula:"sin² α + cos² α = 1", explanation:"Relaciona les dues funcions bàsiques.", parts:["Serveix per obtenir una funció a partir de l'altra.","És vàlida per a qualsevol angle."]},
        {name:"Co-ratios", formula:"sin(90°-α)=cos α; cos(90°-α)=sin α; tan(90°-α)=cot α", explanation:"Relacions d'angles complementaris.", parts:["S'apliquen a angles que sumen 90°.","Intercanvien sin i cos."]},
        {name:"Suma d'angles", formula:"sin(α+β)=sin α cos β + cos α sin β", explanation:"Formula clau per combinar angles.", parts:["Apareixen productes de sinus i cosinus.","Serveix per deduir dobles angles."]},
        {name:"Resta d'angles", formula:"cos(α-β)=cos α cos β + sin α sin β", explanation:"Permet operar angles amb el cosinus.", parts:["Atenció al signe positiu al cas de la resta.","És útil en demostracions."]},
        {name:"Angle doble", formula:"sin 2α = 2 sin α cos α; cos 2α = cos² α - sin² α", explanation:"Relaciona l'angle doble amb l'angle simple.", parts:["La fórmula de cos 2α té formes equivalents.","Es poden obtenir a partir de suma d'angles."]},
        {name:"Mig angle", formula:"sin²(α/2)=(1-cos α)/2; cos²(α/2)=(1+cos α)/2", explanation:"Molt útil en simplificacions.", parts:["Sovint cal decidir el signe segons el quadrant.","La fórmula dona el quadrat de la funció."]},
        {name:"Producte a suma", formula:"sin α sin β = 1/2[cos(α-β)-cos(α+β)]", explanation:"Transforma productes trigonomètrics en sumes o restes.", parts:["Ajuda en integració i simplificació.","Hi ha fórmules semblants per cos·cos i sin·cos."]},
        {name:"Valors notables", formula:"0°: sin 0=0, cos 0=1; 30°: sin=1/2, cos=√3/2; 45°: sin=cos=√2/2; 60°: sin=√3/2, cos=1/2; 90°: sin 90=1, cos 90=0", explanation:"Taula trigonomètrica essencial d'ESO i Batxillerat.", parts:["Són els angles especials més utilitzats.","També es poden expressar en radians."]},
        {name:"Triangle equilàter", formula:"h=(√3/2)c; A=(√3/4)c²", explanation:"Un triangle equilàter es descompon en dos triangles 30°-60°-90°.", parts:["c és el costat.","h és l'altura."]}
      ]
    },
    equations: {
      label: "Equacions i inequacions",
      image: "./formula-images/equations.png",
      items: [
        {name:"Equació lineal", formula:"ax + b = 0 → x = -b/a", explanation:"Resolució bàsica de primer grau.", parts:["a no pot ser 0.","Aïllem x passant b a l'altre costat."]},
        {name:"Equació quadràtica", formula:"ax² + bx + c = 0 → x = (-b ± √(b²-4ac))/(2a)", explanation:"Calcular primer el discriminant.", parts:["Δ=b²-4ac.","Si Δ<0, no hi ha solucions reals."]},
        {name:"Discriminant", formula:"Δ = b² - 4ac", explanation:"Indica el nombre de solucions reals.", parts:["Δ>0: dues solucions reals.","Δ=0: una solució doble.","Δ<0: cap solució real."]},
        {name:"Sistema 2×2 (Cramer)", formula:"x=(c₁b₂-c₂b₁)/(a₁b₂-a₂b₁); y=(a₁c₂-a₂c₁)/(a₁b₂-a₂b₁)", explanation:"Per a sistemes lineals de dues equacions.", parts:["El denominador és el determinant del sistema.","Si el determinant és 0, cal estudiar el sistema."]},
        {name:"Equació biquadràtica", formula:"ax⁴ + bx² + c = 0", explanation:"Canvi de variable u=x² per transformar-la en una quadràtica.", parts:["Primer resol u.","Després fem x = ±√u quan tingui sentit."]},
        {name:"Equació exponencial", formula:"a^(f(x)) = a^(g(x)) → f(x)=g(x)", explanation:"Quan les bases són iguals i positives diferents d'1.", parts:["Comparem els exponents.","Si no tenen la mateixa base, busquem un canvi adequat."]},
        {name:"Equació logarítmica", formula:"log_a(f(x)) = b → f(x)=a^b", explanation:"Sense oblidar la condició f(x)>0.", parts:["L'argument del logaritme ha de ser positiu.","Cal comprovar la solució al final."]},
        {name:"Inequació lineal", formula:"ax+b > 0", explanation:"Es resol com una equació, però si multipliquem o dividim per un nombre negatiu, el signe canvia.", parts:["Aïllem x.","Canviem el signe si cal."]},
        {name:"Inequació quadràtica", formula:"ax²+bx+c > 0", explanation:"Analitzem les arrels i el signe de la paràbola.", parts:["Cal trobar les arrels.","Dividim la recta real en intervals de signe."]}
      ]
    },
    "analytic-geometry": {
      label: "Geometria analítica",
      image: "./formula-images/analytic-geometry.png",
      items: [
        {name:"Distància entre dos punts", formula:"d = √((x₂-x₁)² + (y₂-y₁)²)", explanation:"Aplicació directa de Pitàgores al pla.", parts:["Restem coordenades homòlogues.","Elevem al quadrat, sumem i fem l'arrel."]},
        {name:"Punt mig", formula:"M=((x₁+x₂)/2, (y₁+y₂)/2)", explanation:"Coordenades mitjanes dels extrems del segment.", parts:["Fem la mitjana de les abscisses.","Fem la mitjana de les ordenades."]},
        {name:"Pendent", formula:"m=(y₂-y₁)/(x₂-x₁)", explanation:"Mesura la inclinació d'una recta.", parts:["Si x₂=x₁, la recta és vertical.","La pendent no està definida en rectes verticals."]},
        {name:"Recta explícita", formula:"y = mx + n", explanation:"Forma habitual per dibuixar rectes.", parts:["m és la pendent.","n és l'ordenada a l'origen."]},
        {name:"Recta punt-pendent", formula:"y - y₁ = m(x - x₁)", explanation:"Molt útil quan coneixem un punt i la pendent.", parts:["Substituïm el punt conegut.","Després podem passar a forma explícita o general."]},
        {name:"Recta general", formula:"Ax + By + C = 0", explanation:"Forma algebraica general de la recta.", parts:["És útil per estudiar paral·lelisme i perpendicularitat.","La pendent és -A/B si B≠0."]},
        {name:"Recta paramètrica", formula:"x = x₀ + at; y = y₀ + bt", explanation:"Descriu la recta amb un punt i un vector director.", parts:["(x₀,y₀) és un punt.","(a,b) és el vector director."]},
        {name:"Recta contínua", formula:"(x-x₀)/a = (y-y₀)/b", explanation:"Equivalent a la forma paramètrica si a i b són no nuls.", parts:["Cal un punt i un vector director.","És útil en exercicis de geometria analítica."]},
        {name:"Circumferència", formula:"(x-a)² + (y-b)² = r²", explanation:"Centre (a,b) i radi r.", parts:["a i b són les coordenades del centre.","r és el radi."]},
        {name:"Paràbola de vèrtex (h,k)", formula:"y = a(x-h)² + k", explanation:"Permet llegir directament el vèrtex.", parts:["(h,k) és el vèrtex.","a determina obertura i concavitat."]}
      ]
    },
    "plane-geometry": {
      label: "Geometria plana",
      image: "./formula-images/plane-geometry.png",
      items: [
        {name:"Quadrat", formula:"A=c²; P=4c", explanation:"Figura de quatre costats iguals.", parts:["c és el costat.","Àrea i perímetre depenen d'una sola mesura."]},
        {name:"Rectangle", formula:"A=b·h; P=2(b+h)", explanation:"Figura de costats oposats iguals.", parts:["b és la base.","h és l'altura."]},
        {name:"Triangle", formula:"A=(b·h)/2", explanation:"Qualsevol triangle es calcula amb base i altura.", parts:["b és la base.","h és l'altura perpendicular."]},
        {name:"Triangle equilàter", formula:"A=(√3/4)c²; h=(√3/2)c", explanation:"Té tots els costats iguals.", parts:["c és el costat.","h és l'altura."]},
        {name:"Paral·lelogram", formula:"A=b·h", explanation:"Àrea igual que un rectangle equivalent.", parts:["b és la base.","h és l'altura."]},
        {name:"Rombe / deltoide", formula:"A=(D·d)/2", explanation:"Es fa servir el producte de diagonals.", parts:["D és la diagonal major.","d és la diagonal menor."]},
        {name:"Trapezi", formula:"A=((B+b)·h)/2", explanation:"Mitjana de bases per altura.", parts:["B és la base major.","b és la base menor.","h és l'altura."]},
        {name:"Cercle", formula:"A=πr²; L=2πr", explanation:"Àrea i longitud de la circumferència.", parts:["r és el radi.","L és la longitud."]},
        {name:"Sector circular", formula:"A=(θ/360)·πr²", explanation:"Prenem la part proporcional al cercle complet.", parts:["θ és l'angle central en graus.","r és el radi."]},
        {name:"Corona circular", formula:"A=π(R²-r²)", explanation:"Àrea del cercle gran menys l'àrea del petit.", parts:["R és el radi exterior.","r és el radi interior."]},
        {name:"El·lipse", formula:"A=πab", explanation:"a i b són els semieixos.", parts:["a: semieix major.","b: semieix menor."]},
        {name:"Polígon regular", formula:"P=n·c; A=(P·apotema)/2", explanation:"Generalitza molts polígons regulars.", parts:["n és el nombre de costats.","c és el costat.","apotema és la distància del centre al costat."]}
      ]
    },
    "solid-geometry": {
      label: "Cossos geomètrics",
      image: "./formula-images/solid-geometry.png",
      items: [
        {name:"Cub", formula:"V=c³; S=6c²", explanation:"Totes les arestes són iguals.", parts:["c és el costat.","S és la superfície total."]},
        {name:"Prisma rectangular", formula:"V=l·a·h; S=2(la+lh+ah)", explanation:"Ortoedre o prisma rectangular.", parts:["l: llargada.","a: amplada.","h: altura."]},
        {name:"Prisma", formula:"V=A_base·h", explanation:"Vàlid per a qualsevol prisma.", parts:["A_base és l'àrea de la base.","h és l'altura."]},
        {name:"Piràmide", formula:"V=(A_base·h)/3", explanation:"Té volum igual a un terç del prisma equivalent.", parts:["A_base és l'àrea de la base.","h és l'altura."]},
        {name:"Cilindre", formula:"V=πr²h; S=2πr(r+h)", explanation:"Dues bases circulars i una superfície lateral.", parts:["r és el radi.","h és l'altura."]},
        {name:"Con", formula:"V=(πr²h)/3", explanation:"Equivalent a un terç d'un cilindre de la mateixa base i altura.", parts:["r és el radi.","h és l'altura."]},
        {name:"Esfera", formula:"V=(4/3)πr³; S=4πr²", explanation:"Cos rodó de radi r.", parts:["r és el radi.","S és la superfície."]},
        {name:"Tronc de con", formula:"V=(πh/3)(R²+Rr+r²)", explanation:"Cos entre dues bases circulars paral·leles.", parts:["R és el radi major.","r és el radi menor.","h és l'altura."]}
      ]
    },
    physics: {
      label: "Física",
      image: "./formula-images/physics.png",
      items: [
        {name:"MRU", formula:"v=Δx/Δt", explanation:"Velocitat constant." , parts:["Δx: desplaçament","Δt: temps"]},
        {name:"MRUA", formula:"v=v₀+at; x=x₀+v₀t+½at²", explanation:"Moviment amb acceleració constant.", parts:["v₀: velocitat inicial","a: acceleració","t: temps"]},
        {name:"Newton", formula:"F=ma", explanation:"Relació entre força, massa i acceleració.", parts:["F: força","m: massa","a: acceleració"]},
        {name:"Treball", formula:"W=F·d·cos θ", explanation:"Energia transferida per una força.", parts:["F: força","d: desplaçament","θ: angle"]},
        {name:"Ohm", formula:"V=IR", explanation:"Llei bàsica d'electricitat.", parts:["V: tensió","I: intensitat","R: resistència"]},
        {name:"Gas ideal", formula:"PV=nRT", explanation:"Model ideal per gasos.", parts:["P: pressió","V: volum","n: mols","T: temperatura absoluta"]}
      ]
    },
    chemistry: {
      label: "Química",
      image: "./formula-images/chemistry.png",
      items: [
        {name:"Mols", formula:"n = m/M", explanation:"Relació entre massa i massa molar.", parts:["n: mols","m: massa","M: massa molar"]},
        {name:"Nombre de partícules", formula:"N = n·N_A", explanation:"Passa de mols a partícules.", parts:["N_A: nombre d'Avogadro","n: mols"]},
        {name:"Molaritat", formula:"C=n/V", explanation:"Concentració molar.", parts:["C: molaritat","n: mols","V: volum en litres"]},
        {name:"Dilució", formula:"C₁V₁=C₂V₂", explanation:"Conservació de la quantitat de solut.", parts:["1: estat inicial","2: estat final"]},
        {name:"pH", formula:"pH = -log[H⁺]", explanation:"Mesura l'acidesa.", parts:["[H⁺]: concentració d'ions hidrogen"]},
        {name:"Gasos", formula:"PV=nRT", explanation:"Equació d'estat del gas ideal.", parts:["P: pressió","V: volum","n: mols","T: temperatura absoluta"]}
      ]
    }
  };

  function ensureFormulaCategoriesV24(){
    const select = $("formula-category");
    if(!select) return;
    select.innerHTML = `
      <option value="algebra">Àlgebra</option>
      <option value="trigonometry">Trigonometria</option>
      <option value="equations">Equacions i inequacions</option>
      <option value="analytic-geometry">Geometria analítica</option>
      <option value="plane-geometry">Geometria plana</option>
      <option value="solid-geometry">Cossos geomètrics</option>
      <option value="physics">Física</option>
      <option value="chemistry">Química</option>
    `;
  }
  function updateFormulaSelectV24(){
    const cat = $("formula-category") ? $("formula-category").value : "algebra";
    const box = $("formula-select");
    if(!box || !formulaCatalogV24[cat]) return;
    box.innerHTML = formulaCatalogV24[cat].items.map((item, i) => `<option value="${i}">${item.name}</option>`).join("");
  }
  function renderFormulaV24(){
    const catKey = $("formula-category").value;
    const idx = Number($("formula-select").value || 0);
    const cat = formulaCatalogV24[catKey];
    if(!cat) throw new Error("Bloc de fórmules no disponible.");
    const item = cat.items[idx];
    const extra = `
      <img class="formula-illustration" src="${cat.image}" alt="Esquema de ${cat.label}" />
      <div class="formula-parts">
        <strong>Components clau</strong>
        <ul>${item.parts.map(part => `<li>${part}</li>`).join("")}</ul>
      </div>
    `;
    safeRender({
      title: `${cat.label}: ${item.name}`,
      summary: `<span class="math">${item.formula}</span>`,
      extra,
      steps: [
        item.explanation,
        "Llegeix primer el significat de cada símbol, identifica les dades de l'exercici i comprova que totes les unitats siguin coherents."
      ]
    });
  }

  // Geometry DOM hookup
  ensureGeometryOptionsV24();
  if($("geometry-type")){
    $("geometry-type").addEventListener("change", updateGeometryInputsV24, true);
    $("geometry-type").onchange = updateGeometryInputsV24;
  }
  updateGeometryInputsV24();

  if($("geometry-form")){
    $("geometry-form").addEventListener("submit", function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        renderGeometryV24($("geometry-type").value);
      }catch(err){
        safeError("No s'ha pogut calcular la geometria.", err.message);
      }
    }, true);
  }

  // Formula DOM hookup
  ensureFormulaCategoriesV24();
  if($("formula-category")){
    $("formula-category").addEventListener("change", updateFormulaSelectV24, true);
    $("formula-category").onchange = updateFormulaSelectV24;
  }
  updateFormulaSelectV24();

  if($("formulas-form")){
    $("formulas-form").addEventListener("submit", function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        renderFormulaV24();
      }catch(err){
        safeError("No s'ha pogut mostrar la fórmula.", err.message);
      }
    }, true);
  }
})();


/* V25: compendi matemàtic ampliat */
(function(){
  "use strict";
  const $ = id => document.getElementById(id);
  const safeRender = payload => typeof render === "function" ? render(payload) : console.log(payload);
  const safeError = (title,msg) => typeof renderError === "function" ? renderError(title,msg) : console.error(title,msg);

  const formulaCatalogV25 = {
    algebra: {
      label: "Àlgebra",
      image: "./formula-images/algebra.png",
      items: [
        {name:"Propietat distributiva", formula:"a(b+c)=ab+ac", explanation:"Permet desenvolupar o factoritzar expressions.", parts:["a és el factor comú.","b+c és la suma dins del parèntesi."]},
        {name:"Factor comú", formula:"ab+ac=a(b+c)", explanation:"Procés invers de la distributiva.", parts:["Busquem el factor que es repeteix.","El traiem fora del parèntesi."]},
        {name:"Quadrat d'una suma", formula:"(a+b)²=a²+2ab+b²", explanation:"Producte notable fonamental.", parts:["a²: quadrat del primer terme.","2ab: doble producte.","b²: quadrat del segon terme."]},
        {name:"Quadrat d'una diferència", formula:"(a-b)²=a²-2ab+b²", explanation:"Igual que el quadrat de suma però amb signe negatiu al terme central.", parts:["El signe només afecta el terme 2ab.","Els quadrats són positius."]},
        {name:"Suma per diferència", formula:"(a+b)(a-b)=a²-b²", explanation:"Diferència de quadrats.", parts:["S'utilitza per factoritzar.","Els termes creuats es cancel·len."]},
        {name:"Cub d'una suma", formula:"(a+b)³=a³+3a²b+3ab²+b³", explanation:"Desenvolupament de tercer grau.", parts:["Coeficients 1,3,3,1.","Segueix el triangle de Pascal."]},
        {name:"Cub d'una diferència", formula:"(a-b)³=a³-3a²b+3ab²-b³", explanation:"Alterna signes.", parts:["Coeficients 1,3,3,1.","Canvien els signes segons la potència de b."]},
        {name:"Potències: producte", formula:"a^m·a^n=a^(m+n)", explanation:"Mateixa base: sumem exponents.", parts:["La base no canvia.","Els exponents se sumen."]},
        {name:"Potències: quocient", formula:"a^m/a^n=a^(m-n)", explanation:"Mateixa base: restem exponents.", parts:["a no pot ser 0.","Restem exponent del denominador."]},
        {name:"Potència d'una potència", formula:"(a^m)^n=a^(mn)", explanation:"Multipliquem exponents.", parts:["S'aplica quan hi ha una potència elevada a una altra."]},
        {name:"Exponent negatiu", formula:"a^(-n)=1/a^n", explanation:"Un exponent negatiu indica invers.", parts:["a no pot ser 0.","Canvia de numerador a denominador."]},
        {name:"Arrels i potències", formula:"√[n](a)=a^(1/n)", explanation:"Relació entre radicals i exponents fraccionaris.", parts:["n és l'índex de l'arrel.","a és el radicand."]},
        {name:"Logaritme del producte", formula:"log_a(xy)=log_a x + log_a y", explanation:"Converteix productes en sumes.", parts:["x i y han de ser positius.","La base a és positiva i diferent d'1."]},
        {name:"Logaritme del quocient", formula:"log_a(x/y)=log_a x - log_a y", explanation:"Converteix quocients en restes.", parts:["x i y han de ser positius."]},
        {name:"Logaritme d'una potència", formula:"log_a(x^n)=n·log_a x", explanation:"L'exponent passa multiplicant.", parts:["x ha de ser positiu.","n pot ser real en context adequat."]},
        {name:"Canvi de base", formula:"log_a x = log_b x / log_b a", explanation:"Permet calcular logaritmes amb qualsevol base.", parts:["b pot ser 10 o e.","a ha de ser positiva i diferent d'1."]},
        {name:"Valor absolut", formula:"|x|={x si x≥0; -x si x<0}", explanation:"Distància de x a 0.", parts:["Sempre dona resultat no negatiu."]}
      ]
    },
    functions: {
      label: "Funcions",
      image: "./formula-images/functions.png",
      items: [
        {name:"Domini", formula:"D(f) = valors de x permesos", explanation:"Conjunt d'entrades que fan que la funció tingui sentit.", parts:["Evita denominadors 0.","Evita arrels parelles de nombres negatius en reals.","Evita logaritmes d'arguments no positius."]},
        {name:"Recorregut", formula:"Im(f) = valors que pot prendre y", explanation:"També anomenat imatge o rang.", parts:["Depèn de la forma de la funció.","Es pot estudiar amb gràfica o anàlisi."]},
        {name:"Funció lineal", formula:"f(x)=mx+n", explanation:"Recta de pendent m.", parts:["m: pendent.","n: ordenada a l'origen."]},
        {name:"Funció afí: zero", formula:"mx+n=0 → x=-n/m", explanation:"Tall amb l'eix x.", parts:["m no pot ser 0."]},
        {name:"Funció quadràtica", formula:"f(x)=ax²+bx+c", explanation:"Paràbola.", parts:["a determina concavitat.","c és el tall amb l'eix y."]},
        {name:"Vèrtex de paràbola", formula:"x_v=-b/(2a); y_v=f(x_v)", explanation:"Màxim o mínim segons el signe d'a.", parts:["Si a>0 és mínim.","Si a<0 és màxim."]},
        {name:"Forma de vèrtex", formula:"f(x)=a(x-h)²+k", explanation:"Permet llegir directament el vèrtex.", parts:["Vèrtex: (h,k)."]},
        {name:"Funció racional", formula:"f(x)=P(x)/Q(x)", explanation:"Quocient de polinomis.", parts:["Q(x) no pot ser 0.","Pot tenir asímptotes."]},
        {name:"Asímptota vertical", formula:"Q(a)=0 → x=a", explanation:"Possible asímptota en valors que anul·len el denominador.", parts:["Cal estudiar si hi ha simplificació."]},
        {name:"Funció exponencial", formula:"f(x)=a^x", explanation:"Creixement o decreixement segons la base.", parts:["Si a>1 creix.","Si 0<a<1 decreix."]},
        {name:"Funció logarítmica", formula:"f(x)=log_a x", explanation:"Inversa de l'exponencial.", parts:["Domini: x>0.","Base a>0 i a≠1."]},
        {name:"Composició", formula:"(f∘g)(x)=f(g(x))", explanation:"Aplica primer g i després f.", parts:["Cal que g(x) estigui dins del domini de f."]},
        {name:"Funció inversa", formula:"f(f⁻¹(x))=x", explanation:"Desfà l'acció de la funció.", parts:["No totes les funcions tenen inversa global.","Ha de ser injectiva en el domini considerat."]},
        {name:"Transformació vertical", formula:"g(x)=f(x)+k", explanation:"Mou la gràfica amunt o avall.", parts:["k>0: puja.","k<0: baixa."]},
        {name:"Transformació horitzontal", formula:"g(x)=f(x-h)", explanation:"Mou la gràfica cap a la dreta o esquerra.", parts:["h>0: dreta.","h<0: esquerra."]}
      ]
    },
    trigonometry: {
      label: "Trigonometria",
      image: "./formula-images/trigonometry.png",
      items: [
        {name:"Raons trigonomètriques", formula:"sin α=op/hip; cos α=adj/hip; tan α=op/adj", explanation:"Definicions en triangle rectangle.", parts:["op: catet oposat.","adj: catet adjacent.","hip: hipotenusa."]},
        {name:"Recíproques", formula:"csc α=1/sin α; sec α=1/cos α; cot α=1/tan α", explanation:"Funcions recíproques de sin, cos i tan.", parts:["csc: cosecant.","sec: secant.","cot: cotangent."]},
        {name:"Identitat fonamental", formula:"sin²α+cos²α=1", explanation:"Relació bàsica del cercle unitat.", parts:["Vàlida per a tot angle."]},
        {name:"Tangents i secants", formula:"1+tan²α=sec²α", explanation:"Deriva de dividir sin²+cos²=1 per cos².", parts:["cos α no pot ser 0."]},
        {name:"Cotangent i cosecant", formula:"1+cot²α=csc²α", explanation:"Deriva de dividir per sin².", parts:["sin α no pot ser 0."]},
        {name:"Co-ratios", formula:"sin(90°-α)=cos α; cos(90°-α)=sin α", explanation:"Relacions d'angles complementaris.", parts:["Angles que sumen 90°.","Intercanvien sinus i cosinus."]},
        {name:"Suma de sinus", formula:"sin(α+β)=sinαcosβ+cosαsinβ", explanation:"Fórmula d'addició.", parts:["Útil per deduir angles dobles."]},
        {name:"Resta de sinus", formula:"sin(α-β)=sinαcosβ-cosαsinβ", explanation:"Canvia el signe del segon terme.", parts:["Atenció als signes."]},
        {name:"Suma de cosinus", formula:"cos(α+β)=cosαcosβ-sinαsinβ", explanation:"Fórmula d'addició del cosinus.", parts:["El signe és negatiu."]},
        {name:"Resta de cosinus", formula:"cos(α-β)=cosαcosβ+sinαsinβ", explanation:"Fórmula per diferència d'angles.", parts:["El signe és positiu."]},
        {name:"Tangent de suma", formula:"tan(α+β)=(tanα+tanβ)/(1-tanαtanβ)", explanation:"Combina tangents.", parts:["Denominador no pot ser 0."]},
        {name:"Angle doble sinus", formula:"sin(2α)=2sinαcosα", explanation:"Cas particular de sin(α+α).", parts:["Apareix el doble producte."]},
        {name:"Angle doble cosinus", formula:"cos(2α)=cos²α-sin²α=2cos²α-1=1-2sin²α", explanation:"Tres formes equivalents.", parts:["Tria la forma segons les dades disponibles."]},
        {name:"Angle doble tangent", formula:"tan(2α)=2tanα/(1-tan²α)", explanation:"Cas particular de tangent de suma.", parts:["El denominador no pot ser 0."]},
        {name:"Mig angle sinus", formula:"sin²(α/2)=(1-cosα)/2", explanation:"Permet obtenir sinus del mig angle.", parts:["Cal decidir el signe segons el quadrant."]},
        {name:"Mig angle cosinus", formula:"cos²(α/2)=(1+cosα)/2", explanation:"Permet obtenir cosinus del mig angle.", parts:["Cal decidir el signe segons el quadrant."]},
        {name:"Producte a suma 1", formula:"sinαsinβ=1/2[cos(α-β)-cos(α+β)]", explanation:"Transforma productes en sumes.", parts:["Útil en simplificacions i integrals."]},
        {name:"Producte a suma 2", formula:"cosαcosβ=1/2[cos(α-β)+cos(α+β)]", explanation:"Producte de cosinus.", parts:["Suma de dos cosinus."]},
        {name:"Producte a suma 3", formula:"sinαcosβ=1/2[sin(α+β)+sin(α-β)]", explanation:"Producte sinus-cosinus.", parts:["Suma de sinus."]},
        {name:"Taula trigonomètrica notable", formula:"0°,30°,45°,60°,90°", explanation:"Valors essencials de sinus, cosinus i tangent.", parts:["sin 30°=1/2.","cos 60°=1/2.","tan 45°=1."]},
        {name:"Radians i graus", formula:"180°=π rad", explanation:"Conversió bàsica d'angles.", parts:["graus→rad: multiplica per π/180.","rad→graus: multiplica per 180/π."]},
        {name:"Triangle equilàter", formula:"h=(√3/2)c; A=(√3/4)c²", explanation:"Relació geomètrica i trigonomètrica.", parts:["c és el costat.","h és l'altura."]}
      ]
    },
    equations: {
      label: "Equacions i inequacions",
      image: "./formula-images/equations.png",
      items: [
        {name:"Lineal", formula:"ax+b=0 → x=-b/a", explanation:"Equació de primer grau.", parts:["a no pot ser 0."]},
        {name:"Quadràtica", formula:"ax²+bx+c=0 → x=(-b±√Δ)/(2a)", explanation:"Formula general.", parts:["Δ=b²-4ac.","a no pot ser 0."]},
        {name:"Discriminant", formula:"Δ=b²-4ac", explanation:"Decideix el nombre de solucions reals.", parts:["Δ>0: dues.","Δ=0: una doble.","Δ<0: cap real."]},
        {name:"Equació incompleta 1", formula:"ax²+c=0 → x=±√(-c/a)", explanation:"Quan falta el terme bx.", parts:["Cal que -c/a sigui no negatiu en reals."]},
        {name:"Equació incompleta 2", formula:"ax²+bx=0 → x(ax+b)=0", explanation:"Factoritzem x.", parts:["Solucions: x=0 i x=-b/a."]},
        {name:"Biquadràtica", formula:"ax⁴+bx²+c=0; u=x²", explanation:"Canvi de variable.", parts:["Resol primer en u.","Després x=±√u."]},
        {name:"Racional", formula:"P(x)/Q(x)=0 → P(x)=0, Q(x)≠0", explanation:"Una fracció és 0 quan el numerador és 0.", parts:["No oblidis excloure els zeros del denominador."]},
        {name:"Exponencial mateixa base", formula:"a^f(x)=a^g(x) → f(x)=g(x)", explanation:"Si la base és positiva i diferent d'1.", parts:["Compara exponents."]},
        {name:"Logarítmica", formula:"log_a(f(x))=b → f(x)=a^b", explanation:"Passa de logaritme a exponencial.", parts:["Condició: f(x)>0."]},
        {name:"Sistema 2×2", formula:"a₁x+b₁y=c₁; a₂x+b₂y=c₂", explanation:"Es pot resoldre per substitució, reducció o Cramer.", parts:["Mira si el determinant és 0."]},
        {name:"Cramer 2×2", formula:"x=(c₁b₂-c₂b₁)/(a₁b₂-a₂b₁)", explanation:"Formula per x en sistemes 2×2.", parts:["Denominador: determinant principal."]},
        {name:"Inequació lineal", formula:"ax+b>0", explanation:"Aïlla x.", parts:["Si divideixes per un nombre negatiu, canvia el signe."]},
        {name:"Inequació quadràtica", formula:"ax²+bx+c>0", explanation:"Estudia signes per intervals.", parts:["Troba arrels.","Analitza el signe de la paràbola."]},
        {name:"Inequació racional", formula:"P(x)/Q(x)>0", explanation:"Taula de signes amb zeros de P i Q.", parts:["Els zeros del denominador no s'inclouen."]},
        {name:"Valor absolut", formula:"|x-a|<r → a-r<x<a+r", explanation:"Distància menor que r.", parts:["r ha de ser positiu."]},
        {name:"Valor absolut gran", formula:"|x-a|>r → x<a-r o x>a+r", explanation:"Distància més gran que r.", parts:["Dona dos intervals."]}
      ]
    },
    "analytic-geometry": {
      label: "Geometria analítica",
      image: "./formula-images/analytic-geometry.png",
      items: [
        {name:"Distància entre punts", formula:"d=√((x₂-x₁)²+(y₂-y₁)²)", explanation:"Pitàgores al pla.", parts:["x₂-x₁: diferència horitzontal.","y₂-y₁: diferència vertical."]},
        {name:"Punt mig", formula:"M=((x₁+x₂)/2,(y₁+y₂)/2)", explanation:"Mitjana de coordenades.", parts:["Punt central del segment."]},
        {name:"Pendent", formula:"m=(y₂-y₁)/(x₂-x₁)", explanation:"Inclinació de la recta.", parts:["Si x₂=x₁ és vertical."]},
        {name:"Recta explícita", formula:"y=mx+n", explanation:"Forma amb pendent i ordenada.", parts:["m: pendent.","n: tall amb y."]},
        {name:"Recta punt-pendent", formula:"y-y₁=m(x-x₁)", explanation:"Amb un punt i la pendent.", parts:["Substitueix el punt conegut."]},
        {name:"Recta general", formula:"Ax+By+C=0", explanation:"Forma algebraica general.", parts:["Vector normal: (A,B).","Vector director: (-B,A)."]},
        {name:"Recta vectorial", formula:"(x,y)=P+t·v", explanation:"Punt més múltiple d'un vector.", parts:["P és un punt.","v és vector director."]},
        {name:"Recta paramètrica", formula:"x=x₀+at; y=y₀+bt", explanation:"Separació de coordenades.", parts:["t és el paràmetre."]},
        {name:"Recta contínua", formula:"(x-x₀)/a=(y-y₀)/b", explanation:"Si a i b no són 0.", parts:["Equivalent a la paramètrica."]},
        {name:"Distància punt-recta", formula:"d=|Ax₀+By₀+C|/√(A²+B²)", explanation:"Recta en forma general.", parts:["Punt: (x₀,y₀).","Recta: Ax+By+C=0."]},
        {name:"Paral·lelisme", formula:"m₁=m₂", explanation:"Rectes amb la mateixa pendent.", parts:["En forma general: A₁B₂-A₂B₁=0."]},
        {name:"Perpendicularitat", formula:"m₁·m₂=-1", explanation:"Pendents inverses i oposades.", parts:["En vectors: producte escalar 0."]},
        {name:"Circumferència", formula:"(x-a)²+(y-b)²=r²", explanation:"Centre i radi.", parts:["Centre: (a,b).","Radi: r."]},
        {name:"Paràbola vertical", formula:"y=a(x-h)²+k", explanation:"Forma de vèrtex.", parts:["Vèrtex: (h,k).","Eix de simetria: x=h."]},
        {name:"El·lipse centrada", formula:"x²/a² + y²/b² = 1", explanation:"Cònica tancada.", parts:["a i b són semieixos."]},
        {name:"Hipèrbola centrada", formula:"x²/a² - y²/b² = 1", explanation:"Cònica oberta.", parts:["Té dues branques."]}
      ]
    },
    calculus: {
      label: "Límits, derivades i integrals",
      image: "./formula-images/calculus.png",
      items: [
        {name:"Límit intuïtiu", formula:"lim[x→a] f(x)=L", explanation:"f(x) s'apropa a L quan x s'apropa a a.", parts:["No cal que f(a) existeixi.","Importa el comportament al voltant de a."]},
        {name:"Límit de suma", formula:"lim(f+g)=lim f + lim g", explanation:"Regla algebraica de límits.", parts:["Sempre que els límits existeixin."]},
        {name:"Indeterminació 0/0", formula:"factoritza, simplifica o racionalitza", explanation:"Estratègies habituals.", parts:["No és resultat final.","Cal transformar l'expressió."]},
        {name:"Derivada definició", formula:"f'(x)=lim[h→0](f(x+h)-f(x))/h", explanation:"Pendent instantània.", parts:["h és un increment petit.","El límit dona la pendent."]},
        {name:"Potència", formula:"d(xⁿ)/dx = n x^(n-1)", explanation:"Regla bàsica de derivació.", parts:["n baixa multiplicant.","L'exponent disminueix en 1."]},
        {name:"Constant per funció", formula:"(k f)' = k f'", explanation:"La constant surt fora.", parts:["k no depèn de x."]},
        {name:"Suma", formula:"(f+g)'=f'+g'", explanation:"Derivem terme a terme.", parts:["També val per restes."]},
        {name:"Producte", formula:"(fg)'=f'g+fg'", explanation:"No és només producte de derivades.", parts:["Deriva el primer i deixa el segon.","Després deixa el primer i deriva el segon."]},
        {name:"Quocient", formula:"(f/g)'=(f'g-fg')/g²", explanation:"Per quocients de funcions.", parts:["g no pot ser 0."]},
        {name:"Cadena", formula:"(f(g(x)))'=f'(g(x))·g'(x)", explanation:"Deriva funcions compostes.", parts:["Derivada exterior per derivada interior."]},
        {name:"Derivades trigonomètriques", formula:"(sin x)'=cos x; (cos x)'=-sin x; (tan x)'=sec²x", explanation:"Bàsiques en radians.", parts:["Assumeix x en radians."]},
        {name:"Derivades exponencials", formula:"(e^x)'=e^x; (a^x)'=a^x ln a", explanation:"Exponencials.", parts:["a>0 i a≠1."]},
        {name:"Derivades logarítmiques", formula:"(ln x)'=1/x; (log_a x)'=1/(x ln a)", explanation:"Domini x>0.", parts:["Base a positiva i diferent d'1."]},
        {name:"Integral de potència", formula:"∫xⁿ dx = x^(n+1)/(n+1)+C", explanation:"Per n≠-1.", parts:["Suma 1 a l'exponent.","Divideix pel nou exponent."]},
        {name:"Integral 1/x", formula:"∫1/x dx = ln|x|+C", explanation:"Cas especial.", parts:["x no pot ser 0."]},
        {name:"Integrals trigonomètriques", formula:"∫sin x dx=-cos x+C; ∫cos x dx=sin x+C", explanation:"Antiderivades bàsiques.", parts:["Assumeix radians."]},
        {name:"Integral exponencial", formula:"∫e^x dx=e^x+C", explanation:"L'exponencial e^x es manté.", parts:["La derivada també és e^x."]},
        {name:"Integral definida", formula:"∫[a,b] f(x)dx = F(b)-F(a)", explanation:"Teorema fonamental del càlcul.", parts:["F és una primitiva de f.","Dona àrea signada."]}
      ]
    },
    sequences: {
      label: "Successions i progressions",
      image: "./formula-images/sequences.png",
      items: [
        {name:"Successió", formula:"aₙ", explanation:"Llista ordenada de nombres.", parts:["n indica la posició.","aₙ és el terme general."]},
        {name:"Aritmètica terme general", formula:"aₙ=a₁+(n-1)d", explanation:"La diferència entre termes és constant.", parts:["a₁: primer terme.","d: diferència."]},
        {name:"Aritmètica suma", formula:"Sₙ=n(a₁+aₙ)/2", explanation:"Suma dels n primers termes.", parts:["n: nombre de termes.","aₙ: últim terme."]},
        {name:"Geomètrica terme general", formula:"aₙ=a₁·r^(n-1)", explanation:"La raó entre termes és constant.", parts:["r: raó.","a₁: primer terme."]},
        {name:"Geomètrica suma finita", formula:"Sₙ=a₁(1-rⁿ)/(1-r)", explanation:"Per r diferent d'1.", parts:["Si r=1, la suma és n·a₁."]},
        {name:"Geomètrica suma infinita", formula:"S∞=a₁/(1-r)", explanation:"Només si |r|<1.", parts:["La successió convergeix cap a 0."]},
        {name:"Interès compost", formula:"C_f=C_i(1+i)^t", explanation:"Creixement percentual acumulat.", parts:["i és taxa per període.","t és nombre de períodes."]},
        {name:"Recurrència aritmètica", formula:"aₙ=aₙ₋₁+d", explanation:"Cada terme depèn de l'anterior.", parts:["Cal conèixer el primer terme."]},
        {name:"Recurrència geomètrica", formula:"aₙ=r·aₙ₋₁", explanation:"Multipliquem per una raó constant.", parts:["r és la raó."]}
      ]
    },
    matrices: {
      label: "Matrius i sistemes",
      image: "./formula-images/matrices.png",
      items: [
        {name:"Suma de matrius", formula:"(A+B)ᵢⱼ=Aᵢⱼ+Bᵢⱼ", explanation:"Element a element.", parts:["Mateixes dimensions."]},
        {name:"Producte per escalar", formula:"(kA)ᵢⱼ=kAᵢⱼ", explanation:"Multiplica cada element.", parts:["k és un nombre."]},
        {name:"Producte de matrius", formula:"(AB)ᵢⱼ=Σ AᵢₖBₖⱼ", explanation:"Files per columnes.", parts:["Columnes d'A = files de B."]},
        {name:"Identitat", formula:"AI=IA=A", explanation:"Matriu neutra del producte.", parts:["Diagonal de 1.","Resta 0."]},
        {name:"Determinant 2×2", formula:"det[[a,b],[c,d]]=ad-bc", explanation:"Mesura si una matriu 2×2 és invertible.", parts:["Si det=0, no té inversa."]},
        {name:"Inversa 2×2", formula:"A⁻¹=(1/(ad-bc))[[d,-b],[-c,a]]", explanation:"Per matrius 2×2 invertibles.", parts:["Cal determinant no nul."]},
        {name:"Sistema matricial", formula:"AX=B", explanation:"Forma compacta d'un sistema lineal.", parts:["A: matriu de coeficients.","X: incògnites.","B: termes independents."]},
        {name:"Solució amb inversa", formula:"X=A⁻¹B", explanation:"Si A és invertible.", parts:["Només si det(A)≠0."]},
        {name:"Traça", formula:"tr(A)=a₁₁+a₂₂+...+aₙₙ", explanation:"Suma de la diagonal principal.", parts:["Només en matrius quadrades."]},
        {name:"Transposada", formula:"(Aᵀ)ᵢⱼ=Aⱼᵢ", explanation:"Intercanvia files i columnes.", parts:["Files passen a columnes."]}
      ]
    },
    "vectors-formulas": {
      label: "Vectors",
      image: "./formula-images/vectors-formulas.png",
      items: [
        {name:"Vector entre punts", formula:"AB=(x₂-x₁,y₂-y₁)", explanation:"Resta coordenades final menys inicial.", parts:["A és origen.","B és extrem."]},
        {name:"Mòdul 2D", formula:"|v|=√(x²+y²)", explanation:"Longitud del vector.", parts:["Pitàgores en el pla."]},
        {name:"Mòdul 3D", formula:"|v|=√(x²+y²+z²)", explanation:"Longitud a l'espai.", parts:["Extensió de Pitàgores."]},
        {name:"Suma de vectors", formula:"(a,b)+(c,d)=(a+c,b+d)", explanation:"Component a component.", parts:["Sumem coordenades homòlogues."]},
        {name:"Producte escalar", formula:"v·w=x₁x₂+y₁y₂+z₁z₂", explanation:"Dona un nombre.", parts:["Serveix per angles i perpendicularitat."]},
        {name:"Angle entre vectors", formula:"cosθ=(v·w)/(|v||w|)", explanation:"Calcula l'angle.", parts:["Cap vector pot ser nul."]},
        {name:"Perpendicularitat", formula:"v·w=0", explanation:"Vectors ortogonals.", parts:["Producte escalar zero."]},
        {name:"Producte vectorial", formula:"v×w", explanation:"Vector perpendicular als dos vectors.", parts:["Només en 3D."]},
        {name:"Recta vectorial", formula:"r: P+t·v", explanation:"Punt més vector director.", parts:["P és un punt.","v és vector director."]},
        {name:"Pla", formula:"A(x-x₀)+B(y-y₀)+C(z-z₀)=0", explanation:"Punt i vector normal.", parts:["(A,B,C) és normal al pla."]}
      ]
    },
    statistics: {
      label: "Estadística",
      image: "./formula-images/statistics.png",
      items: [
        {name:"Mitjana", formula:"x̄=Σxᵢ/n", explanation:"Valor central aritmètic.", parts:["Sumem totes les dades.","Dividim pel nombre de dades."]},
        {name:"Mediana", formula:"valor central de les dades ordenades", explanation:"Divideix la mostra en dues meitats.", parts:["Cal ordenar les dades."]},
        {name:"Moda", formula:"valor més freqüent", explanation:"Pot haver-hi més d'una moda.", parts:["Mira les freqüències."]},
        {name:"Rang", formula:"R=max-min", explanation:"Mesura dispersió bàsica.", parts:["Diferència entre màxim i mínim."]},
        {name:"Variància poblacional", formula:"σ²=Σ(xᵢ-μ)²/N", explanation:"Dispersió quadràtica mitjana.", parts:["μ és la mitjana poblacional."]},
        {name:"Desviació típica", formula:"σ=√σ²", explanation:"Arrel de la variància.", parts:["Té les mateixes unitats que les dades."]},
        {name:"Variància mostral", formula:"s²=Σ(xᵢ-x̄)²/(n-1)", explanation:"Estimador mostral.", parts:["Divideix per n-1."]},
        {name:"Coeficient de variació", formula:"CV=σ/x̄", explanation:"Dispersió relativa.", parts:["Útil per comparar conjunts amb escales diferents."]},
        {name:"Puntuació z", formula:"z=(x-μ)/σ", explanation:"Mesura quantes desviacions estàndard separen x de la mitjana.", parts:["z positiu: per sobre de la mitjana.","z negatiu: per sota."]},
        {name:"Freqüència relativa", formula:"fᵣ=fᵢ/n", explanation:"Proporció d'una categoria.", parts:["Sovint s'expressa en percentatge."]}
      ]
    },
    probability: {
      label: "Probabilitat",
      image: "./formula-images/probability.png",
      items: [
        {name:"Laplace", formula:"P(A)=casos favorables/casos possibles", explanation:"Quan tots els casos són equiprobables.", parts:["Compta casos favorables.","Compta casos totals."]},
        {name:"Complementari", formula:"P(Aᶜ)=1-P(A)", explanation:"Probabilitat que A no passi.", parts:["A i Aᶜ cobreixen tot l'espai."]},
        {name:"Unió", formula:"P(A∪B)=P(A)+P(B)-P(A∩B)", explanation:"Evita comptar dues vegades la intersecció.", parts:["A∩B és la part comuna."]},
        {name:"Esdeveniments incompatibles", formula:"P(A∩B)=0", explanation:"No poden passar alhora.", parts:["Aleshores P(A∪B)=P(A)+P(B)."]},
        {name:"Condicional", formula:"P(A|B)=P(A∩B)/P(B)", explanation:"Probabilitat d'A sabent B.", parts:["P(B) ha de ser positiva."]},
        {name:"Independència", formula:"P(A∩B)=P(A)P(B)", explanation:"Un esdeveniment no altera l'altre.", parts:["Equivalent a P(A|B)=P(A)."]},
        {name:"Probabilitat total", formula:"P(B)=Σ P(B|Aᵢ)P(Aᵢ)", explanation:"Quan Aᵢ formen una partició.", parts:["Casos separats i exhaustius."]},
        {name:"Bayes", formula:"P(A|B)=P(B|A)P(A)/P(B)", explanation:"Actualitza probabilitats amb evidència.", parts:["P(A): probabilitat prèvia.","P(A|B): probabilitat posterior."]},
        {name:"Binomial", formula:"P(X=k)=C(n,k)p^k(1-p)^(n-k)", explanation:"n assajos independents amb probabilitat p.", parts:["k èxits.","n-k fracassos."]},
        {name:"Esperança binomial", formula:"E(X)=np", explanation:"Valor esperat d'una binomial.", parts:["n: assajos.","p: probabilitat d'èxit."]}
      ]
    },
    combinatorics: {
      label: "Combinatòria",
      image: "./formula-images/combinatorics.png",
      items: [
        {name:"Factorial", formula:"n!=n(n-1)...1", explanation:"Producte dels enters positius fins a n.", parts:["0!=1."]},
        {name:"Principi multiplicatiu", formula:"m·n", explanation:"Si hi ha m opcions i després n opcions.", parts:["Multiplica les opcions de cada etapa."]},
        {name:"Variacions sense repetició", formula:"V(n,r)=n!/(n-r)!", explanation:"Ordre importa i no es repeteix.", parts:["Triem r elements de n."]},
        {name:"Variacions amb repetició", formula:"VR(n,r)=n^r", explanation:"Ordre importa i es pot repetir.", parts:["Cada posició té n opcions."]},
        {name:"Permutacions", formula:"P(n)=n!", explanation:"Ordenar tots els elements.", parts:["S'utilitzen tots els n elements."]},
        {name:"Permutacions amb repetició", formula:"P=n!/(a!b!c!...)", explanation:"Quan hi ha elements repetits.", parts:["Divideix pels factorials de les repeticions."]},
        {name:"Combinacions", formula:"C(n,r)=n!/[r!(n-r)!]", explanation:"Ordre no importa.", parts:["Triem grups de mida r."]},
        {name:"Combinacions amb repetició", formula:"CR(n,r)=C(n+r-1,r)", explanation:"Ordre no importa i es pot repetir.", parts:["Útil en repartiments."]},
        {name:"Binomi de Newton", formula:"(a+b)^n=Σ C(n,k)a^(n-k)b^k", explanation:"Generalitza els productes notables.", parts:["Coeficients combinatoris."]},
        {name:"Triangle de Pascal", formula:"C(n,k)=C(n-1,k-1)+C(n-1,k)", explanation:"Genera coeficients binomials.", parts:["Cada nombre és suma dels dos superiors."]}
      ]
    },
    "number-theory": {
      label: "Teoria de nombres",
      image: "./formula-images/number-theory.png",
      items: [
        {name:"Divisibilitat", formula:"a|b si b=ak", explanation:"a divideix b.", parts:["k és enter."]},
        {name:"Nombre primer", formula:"p només té divisors 1 i p", explanation:"Base de la factorització.", parts:["p>1."]},
        {name:"Factorització", formula:"n=p₁^a p₂^b ...", explanation:"Descomposició en primers.", parts:["És única excepte l'ordre."]},
        {name:"MCD", formula:"mcd(a,b)", explanation:"Màxim divisor comú.", parts:["Es pot trobar amb Euclides."]},
        {name:"mcm", formula:"mcm(a,b)=|ab|/mcd(a,b)", explanation:"Mínim comú múltiple.", parts:["Relacionat amb el MCD."]},
        {name:"Algorisme d'Euclides", formula:"mcd(a,b)=mcd(b,a mod b)", explanation:"Càlcul eficient del MCD.", parts:["Repetim fins que el residu sigui 0."]},
        {name:"Identitat de Bézout", formula:"ax+by=mcd(a,b)", explanation:"Combinació lineal del MCD.", parts:["x i y són enters."]},
        {name:"Congruència", formula:"a≡b (mod n) si n|(a-b)", explanation:"Mateix residu en dividir per n.", parts:["n és el mòdul."]},
        {name:"Invers modular", formula:"ax≡1 (mod n)", explanation:"Existeix si mcd(a,n)=1.", parts:["x és l'invers de a mòdul n."]},
        {name:"Petit teorema de Fermat", formula:"a^(p-1)≡1 (mod p)", explanation:"Si p és primer i p no divideix a.", parts:["Útil en aritmètica modular."]}
      ]
    },
    "complex-formulas": {
      label: "Nombres complexos",
      image: "./formula-images/complex-formulas.png",
      items: [
        {name:"Forma binòmica", formula:"z=a+bi", explanation:"a és part real i b part imaginària.", parts:["i²=-1."]},
        {name:"Conjugat", formula:"conj(z)=a-bi", explanation:"Canvia el signe de la part imaginària.", parts:["z·conj(z)=a²+b²."]},
        {name:"Mòdul", formula:"|z|=√(a²+b²)", explanation:"Distància a l'origen.", parts:["Pla complex."]},
        {name:"Argument", formula:"θ=atan2(b,a)", explanation:"Angle del vector complex.", parts:["Depèn del quadrant."]},
        {name:"Forma polar", formula:"z=r(cosθ+i sinθ)", explanation:"Radi i argument.", parts:["r=|z|."]},
        {name:"Forma exponencial", formula:"z=re^(iθ)", explanation:"Forma d'Euler.", parts:["e^(iθ)=cosθ+i sinθ."]},
        {name:"Producte polar", formula:"r₁r₂ cis(θ₁+θ₂)", explanation:"Multiplica mòduls i suma arguments.", parts:["cis θ=cosθ+i sinθ."]},
        {name:"Quocient polar", formula:"(r₁/r₂) cis(θ₁-θ₂)", explanation:"Divideix mòduls i resta arguments.", parts:["r₂ no pot ser 0."]},
        {name:"De Moivre", formula:"zⁿ=rⁿ(cos nθ+i sin nθ)", explanation:"Potències de complexos.", parts:["Multiplica l'argument per n."]},
        {name:"Arrels n-èsimes", formula:"z_k=r^(1/n) cis((θ+2πk)/n)", explanation:"Hi ha n arrels.", parts:["k=0,1,...,n-1."]}
      ]
    },
    "plane-geometry": {
      label: "Geometria plana",
      image: "./formula-images/plane-geometry.png",
      items: [
        {name:"Triangle equilàter", formula:"A=(√3/4)c²; h=(√3/2)c", explanation:"Tots els costats són iguals.", parts:["c: costat.","h: altura."]},
        {name:"Paral·lelogram", formula:"A=b·h", explanation:"Base per altura.", parts:["h és perpendicular a la base."]},
        {name:"Rombe", formula:"A=(D·d)/2", explanation:"Amb diagonals.", parts:["D: diagonal major.","d: diagonal menor."]},
        {name:"Trapezi", formula:"A=((B+b)h)/2", explanation:"Mitjana de bases per altura.", parts:["B i b: bases."]},
        {name:"Cercle", formula:"A=πr²; L=2πr", explanation:"Radi r.", parts:["L és la longitud de la circumferència."]},
        {name:"Sector", formula:"A=(θ/360)πr²", explanation:"Part proporcional del cercle.", parts:["θ en graus."]},
        {name:"Corona circular", formula:"A=π(R²-r²)", explanation:"Cercle gran menys cercle petit.", parts:["R exterior.","r interior."]},
        {name:"El·lipse", formula:"A=πab", explanation:"Producte dels semieixos per π.", parts:["a i b són semieixos."]}
      ]
    },
    "solid-geometry": {
      label: "Cossos geomètrics",
      image: "./formula-images/solid-geometry.png",
      items: [
        {name:"Prisma", formula:"V=A_base·h", explanation:"Volum general de qualsevol prisma.", parts:["A_base: àrea de la base.","h: altura."]},
        {name:"Piràmide", formula:"V=A_base·h/3", explanation:"Un terç del prisma equivalent.", parts:["Mateixa base i altura que el prisma."]},
        {name:"Cilindre", formula:"V=πr²h; S=2πr(r+h)", explanation:"Bases circulars.", parts:["r: radi.","h: altura."]},
        {name:"Con", formula:"V=πr²h/3", explanation:"Un terç del cilindre equivalent.", parts:["r: radi.","h: altura."]},
        {name:"Esfera", formula:"V=4πr³/3; S=4πr²", explanation:"Cos rodó.", parts:["r: radi."]},
        {name:"Tronc de con", formula:"V=(πh/3)(R²+Rr+r²)", explanation:"Con tallat per un pla paral·lel a la base.", parts:["R: radi major.","r: radi menor.","h: altura."]}
      ]
    },
    physics: {
      label: "Física",
      image: "./formula-images/physics.png",
      items: [
        {name:"MRU", formula:"v=Δx/Δt", explanation:"Velocitat constant.", parts:["Δx: desplaçament.","Δt: temps."]},
        {name:"MRUA", formula:"v=v₀+at; x=x₀+v₀t+½at²", explanation:"Acceleració constant.", parts:["v₀: velocitat inicial.","a: acceleració."]},
        {name:"Newton", formula:"F=ma", explanation:"Força resultant.", parts:["m: massa.","a: acceleració."]},
        {name:"Energia", formula:"Ec=½mv²; Ep=mgh", explanation:"Energia cinètica i potencial.", parts:["v: velocitat.","h: altura."]},
        {name:"Ohm", formula:"V=IR", explanation:"Circuit elèctric bàsic.", parts:["V: tensió.","I: intensitat.","R: resistència."]},
        {name:"Gas ideal", formula:"PV=nRT", explanation:"Gasos.", parts:["T en kelvin."]}
      ]
    },
    chemistry: {
      label: "Química",
      image: "./formula-images/chemistry.png",
      items: [
        {name:"Mols", formula:"n=m/M", explanation:"Massa i massa molar.", parts:["m: massa.","M: massa molar."]},
        {name:"Partícules", formula:"N=n·NA", explanation:"Mols a partícules.", parts:["NA: Avogadro."]},
        {name:"Molaritat", formula:"C=n/V", explanation:"Concentració.", parts:["V en litres."]},
        {name:"Dilució", formula:"C₁V₁=C₂V₂", explanation:"Conservació de solut.", parts:["Inicial i final."]},
        {name:"pH", formula:"pH=-log[H⁺]", explanation:"Acidesa.", parts:["[H⁺] en mol/L."]},
        {name:"Gas ideal", formula:"PV=nRT", explanation:"Gasos en química.", parts:["R depèn de les unitats."]}
      ]
    }
  };

  function ensureFormulaCategoriesV25(){
    const select = $("formula-category");
    if(!select) return;
    select.innerHTML = `
      <option value="algebra">Àlgebra</option>
      <option value="functions">Funcions</option>
      <option value="trigonometry">Trigonometria</option>
      <option value="equations">Equacions i inequacions</option>
      <option value="analytic-geometry">Geometria analítica</option>
      <option value="calculus">Límits, derivades i integrals</option>
      <option value="sequences">Successions i progressions</option>
      <option value="matrices">Matrius i sistemes</option>
      <option value="vectors-formulas">Vectors</option>
      <option value="statistics">Estadística</option>
      <option value="probability">Probabilitat</option>
      <option value="combinatorics">Combinatòria</option>
      <option value="number-theory">Teoria de nombres</option>
      <option value="complex-formulas">Nombres complexos</option>
      <option value="plane-geometry">Geometria plana</option>
      <option value="solid-geometry">Cossos geomètrics</option>
      <option value="physics">Física</option>
      <option value="chemistry">Química</option>
    `;
  }

  function updateFormulaSelectV25(){
    const catKey = $("formula-category") ? $("formula-category").value : "algebra";
    const box = $("formula-select");
    const cat = formulaCatalogV25[catKey];
    if(!box || !cat) return;
    box.innerHTML = cat.items.map((item, i) => `<option value="${i}">${item.name}</option>`).join("");
  }

  function renderFormulaV25(){
    const catKey = $("formula-category").value;
    const idx = Number($("formula-select").value || 0);
    const cat = formulaCatalogV25[catKey];
    if(!cat) throw new Error("Bloc de fórmules no disponible.");
    const item = cat.items[idx];
    const extra = `
      <img class="formula-illustration" src="${cat.image}" alt="Esquema de ${cat.label}" />
      <div class="formula-parts">
        <strong>Components clau</strong>
        <ul>${item.parts.map(part => `<li>${part}</li>`).join("")}</ul>
      </div>
    `;
    safeRender({
      title: `${cat.label}: ${item.name}`,
      summary: `<span class="math">${item.formula}</span>`,
      extra,
      steps: [
        item.explanation,
        "Abans de substituir nombres, identifica cada símbol i comprova el domini o les condicions d'ús de la fórmula."
      ]
    });
  }

  ensureFormulaCategoriesV25();
  updateFormulaSelectV25();

  if($("formula-category")){
    $("formula-category").addEventListener("change", function(event){
      event.stopImmediatePropagation();
      updateFormulaSelectV25();
    }, true);
    $("formula-category").onchange = updateFormulaSelectV25;
  }

  if($("formulas-form")){
    $("formulas-form").addEventListener("submit", function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      try{
        renderFormulaV25();
      }catch(err){
        safeError("No s'ha pogut mostrar la fórmula.", err.message);
      }
    }, true);
  }
})();
