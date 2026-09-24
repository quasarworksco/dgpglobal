const SCRIPT_URL='https://script.google.com/macros/s/AKfycbypY5TPcjUePxLwplMjyz7lLTAwxF6zDOXR3ub3CVrzraNBi3FViAlIcvxOMgqNy3F6jA/exec';
const CSV_URL='https://docs.google.com/spreadsheets/d/e/2PACX-1vTPpmwX4hdgbUsrtTk9_-jDaWpqjB-ixIrHfPqDj5y0HqvJ-fEdbj-0B78jgxQ3lXRji9Z9teaRl9O6/pub?output=csv';
let lang='es', curr='usd', rate=0.90;

/* LIVE RATE */
async function getRate(){
  try{const r=await fetch('https://api.exchangerate-api.com/v4/latest/USD');const d=await r.json();if(d?.rates?.EUR)rate=d.rates.EUR;}catch(e){}
  updateEur();
}
function updateEur(){document.querySelectorAll('.ea').forEach(el=>{el.textContent=Math.round(parseFloat(el.dataset.v)*rate);})}

/* LOADER */
const phrases={
  es:['Transformamos marcas en movimientos.','Tu negocio, nuestra pasión.','Diseño que convierte visitantes.','Resultados medibles, siempre.'],
  en:['We transform brands into movements.','Your business, our passion.','Design that converts visitors.','Measurable results, always.']
};
let loaderStarted=false;
function runLoader(){
  if(loaderStarted)return;loaderStarted=true;
  const loader=document.getElementById('loader');
  if(!loader)return;
  let seen=false;
  try{seen=sessionStorage.getItem('dgpLoaderSeen')==='1';sessionStorage.setItem('dgpLoaderSeen','1');}catch(e){}
  if(seen){loader.classList.add('hidden');return;}
  const bar=document.getElementById('ldrBar');
  const ph=document.getElementById('ldrPhrase');
  let p=0,pi=0;
  function setP(i){const l=phrases[lang];ph.innerHTML=`<span class="on">${l[i%l.length]}</span>`}
  setP(0);
  const t=setInterval(()=>{
    p+=2.5;bar.style.width=p+'%';
    if(p%50===0&&p<100){pi++;setP(pi)}
    if(p>=100){clearInterval(t);setTimeout(()=>loader.classList.add('hidden'),150)}
  },20);
}
// Arrancar loader inmediatamente al cargar el DOM, sin esperar recursos externos
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',runLoader);
else runLoader();

/* LANG */
function setLang(l){
  const prev=lang;
  lang=l;
  try{localStorage.setItem('dgpLang',l);}catch(e){}
  document.body.classList.toggle('en',l==='en');
  document.documentElement.lang=l==='en'?'en':'es';
  document.querySelectorAll('[data-ph-'+l+']').forEach(el=>el.placeholder=el.getAttribute('data-ph-'+l));
  const wa=document.getElementById('wa-msg-text');
  if(wa&&wa.value.trim()===(wa.getAttribute('data-msg-'+prev)||'').trim())wa.value=wa.getAttribute('data-msg-'+l);
  updateServiceSelect(l);
  if(document.getElementById('pc-tags'))renderPortTags();
  syncBtns();
}
function updateServiceSelect(l){
  document.querySelectorAll('select').forEach(sel=>{
    const opts=Array.from(sel.options);
    if(!opts.some(o=>o.classList.contains('opt-en')||o.classList.contains('opt-es')))return;
    opts.forEach(o=>{
      const isEn=o.classList.contains('opt-en');
      const isEs=o.classList.contains('opt-es');
      o.hidden=(l==='en'&&isEs)||(l==='es'&&isEn);
    });
    const ph=opts.find(o=>o.value===''&&!o.hidden);
    if(ph)ph.selected=true;else sel.value='';
  });
}
/* CURRENCY */
function setCurr(c){
  curr=c;
  document.body.classList.toggle('eur',c==='eur');
  if(c==='eur')updateEur();
  syncBtns();
}
function syncBtns(){
  document.querySelectorAll('.ctrl-btn').forEach(b=>{
    const t=b.textContent.trim();
    b.classList.toggle('active',t===lang.toUpperCase()||t===curr.toUpperCase());
  });
}

/* REVEAL */
const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.07});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

/* REVIEWS */
function ini(n){return n.trim().split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?'}
function sts(n){return'★'.repeat(n)+'☆'.repeat(5-n)}
async function loadRevs(){
  const c=document.getElementById('revContainer'),cnt=document.getElementById('revCount');
  if(!c||!cnt)return;
  try{
    const txt=await(await fetch(CSV_URL)).text();
    const rows=txt.split('\n').slice(1).filter(r=>r.trim());
    c.innerHTML='';
    if(!rows.length){cnt.textContent='0';c.innerHTML=`<div class="empty-state"><i class="fa-regular fa-star"></i><p>${lang==='es'?'Aún no hay reseñas.':'No reviews yet.'}</p></div>`;return}
    cnt.textContent=rows.length+(lang==='es'?' reseña'+(rows.length>1?'s':''):(rows.length>1?' reviews':' review'));
    [...rows].reverse().forEach((row,i)=>{
      const cols=row.split(',');if(cols.length<5)return;
      const n=(cols[1]||'').replace(/"/g,'').trim(),v=parseInt(cols[3])||0,t=(cols[4]||'').replace(/"/g,'').trim();
      if(!n||!t)return;
      const d=document.createElement('div');d.className='rev-item';d.style.animationDelay=`${i*.06}s`;
      d.innerHTML=`<div class="rev-top"><div class="rev-avatar">${ini(n)}</div><div><div class="rev-name">${n}</div><div class="rev-stars">${sts(v)}</div></div></div><p class="rev-text">${t}</p>`;
      c.appendChild(d);
    });
  }catch(e){cnt.textContent='—';c.innerHTML=`<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${lang==='es'?'Error al cargar.':'Error loading.'}</p></div>`}
}
document.getElementById('reviewForm')?.addEventListener('submit',function(e){
  e.preventDefault();
  const n=document.getElementById('nombre').value.trim(),em=document.getElementById('correo').value.trim();
  const si=document.querySelector('input[name="stars"]:checked'),com=document.getElementById('comentario').value.trim();
  const btn=document.getElementById('submitBtn'),st=document.getElementById('statusMsg');
  if(!n||!em||!si||!com){st.className='status err';st.textContent=lang==='es'?'Por favor completa todos los campos.':'Please complete all fields.';return}
  btn.disabled=true;btn.querySelector('span').textContent=lang==='es'?'ENVIANDO...':'SENDING...';st.className='status';
  fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',body:JSON.stringify({nombre:n,correo:em,valoracion:si.value,comentario:com})})
  .then(()=>{
    st.className='status ok';st.textContent=lang==='es'?'✓ ¡Gracias! Reseña registrada.':'✓ Thank you! Review submitted.';
    this.reset();btn.disabled=false;btn.querySelector('span').textContent=lang==='es'?'ENVIAR RESEÑA':'SEND REVIEW';
    setTimeout(loadRevs,2500);
  }).catch(()=>{st.className='status err';st.textContent=lang==='es'?'Error. Intenta de nuevo.':'Error. Try again.';btn.disabled=false;btn.querySelector('span').textContent=lang==='es'?'ENVIAR RESEÑA':'SEND REVIEW'});
});
/* DRAWER */
function toggleDrawer(){
  const d=document.getElementById('navDrawer'),o=document.getElementById('drawerOverlay'),h=document.getElementById('hamburger');
  const isOpen=d.classList.contains('open');
  d.classList.toggle('open',!isOpen);
  o.classList.toggle('open',!isOpen);
  h.classList.toggle('open',!isOpen);
  document.body.style.overflow=isOpen?'':'hidden';
}
function closeDrawer(){
  document.getElementById('navDrawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('hamburger').classList.remove('open');
  document.body.style.overflow='';
}
/* ECOM COLLAPSIBLE */
function toggleEcom(btn){
  const icon=btn.querySelector('.ecom-collapse-icon');
  const panel=btn.nextElementSibling;
  const isOpen=panel.classList.contains('open');
  panel.classList.toggle('open',!isOpen);
  icon.classList.toggle('open',!isOpen);
  btn.querySelector('[data-es]').textContent=isOpen?'Ver qué incluye':'Ocultar detalles';
  btn.querySelector('[data-en]').textContent=isOpen?'See what\'s included':'Hide details';
}

/* WA FLOAT */
function toggleWAPopup(){
  const p=document.getElementById('wa-popup');
  p.classList.toggle('open');
}
function sendWAFloat(){
  const msg=document.getElementById('wa-msg-text').value.trim();
  if(!msg)return;
  window.open('https://wa.me/12398231738?text='+encodeURIComponent(msg),'_blank');
  document.getElementById('wa-popup').classList.remove('open');
}
document.addEventListener('click',e=>{
  const f=document.getElementById('wa-float');
  if(f&&!f.contains(e.target))document.getElementById('wa-popup').classList.remove('open');
});
/* CONTACT MODAL */
function openContactModal(){
  document.getElementById('contactModal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeContactModal(){
  document.getElementById('contactModal').classList.remove('open');
  document.body.style.overflow='';
}
function sendContactWA(){
  const name=(document.getElementById('mc-name').value||'').trim();
  const svc=document.getElementById('mc-service').value||'';
  const msg=(document.getElementById('mc-msg').value||'').trim();
  if(!name){document.getElementById('mc-name').focus();return;}
  let txt=`Hola DGP Group! 👋\n\n*Nombre:* ${name}`;
  if(svc) txt+=`\n*Servicio de interés:* ${svc}`;
  if(msg) txt+=`\n*Mensaje:* ${msg}`;
  txt+='\n\nMe gustaría recibir más información.';
  window.open(`https://wa.me/12398231738?text=${encodeURIComponent(txt)}`,'_blank');
  closeContactModal();
}
function sendContactEmail(){
  const name=(document.getElementById('mc-name').value||'').trim();
  const svc=document.getElementById('mc-service').value||'';
  const msg=(document.getElementById('mc-msg').value||'').trim();
  if(!name){document.getElementById('mc-name').focus();return;}
  const subject=svc?`Consulta: ${svc}`:'Consulta desde dgpglobalgroup.com';
  let body=`Hola DGP Global Group,\n\nNombre: ${name}`;
  if(svc) body+=`\nServicio de interés: ${svc}`;
  if(msg) body+=`\nMensaje: ${msg}`;
  body+='\n\nQuedo en espera de su respuesta.';
  window.location.href=`mailto:dgpgroup.usa@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  closeContactModal();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeContactModal();closeHeroForm();}});

/* HERO FORM (Formspree) */
function openHeroForm(){
  const m=document.getElementById('heroFormModal');
  m.style.display='flex';
  document.body.style.overflow='hidden';
}
function closeHeroForm(){
  const m=document.getElementById('heroFormModal');
  m.style.display='none';
  document.body.style.overflow='';
}
document.getElementById('heroFormModal').addEventListener('click',function(e){if(e.target===this)closeHeroForm();});
document.getElementById('heroFormFs').addEventListener('submit',async function(e){
  e.preventDefault();
  const btn=document.getElementById('hfSubmitBtn');
  const status=document.getElementById('hfStatus');
  const isEn=lang==='en';
  if(!document.getElementById('hf-name').value.trim()||!document.getElementById('hf-email').value.trim()){
    status.className='status err';status.style.display='block';
    status.textContent=isEn?'Please fill in your name and email.':'Por favor completa tu nombre y correo.';
    return;
  }
  btn.disabled=true;
  btn.querySelector('span[data-es]').textContent=isEn?'Sending...':'Enviando...';
  try{
    const res=await fetch(this.action,{method:'POST',body:new FormData(this),headers:{Accept:'application/json'}});
    if(res.ok){
      status.className='status ok';status.style.display='block';
      status.textContent=isEn?'Message sent! We\'ll reply within 24 hours.':'¡Mensaje enviado! Te respondemos en menos de 24 horas.';
      this.reset();
      setTimeout(closeHeroForm,3000);
    } else {
      throw new Error();
    }
  }catch{
    status.className='status err';status.style.display='block';
    status.textContent=isEn?'Error sending. Please try WhatsApp.':'Error al enviar. Intenta por WhatsApp.';
    btn.disabled=false;
  }
});

/* MAIN CONTACT FORM (Formspree) */
const mainForm=document.getElementById('mainContactForm');
if(mainForm){
  mainForm.addEventListener('submit',async function(e){
    e.preventDefault();
    const btn=document.getElementById('mainSubmitBtn');
    const status=document.getElementById('mainContactStatus');
    const isEn=lang==='en';
    btn.disabled=true;
    try{
      const res=await fetch(this.action,{method:'POST',body:new FormData(this),headers:{Accept:'application/json'}});
      if(res.ok){
        status.className='status ok';status.style.display='block';
        status.textContent=isEn?'Message sent! We\'ll reply within 24 hours.':'¡Mensaje enviado! Te respondemos en menos de 24 horas.';
        this.reset();
      } else {throw new Error();}
    }catch{
      status.className='status err';status.style.display='block';
      status.textContent=isEn?'Error sending. Please try WhatsApp.':'Error al enviar. Intenta por WhatsApp.';
      btn.disabled=false;
    }
  });
}

/* SCROLL TO CONTACT */
/* ── QUOTE CALCULATOR ── */
const QUOTE_DATA={
  web:[
    {name_es:'Plan Básico',name_en:'Basic Plan',desc_es:'Landing Page + QR Code',desc_en:'Landing Page + QR Code',price:'$280',delivery_es:'Entrega en 24–48h',delivery_en:'Delivered in 24–48h',items_es:['Landing Page profesional','Código QR a tu sitio','Diseño responsive'],items_en:['Professional landing page','QR Code to your site','Responsive design'],wa:'Plan Básico de Sitio Web'},
    {name_es:'Plan Estándar',name_en:'Standard Plan',desc_es:'Hasta 5 páginas + Hosting 6 meses',desc_en:'Up to 5 pages + 6-month hosting',price:'$455',delivery_es:'Entrega en 2–3 días',delivery_en:'Delivered in 2–3 days',items_es:['Sitio multi-página (hasta 5)','Botón de WhatsApp','Formulario de contacto','Mantenimiento 6 meses'],items_en:['Multi-page site (up to 5)','WhatsApp button','Contact form','6-month maintenance'],wa:'Plan Estándar de Sitio Web'},
    {name_es:'Plan Premium',name_en:'Premium Plan',desc_es:'Catálogo/Reservas + Hosting 12 meses',desc_en:'Catalog/Bookings + 12-month hosting',price:'$950',delivery_es:'Entrega en 4–5 días',delivery_en:'Delivered in 4–5 days',items_es:['Sitio completo con catálogo','Kit Social Premium','SEO Optimizado + Analytics','Mantenimiento 12 meses'],items_en:['Full site with catalog','Premium Social Kit','SEO + Analytics','12-month maintenance'],wa:'Plan Premium de Sitio Web'},
  ],
  pack:[
    {name_es:'Paquete Básico',name_en:'Basic Package',desc_es:'Logo + Redes Sociales',desc_en:'Logo + Social Media',price:'$124',delivery_es:'Entrega en 48h',delivery_en:'Delivered in 48h',items_es:['Logo profesional','Creación de RRSS','Bio + Highlights','Tarjeta de presentación'],items_en:['Professional logo','Social media setup','Bio + Highlights','Business card'],wa:'Paquete Básico Profesional'},
    {name_es:'Paquete Intermedio',name_en:'Intermediate Package',desc_es:'Logo + 2K seguidores + 5 posts',desc_en:'Logo + 2K followers + 5 posts',price:'$221',delivery_es:'Entrega en 3–4 días',delivery_en:'Delivered in 3–4 days',items_es:['Todo el Básico','2,000 seguidores','5 posts diseñados','Tarjeta de presentación'],items_en:['Everything in Basic','2,000 followers','5 designed posts','Business card'],wa:'Paquete Intermedio Profesional'},
    {name_es:'Paquete Avanzado',name_en:'Advanced Package',desc_es:'Paquete completo + Web One Page',desc_en:'Full package + One Page website',price:'$553',delivery_es:'Entrega en 5–7 días',delivery_en:'Delivered in 5–7 days',items_es:['Factura + Tarjeta de negocio','5,000 seguidores + 10 posts','Web One Page','Tarjeta de presentación'],items_en:['Invoice + Business card','5,000 followers + 10 posts','One Page website','Business card'],wa:'Paquete Avanzado Profesional'},
  ],
  ecom:[
    {name_es:'Gestión Multi-Plataforma',name_en:'Multi-Platform Management',desc_es:'Amazon, Walmart, TikTok, Shopify, eBay',desc_en:'Amazon, Walmart, TikTok, Shopify, eBay',price:'$750',delivery_es:'Pago único — sin mensualidad',delivery_en:'One-time payment — no monthly fee',items_es:['Apertura y onboarding en plataformas','Optimización de listings','Estrategia de precios','Asesoría PPC','Gestión de requisitos legales/FDA'],items_en:['Platform opening & onboarding','Listing optimization','Pricing strategy','PPC advisory','Legal/FDA requirement management'],wa:'Plan de Gestión E-Commerce'},
  ],
  sys:[
    {name_es:'Sistema a Medida',name_en:'Custom System',desc_es:'Panel admin, facturación, app web...',desc_en:'Admin panel, billing, web app...',price:'A consultar',delivery_es:'Plazo según proyecto',delivery_en:'Timeline per project',items_es:['Análisis de requerimientos','Diseño de solución','Desarrollo personalizado','Soporte post-entrega'],items_en:['Requirements analysis','Solution design','Custom development','Post-delivery support'],wa:'Sistema Personalizado'},
  ]
};
let qCat='';
function openQuote(){document.getElementById('quote-modal').classList.add('show');goStep(1);}
function closeQuote(){document.getElementById('quote-modal').classList.remove('show');}
function clearQuote(){document.querySelectorAll('.quote-opt').forEach(o=>o.classList.remove('selected'));}
function goStep(n){document.querySelectorAll('.quote-step').forEach((s,i)=>s.classList.toggle('active',i===n-1));}
function selectCat(cat){
  qCat=cat;
  const isEn=lang==='en';
  const opts=QUOTE_DATA[cat];
  const container=document.getElementById('qoptions2');
  container.innerHTML=opts.map((o,i)=>`
    <button class="quote-opt" onclick="selectPlan(${i})">
      <div class="quote-opt-name">${isEn?o.name_en:o.name_es}</div>
      <div class="quote-opt-desc">${isEn?o.desc_en:o.desc_es}</div>
    </button>`).join('');
  goStep(2);
}
function selectPlan(i){
  const isEn=lang==='en';
  const o=QUOTE_DATA[qCat][i];
  document.getElementById('q-price').textContent=o.price;
  document.getElementById('q-delivery').textContent=isEn?o.delivery_en:o.delivery_es;
  const items=isEn?o.items_en:o.items_es;
  document.getElementById('q-items').innerHTML=items.map(it=>`<div class="quote-result-item"><i class="fa-solid fa-check"></i>${it}</div>`).join('');
  document.getElementById('q-wa').href=`https://wa.me/12398231738?text=Hola%20DGP%20Global%20Group!%20Usé%20el%20cotizador%20y%20me%20interesa%20el%20${encodeURIComponent(o.wa)}.%20¿Podemos%20hablar?`;
  goStep(3);
}

/* ── SHARE LINK ── */
function copyShareLink(btn){
  navigator.clipboard.writeText('https://dgpglobalgroup.com'+location.pathname).then(()=>{
    const icon=btn.querySelector('i');
    icon.className='fa-solid fa-check';
    btn.style.background='var(--black)';btn.style.color='#fff';btn.style.borderColor='var(--black)';
    setTimeout(()=>{icon.className='fa-solid fa-link';btn.style.background='';btn.style.color='';btn.style.borderColor='';},2000);
  });
}

/* ── URGENCY BAR ── */
(function(){
  const week=Math.floor(Date.now()/604800000);
  const spots=[2,3,4,5,3,2,5,4][week%8];
  const el=document.getElementById('urgency-num');
  if(el)el.textContent=spots;
})();

/* ── COUNT-UP ANIMATION ── */
function animateCount(el){
  const target=+el.dataset.target;
  const dur=1800;
  const step=dur/60;
  let cur=0;
  const inc=target/60;
  const timer=setInterval(()=>{
    cur=Math.min(cur+inc,target);
    el.textContent=Math.floor(cur);
    if(cur>=target)clearInterval(timer);
  },step);
}
const countObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting){animateCount(e.target);countObs.unobserve(e.target);}});
},{threshold:.5});
document.querySelectorAll('.count-up').forEach(el=>countObs.observe(el));

/* ── EXIT INTENT POPUP ── */
let exitShown=sessionStorage.getItem('exitShown');
function closeExitPopup(){document.getElementById('exit-popup').classList.remove('show');sessionStorage.setItem('exitShown','1');}
if(!exitShown){
  document.addEventListener('mouseleave',function handler(e){
    if(e.clientY<10){
      document.getElementById('exit-popup').classList.add('show');
      document.removeEventListener('mouseleave',handler);
    }
  });
  setTimeout(()=>{
    if(!sessionStorage.getItem('exitShown'))document.addEventListener('mouseleave',function h(e){if(e.clientY<10){document.getElementById('exit-popup').classList.add('show');document.removeEventListener('mouseleave',h);}});
  },8000);
}
document.getElementById('exit-popup').addEventListener('click',function(e){if(e.target===this)closeExitPopup();});

/* ── ALTAIR PROACTIVO ── */
setTimeout(()=>{
  let done=false;
  try{done=sessionStorage.getItem('altairProactive')==='1';sessionStorage.setItem('altairProactive','1');}catch(e){}
  if(!done&&!altairGreeted&&!altairOpen){
    openAltair();
    const isEn=lang==='en';
    setTimeout(()=>{
      addAltairMsg(isEn
        ?"👋 Hi! Need help choosing a service or getting a quote? I'm here to help!"
        :"👋 ¡Hola! ¿Necesitas ayuda para elegir un servicio o recibir una cotización? ¡Estoy aquí!"
      ,'bot');
    },600);
  }
},20000);

function toggleReviews(btn){
  const col=document.getElementById('revCollapsible');
  const chev=btn.querySelector('.panel-chevron');
  col.classList.toggle('open');
  chev.classList.toggle('open');
}
function scrollToContact(){
  const c=document.getElementById('contacto');
  if(c)c.scrollIntoView({behavior:'smooth',block:'start'});
  else location.href='/#contacto';
}

/* ALTAIR AI CHAT */
const GROQ_KEY=['gsk_RJ9YaWKP','q9Gupqq58t8J','WGdyb3FYaxm4','fyaO3GaAGFb5kmSSFRKU'].join('');
const ALTAIR_MODEL='llama-3.3-70b-versatile';
const ALTAIR_SYSTEM=`You are Altair, a professional digital marketing and web design advisor for DGP Global Group, a bilingual digital marketing agency based in Florida, USA.

PERSONALITY: Formal yet warm and approachable. Knowledgeable and confident. Customer-oriented. Keep responses concise (3-5 sentences max). Never use bullet points or markdown — write in natural paragraphs.

LANGUAGE RULE: Always respond in the EXACT same language the user writes in. If they write in Spanish → respond in Spanish. If in English → respond in English. Never mix.

SCOPE — You ONLY discuss topics related to:
- Digital marketing strategies and advertising
- Web design and development
- Graphic design and branding
- Social media management and growth
- E-commerce and online stores
- Entrepreneurship and business growth
- DGP Global Group services and pricing

If asked anything outside this scope, politely say you specialize in digital marketing and business topics, and redirect to how you can help.

DGP GLOBAL GROUP SERVICES & PRICING:
WEB DESIGN: Landing Page from $280 one-time (24-48h delivery) | Standard Site up to 5 pages from $455 one-time | Premium Site with catalog or bookings from $950 one-time.
GRAPHIC DESIGN: Logo & Visual Identity from $111 | Business Card from $26 | Social Media Posts/Flyers from $15 each.
PACKAGES: Basic (logo + social setup) from $124 | Intermediate (logo + followers + posts) from $221 | Advanced (full package + website) from $553.
E-COMMERCE: Multi-platform management (Amazon, Walmart, TikTok Shop, Shopify, eBay) from $750 — ONE-TIME payment, not monthly.
CUSTOM SYSTEMS: CRM, admin panels, inventory, custom software — custom quote.
CONTACT: WhatsApp +1 (239) 823-1738 | Email dgpgroup.usa@gmail.com | Website dgpglobalgroup.com | Instagram @dgpgroup.us

GUIDELINES:
1. Always end with a question or call to action that moves toward a consultation or quote.
2. When mentioning prices, ALWAYS say "starting from $X" or "desde $X" — never use "for only" or "por solo". Prices are starting points, not fixed amounts.
3. Give real, valuable advice — educate first, then guide toward the service.
4. Never invent services or prices not listed above.
5. If someone seems interested, suggest contacting via WhatsApp or the contact form on the site.
6. The e-commerce plan is a ONE-TIME payment, never describe it as monthly or recurring.`;

let altairHistory=[];
let altairOpen=false;
let altairGreeted=false;
let altairTgSent=0;
function saveAltair(){
  try{sessionStorage.setItem('altairState',JSON.stringify({h:altairHistory,s:altairTgSent,g:altairGreeted}));}catch(e){}
}
function restoreAltair(){
  try{
    const st=JSON.parse(sessionStorage.getItem('altairState')||'null');
    if(!st)return;
    altairHistory=st.h||[];altairTgSent=st.s||0;altairGreeted=!!st.g;
    altairHistory.forEach(m=>addAltairMsg(m.content,m.role==='user'?'user':'bot'));
  }catch(e){}
}

const TG_TOKEN=['8835050265:AAH','KbQzn1sGT','KqwZKayOan','GdH98N9xHekHc'].join('');
const TG_CHAT='8446165096';

async function tgSend(text){
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:TG_CHAT,text,parse_mode:'HTML'})
  });
}
async function sendAltairTelegram(closing=false){
  const userMsgs=altairHistory.filter(m=>m.role==='user');
  if(userMsgs.length===0)return;
  const unsent=altairHistory.slice(altairTgSent);
  if(unsent.length===0)return;
  const now=new Date().toLocaleString('es-US',{timeZone:'America/New_York',dateStyle:'short',timeStyle:'short'});
  const header=`🤖 <b>Altair — Conversación activa</b>\n📅 ${now}\n\n`;
  const footer=(closing?`🔚 <i>Conversación cerrada</i>\n`:'')+`🌐 dgpglobalgroup.com`;
  let chunks=[header];
  unsent.forEach(m=>{
    const line=m.role==='user'
      ?`👤 <b>Cliente:</b> ${m.content}\n\n`
      :`🔵 <b>Altair:</b> ${m.content}\n\n`;
    const last=chunks[chunks.length-1];
    if((last+line).length>3800)chunks.push(line);
    else chunks[chunks.length-1]+=line;
  });
  chunks[chunks.length-1]+=footer;
  altairTgSent=altairHistory.length;
  saveAltair();
  try{for(const c of chunks)await tgSend(c);}catch{}
}

function toggleAltair(){altairOpen?closeAltair():openAltair();}
function openAltair(){
  altairOpen=true;
  document.getElementById('altair-chat').classList.add('open');
  if(!altairGreeted){
    altairGreeted=true;
    saveAltair();
    const isEn=lang==='en';
    addAltairMsg(isEn
      ?"Hi! I'm Altair, digital advisor at DGP Global Group. I'm here to help you with web design, digital marketing, branding, and business growth. How can I help you today?"
      :"¡Hola! Soy Altair, asesor digital de DGP Global Group. Estoy aquí para ayudarte con diseño web, marketing digital, branding y crecimiento de negocios. ¿En qué puedo ayudarte hoy?"
    ,'bot');
  }
  setTimeout(()=>document.getElementById('altair-input').focus(),300);
}
function closeAltair(){
  altairOpen=false;
  document.getElementById('altair-chat').classList.remove('open');
  sendAltairTelegram(true);
}
function addAltairMsg(text,role){
  const box=document.getElementById('altair-messages');
  const div=document.createElement('div');
  div.className=`altair-msg altair-msg-${role}`;
  div.textContent=text;
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
  return div;
}
function showAltairTyping(){
  const box=document.getElementById('altair-messages');
  const div=document.createElement('div');
  div.className='altair-typing';div.id='altair-typing';
  div.innerHTML='<span></span><span></span><span></span>';
  box.appendChild(div);box.scrollTop=box.scrollHeight;
}
function hideAltairTyping(){const t=document.getElementById('altair-typing');if(t)t.remove();}
async function altairSend(){
  const input=document.getElementById('altair-input');
  const text=input.value.trim();
  if(!text)return;
  input.value='';
  addAltairMsg(text,'user');
  altairHistory.push({role:'user',content:text});
  showAltairTyping();
  const btn=document.querySelector('.altair-send');
  if(btn)btn.disabled=true;
  try{
    const res=await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':`Bearer ${GROQ_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:ALTAIR_MODEL,
        messages:[{role:'system',content:ALTAIR_SYSTEM},...altairHistory],
        max_tokens:350,
        temperature:0.72
      })
    });
    const data=await res.json();
    hideAltairTyping();
    const reply=data.choices?.[0]?.message?.content||(lang==='en'?'Sorry, I had a technical issue. Please try again.':'Disculpa, tuve un problema técnico. Por favor intenta de nuevo.');
    addAltairMsg(reply,'bot');
    altairHistory.push({role:'assistant',content:reply});
    if(altairHistory.length>24){const cut=altairHistory.length-24;altairHistory=altairHistory.slice(cut);altairTgSent=Math.max(0,altairTgSent-cut);}
    saveAltair();
    if(altairHistory.filter(m=>m.role==='user').length===1)sendAltairTelegram();
  }catch{
    hideAltairTyping();
    addAltairMsg(lang==='en'?'Connection error. Please try again.':'Error de conexión. Intenta de nuevo.','bot');
  }finally{
    if(btn)btn.disabled=false;
  }
}

setTimeout(()=>{getRate();loadRevs();},1500);
window.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')sendAltairTelegram(true);});

/* PORTFOLIO CAROUSEL */
const PORT_P=window.PORT_DATA||[];
let portIdx=0;
function renderPortTags(){
  const p=PORT_P[portIdx],el=document.getElementById('pc-tags');
  if(!p||!el)return;
  el.innerHTML=(lang==='en'?p.tags_en:p.tags_es).map(t=>`<span class="pc-tag">${t}</span>`).join('');
}
function renderPort(idx,animate){
  portIdx=idx;
  const p=PORT_P[idx];
  const isEn=lang==='en';
  document.getElementById('pc-num').textContent=p.num+' / '+String(PORT_P.length).padStart(2,'0');
  if(animate){const cw=document.querySelector('.port-card-wrap');if(cw){cw.style.opacity='0';cw.style.transform='translateX(20px)';setTimeout(()=>{cw.style.transition='opacity .3s,transform .3s';cw.style.opacity='1';cw.style.transform='translateX(0)';},50);}}
  document.getElementById('pc-title').textContent=p.title;
  renderPortTags();
  const des=document.getElementById('pc-desc-es'),den=document.getElementById('pc-desc-en');
  if(des)des.textContent=p.desc_es;if(den)den.textContent=p.desc_en;
  document.getElementById('pc-url-text').textContent=p.url.replace(/^https?:\/\//,'').replace(/\/$/,'');
  document.getElementById('pc-link').href=p.url;
  document.querySelectorAll('.port-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  const img=document.getElementById('port-prev-img');
  const iframe=document.getElementById('port-prev-iframe');
  if(iframe){
    iframe.classList.add('fading');
    setTimeout(()=>{
      if(iframe._loaded){iframe.src=p.url;}else{iframe.dataset.src=p.url;}
      iframe.classList.remove('fading');
    },350);
  }
  portIdx=idx;
}
function portNav(dir){renderPort((portIdx+dir+PORT_P.length)%PORT_P.length,true);}
function scalePortFrame(){
  const screen=document.querySelector('.port-preview-screen');
  const iframe=document.getElementById('port-prev-iframe');
  if(!screen||!iframe)return;
  const scale=screen.offsetWidth/1280;
  iframe.style.transform=`scale(${scale})`;
}
(function initPort(){
  if(!document.getElementById('pc-title')||!PORT_P.length)return;
  const dots=document.getElementById('port-dots');
  if(dots)dots.innerHTML=PORT_P.map((_,i)=>`<span class="port-dot${i===0?' active':''}" onclick="renderPort(${i},true)"></span>`).join('');
  renderPort(0,false);
  scalePortFrame();
  window.addEventListener('resize',scalePortFrame);
  const iframe=document.getElementById('port-prev-iframe');
  const portSection=document.querySelector('.port-preview');
  if(iframe&&portSection){
    const portObs=new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){
        iframe.src=iframe.dataset.src||PORT_P[0].url;
        iframe._loaded=true;
        portObs.disconnect();
      }
    },{rootMargin:'200px'});
    portObs.observe(portSection);
  }
})();


/* CURSOR GLOW */
(function(){
  const g=document.createElement('div');g.className='cursor-glow';document.body.appendChild(g);
  document.addEventListener('mousemove',e=>{g.style.left=e.clientX+'px';g.style.top=e.clientY+'px'});
})();

/* STAT BOUNCE on hero enter */
(function(){
  const stats=document.querySelectorAll('.stat-num');
  const trig=document.querySelector('.hero-bottom');
  if(!trig)return;
  let done=false;
  const ob=new IntersectionObserver(en=>{
    if(en[0].isIntersecting&&!done){
      done=true;
      stats.forEach((s,i)=>{
        setTimeout(()=>{
          s.style.transition='transform .3s cubic-bezier(.34,1.56,.64,1)';
          s.style.transform='scale(1.18)';
          setTimeout(()=>{s.style.transform='scale(1)';},300);
        },i*120);
      });
    }
  },{threshold:.3});
  ob.observe(trig);
})();

/* SCROLL PROGRESS BAR */
(function(){
  const bar=document.getElementById('scroll-progress');
  let tick=false;
  window.addEventListener('scroll',()=>{
    if(tick)return;tick=true;
    requestAnimationFrame(()=>{
      const max=document.documentElement.scrollHeight-window.innerHeight;
      bar.style.width=(max>0?(window.scrollY/max)*100:0)+'%';
      tick=false;
    });
  },{passive:true});
})();

/* FREE AUDIT FORM (Formspree + Telegram) */
const auditForm=document.getElementById('auditForm');
if(auditForm){
  auditForm.addEventListener('submit',async function(e){
    e.preventDefault();
    const btn=document.getElementById('auditSubmitBtn');
    const status=document.getElementById('auditStatus');
    const isEn=lang==='en';
    const fd=new FormData(this);
    const name=(fd.get('name')||'').trim(),email=(fd.get('email')||'').trim(),wa=(fd.get('whatsapp')||'').trim(),site=(fd.get('website')||'').trim();
    if(!name||!email||!wa||!site){
      status.className='status err';
      status.textContent=isEn?'Please fill in your name, email, WhatsApp and website.':'Por favor completa tu nombre, correo, WhatsApp y sitio web.';
      return;
    }
    btn.disabled=true;
    try{
      const res=await fetch(this.action,{method:'POST',body:fd,headers:{Accept:'application/json'}});
      if(!res.ok)throw new Error();
      const esc=v=>String(v).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
      tgSend(`🔍 <b>Nueva solicitud de auditoría gratis</b>\n\n👤 ${esc(name)}\n📧 ${esc(email)}\n📱 ${esc(wa)}\n🌐 ${esc(site)}\n🎯 ${esc(fd.get('goal')||'—')}\n💬 ${esc(fd.get('message')||'—')}\n\n⏱ Prometido: informe en 24h`).catch(()=>{});
      status.className='status ok';
      status.textContent=isEn?'Done! We\'ll send your audit within 24 hours by email or WhatsApp.':'¡Listo! Te enviamos tu auditoría en menos de 24 horas por correo o WhatsApp.';
      this.reset();
    }catch{
      status.className='status err';
      status.textContent=isEn?'Error sending. Please try WhatsApp.':'Error al enviar. Intenta por WhatsApp.';
      btn.disabled=false;
    }
  });
}

/* Old one-page anchors now live on their own pages */
(function(){
  const moved={'#web':'/diseno-web/','#paquetes':'/paquetes/','#ecommerce':'/ecommerce/','#sistemas':'/sistemas/'};
  if(location.pathname==='/'&&moved[location.hash])location.replace(moved[location.hash]);
})();

/* INIT: saved language + Altair conversation */
(function(){
  let l=null;
  try{
    const q=new URLSearchParams(location.search).get('lang');
    l=(q==='en'||q==='es')?q:localStorage.getItem('dgpLang');
  }catch(e){}
  if(l==='en'||l==='es')setLang(l);
  restoreAltair();
})();
