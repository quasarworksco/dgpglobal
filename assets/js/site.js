const GREVIEW_URL='https://g.page/r/CbcyuFX7hqvuEAE/review';
const REV_API='https://ayudante-dgp-bot.dgpgroupusa-llc.workers.dev/resenas-web';
let lang=window.PAGE_LANG||'es', curr='usd', rate=0.90;

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
  if(!loader||loader.dataset.show!=='1')return;
  try{sessionStorage.setItem('dgpLoaderSeen','1');}catch(e){}
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

/* SPAM GUARD: hidden _gotcha field filled or form sent within 3s of load → drop silently */
const PAGE_T0=Date.now();
document.addEventListener('submit',function(e){
  const f=e.target,hp=f.querySelector&&f.querySelector('[name="_gotcha"]');
  if(!hp)return;
  if(hp.value||Date.now()-PAGE_T0<3000){
    e.preventDefault();e.stopImmediatePropagation();
    const st=f.querySelector('.status');
    if(st){st.className=st.className.replace(/\berr\b/,'')+' ok';st.style.display='block';st.textContent=lang==='en'?'✓ Sent.':'✓ Enviado.';}
    f.reset();
  }
},true);
/* REVIEWS */
function esc(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function ini(n){return n.trim().split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()||'?'}
function sts(n){return'★'.repeat(n)+'☆'.repeat(5-n)}
async function loadRevs(){
  const c=document.getElementById('revContainer'),cnt=document.getElementById('revCount');
  if(!c||!cnt)return;
  try{
    // Solo llegan las reseñas aprobadas desde el panel (más nuevas primero)
    const data=await(await fetch(REV_API)).json();
    const rows=(data.resenas||[]).filter(r=>r.nombre&&r.comentario);
    c.innerHTML='';
    if(!rows.length){cnt.textContent='0';c.innerHTML=`<div class="empty-state"><i class="fa-regular fa-star"></i><p>${lang==='es'?'Aún no hay reseñas.':'No reviews yet.'}</p></div>`;return}
    cnt.textContent=rows.length+(lang==='es'?' reseña'+(rows.length>1?'s':''):(rows.length>1?' reviews':' review'));
    rows.forEach((row,i)=>{
      const n=esc(String(row.nombre).trim()),v=Math.min(5,Math.max(0,parseInt(row.valoracion)||0)),t=esc(String(row.comentario).trim()).replace(/\n+/g,'<br>');
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
  fetch(REV_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nombre:n,correo:em,valoracion:si.value,comentario:com,idioma:lang,t:Date.now()-PAGE_T0})})
  .then(async r=>{
    if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'')}
    st.className='status ok';st.innerHTML=(lang==='es'?'✓ ¡Gracias! Recibimos tu reseña y aparecerá aquí en cuanto la revisemos.':'✓ Thank you! We received your review and it will appear here once we check it.')+' <a href="'+GREVIEW_URL+'" target="_blank" rel="noopener" class="status-greview"><i class="fa-brands fa-google"></i> '+(lang==='es'?'¿Nos ayudas publicándola también en Google? Solo toma 30 segundos.':'Could you also post it on Google? It only takes 30 seconds.')+'</a>';
    this.reset();btn.disabled=false;btn.querySelector('span').textContent=lang==='es'?'ENVIAR RESEÑA':'SEND REVIEW';
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
  let txt=`Hola DGP Global Group! 👋\n\n*Nombre:* ${name}`;
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

/* HERO FORM (al panel + Telegram) */
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
  btn.querySelector('span').textContent=isEn?'Sending...':'Enviando...';
  try{
    await enviarAlPanel(this,'Contacto (formulario rápido)');
    {
      status.className='status ok';status.style.display='block';
      status.textContent=isEn?'Message sent! We\'ll reply within 24 hours.':'¡Mensaje enviado! Te respondemos en menos de 24 horas.';
      this.reset();
      setTimeout(closeHeroForm,3000);
    }
  }catch{
    status.className='status err';status.style.display='block';
    status.textContent=isEn?'Error sending. Please try WhatsApp.':'Error al enviar. Intenta por WhatsApp.';
    btn.disabled=false;
  }
});

/* MAIN CONTACT FORM (al panel + Telegram) */
const mainForm=document.getElementById('mainContactForm');
if(mainForm){
  mainForm.addEventListener('submit',async function(e){
    e.preventDefault();
    const btn=document.getElementById('mainSubmitBtn');
    const status=document.getElementById('mainContactStatus');
    const isEn=lang==='en';
    btn.disabled=true;
    try{
      await enviarAlPanel(this,'Contacto');
      {
        status.className='status ok';status.style.display='block';
        status.textContent=isEn?'Message sent! We\'ll reply within 24 hours.':'¡Mensaje enviado! Te respondemos en menos de 24 horas.';
        this.reset();
      }
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
    {name_es:'Paquete Básico',name_en:'Basic Package',desc_es:'Logo + Manual de marca + 1K seguidores',desc_en:'Logo + Brand guidelines + 1K followers',price:'$320',delivery_es:'Entrega en 48h',delivery_en:'Delivered in 48h',items_es:['Logo profesional','Manual de marca','Revisión de redes sociales','1,000 seguidores','Tarjeta de presentación'],items_en:['Professional logo','Brand guidelines','Social media review','1,000 followers','Business card'],wa:'Paquete Básico Profesional'},
    {name_es:'Paquete Intermedio',name_en:'Intermediate Package',desc_es:'Logo + 3K seguidores + 10 posts',desc_en:'Logo + 3K followers + 10 posts',price:'$480',delivery_es:'Entrega en 72h',delivery_en:'Delivered in 72h',items_es:['Logo y manual de marca','Revisión de redes sociales','3,000 seguidores','10 posts para Instagram','Tarjeta de presentación'],items_en:['Logo and brand guidelines','Social media review','3,000 followers','10 Instagram posts','Business card'],wa:'Paquete Intermedio Profesional'},
    {name_es:'Paquete Avanzado',name_en:'Advanced Package',desc_es:'Marca completa + Web One Page + CRM',desc_en:'Full brand + One Page site + CRM',price:'$840',delivery_es:'Entrega en 72h',delivery_en:'Delivered in 72h',items_es:['Logo y manual de marca','5,000 seguidores + 10 posts','Factura y business card','Web One Page','Panel admin con CRM'],items_en:['Logo and brand guidelines','5,000 followers + 10 posts','Invoice and business card','One Page website','Admin panel with CRM'],wa:'Paquete Avanzado Profesional'},
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
  document.querySelectorAll('.js-spots').forEach(s=>s.textContent=spots);
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
  else location.href=(window.HOME_URL||'/')+'#contacto';
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
- Websites and online stores (built by DGP)
- Entrepreneurship and business growth
- DGP Global Group services and pricing

If asked anything outside this scope, politely say you specialize in digital marketing and business topics, and redirect to how you can help.

DGP GLOBAL GROUP SERVICES & PRICING:
WEB DESIGN: Landing Page from $280 one-time (24-48h delivery) | Standard Site up to 5 pages from $455 one-time | Premium Site with catalog or bookings from $950 one-time.
GRAPHIC DESIGN: Visual Identity (logo + brand guidelines) from $185 | Business Card from $26 | Social Media Posts/Flyers from $15 each.
PACKAGES (one-time): Basic $320 (logo, brand guidelines, social media review, 1,000 followers, business card; 48h) | Intermediate $480 (adds 3,000 followers and 10 Instagram posts; 72h) | Advanced $840 (5,000 followers, 10 posts, invoice and business card design, One Page website, admin panel with CRM; 72h).
CUSTOM SYSTEMS: CRM, admin panels, inventory, custom software — custom quote.
CONTACT: WhatsApp +1 (239) 823-1738 | Email dgpgroup.usa@gmail.com | Website dgpglobalgroup.com | Instagram @dgpgroup.us

GUIDELINES:
1. Always end with a question or call to action that moves toward a consultation or quote.
2. When mentioning prices, ALWAYS say "starting from $X" or "desde $X" — never use "for only" or "por solo". Prices are starting points, not fixed amounts.
3. Give real, valuable advice — educate first, then guide toward the service.
4. Never invent services or prices not listed above.
5. If someone seems interested, suggest contacting via WhatsApp or the contact form on the site.
6. DGP no longer offers marketplace management (Amazon, Walmart, TikTok Shop, eBay). If asked, explain that we focus on websites, custom systems and branding packages, and offer a website with an online store instead.`;

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

const PANEL_API='https://ayudante-dgp-bot.dgpgroupusa-llc.workers.dev';
/* Formularios: van al panel (Clientes) y a Telegram a la vez, a través del bot de DGP */
async function enviarAlPanel(form,servicio){
  const fd=new FormData(form),o={};
  for(const [k,v] of fd.entries()){
    if(k==='_gotcha'||k==='_subject'||typeof v!=='string'||!v.trim())continue;
    const el=form.querySelector(`[name="${k}"]`);const key=(el&&el.dataset.label)||k;
    o[key]=o[key]?o[key]+', '+v.trim():v.trim();
  }
  if(servicio&&!o.service&&!o.servicio)o.servicio=servicio;
  o.pagina=location.href;o.idioma=lang==='en'?'Inglés':'Español';
  if(typeof REF_CODE!=='undefined'&&REF_CODE)o.referido=REF_CODE;
  o.t=Date.now()-PAGE_T0;o._hp_dgp=(fd.get('_gotcha')||'').toString();
  const r=await fetch(PANEL_API+'/contacto',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
  if(!r.ok)throw new Error();
  return r.json();
}
async function sendAltairTelegram(closing=false){
  if(!altairHistory.some(m=>m.role==='user'))return;
  const unsent=altairHistory.slice(altairTgSent);
  if(!unsent.length)return;
  altairTgSent=altairHistory.length;saveAltair();
  try{await fetch(PANEL_API+'/chat-web',{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,
    body:JSON.stringify({cerrado:closing,mensajes:unsent.map(m=>({rol:m.role,texto:m.content}))})});}catch(e){}
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

setTimeout(loadRevs,1500);
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

/* FREE AUDIT FORM (al panel + Telegram) */
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
      await enviarAlPanel(this,'Auditoría web gratis');
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

/* PORTFOLIO SHOWCASE (laptop + phone) */
(function(){
  const sc=document.querySelector('.showcase');
  if(!sc||!PORT_P.length)return;
  const thumbs=[...sc.querySelectorAll('.sc-thumb')];
  const shots=[...sc.querySelectorAll('.sc-shot')];
  const q=c=>sc.querySelector(c);
  let idx=0,timer=null,visible=false,userPicked=false,started=false;
  const pad=n=>String(n).padStart(2,'0');

  shots.forEach(img=>{
    img.addEventListener('load',()=>{img.parentElement.classList.remove('missing');img.classList.add('ready');});
    img.addEventListener('error',()=>{img.classList.remove('ready');img.parentElement.classList.add('missing');});
  });
  sc.querySelectorAll('.sc-thumb-img img').forEach(img=>{
    const mark=()=>img.parentElement.classList.add('missing');
    img.addEventListener('error',mark);
    if(img.complete&&!img.naturalWidth)mark();
  });

  function loadShots(p){
    const d=q('.sc-shot-desktop'),m=q('.sc-shot-mobile');
    [[d,'desktop'],[m,'mobile']].forEach(([img,kind])=>{
      img.classList.remove('ready');
      img.parentElement.dataset.title=p.title;
      img.alt=p.title;
      img.src=`/assets/portfolio/${p.slug}/${kind}.webp?v=${window.SHOT_V||""}`;
    });
  }
  function show(n){
    idx=(n+PORT_P.length)%PORT_P.length;
    const p=PORT_P[idx];
    thumbs.forEach((t,k)=>{t.classList.toggle('active',k===idx);t.setAttribute('aria-selected',k===idx?'true':'false');});
    sc.classList.add('switching');
    setTimeout(()=>{
      loadShots(p);
      q('.sc-num').textContent=`${p.num} / ${pad(PORT_P.length)}`;
      q('.sc-title').textContent=p.title;
      q('.sc-tags').innerHTML=(lang==='en'?p.tags_en:p.tags_es).map(t=>`<span class="pc-tag">${t}</span>`).join('');
      q('.sc-desc').textContent=lang==='en'?p.desc_en:p.desc_es;
      q('.sc-link').href=p.url;
      sc.classList.remove('switching');
    },280);
  }
  function tick(){clearInterval(timer);timer=setInterval(()=>{if(visible&&!userPicked&&!document.hidden)show(idx+1);},8000);}
  thumbs.forEach((t,k)=>t.addEventListener('click',()=>{userPicked=true;show(k);}));
  new IntersectionObserver(en=>{
    visible=en[0].isIntersecting;
    if(visible&&!started){started=true;shots.forEach(img=>{img.src=img.dataset.src;});tick();}
  },{rootMargin:'300px'}).observe(sc);
})();

/* PARTNER REFERRAL CODE: ?ref=CODE is remembered for 90 days and attached to every lead */
const REF_DAYS=90;
function getRef(){
  try{
    const q=new URLSearchParams(location.search).get('ref');
    if(q){const code=q.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,30);if(code)localStorage.setItem('dgpRef',JSON.stringify({code,ts:Date.now()}));}
    const st=JSON.parse(localStorage.getItem('dgpRef')||'null');
    if(st&&Date.now()-st.ts<REF_DAYS*864e5)return st.code;
  }catch(e){}
  return '';
}
const REF_CODE=getRef();
function withRef(url){
  if(!REF_CODE)return url;
  try{
    const u=new URL(url),t=u.searchParams.get('text')||'';
    if(t.includes('Ref: '))return url;
    return u.origin+u.pathname+'?text='+encodeURIComponent(t+(t?'\n\n':'')+'Ref: '+REF_CODE);
  }catch(e){return url;}
}
if(REF_CODE){
  document.querySelectorAll('form.lead-form, #mainContactForm, #heroFormFs, #auditForm').forEach(f=>{
    if(f.querySelector('input[name="referido"]'))return;
    const i=document.createElement('input');i.type='hidden';i.name='referido';i.value=REF_CODE;f.appendChild(i);
  });
  document.addEventListener('click',e=>{const a=e.target.closest('a[href*="wa.me/12398231738"]');if(a)a.href=withRef(a.href);},true);
  const _open=window.open;window.open=function(url,...rest){if(typeof url==='string'&&url.includes('wa.me/12398231738'))url=withRef(url);return _open.call(window,url,...rest);};
}

/* GENERIC LEAD FORMS (partner sign-up, partner orders): to the DGP panel + Telegram */
document.querySelectorAll('form.lead-form').forEach(form=>{
  form.addEventListener('submit',async function(e){
    e.preventDefault();
    const btn=this.querySelector('button[type=submit]'),status=this.querySelector('.lead-status');
    const isEn=lang==='en';
    const missing=(this.dataset.required||'').split(',').filter(n=>n&&!((new FormData(this).get(n)||'').toString().trim()));
    if(missing.length){
      status.className='status lead-status err';
      status.textContent=isEn?'Please fill in the required fields.':'Por favor completa los campos obligatorios.';
      const first=this.querySelector(`[name="${missing[0]}"]`);if(first)first.focus();
      return;
    }
    btn.disabled=true;
    const fd=new FormData(this);
    try{
      await enviarAlPanel(this,this.id==='orderForm'?'Pedido de aliado':'Registro de aliado');
      status.className='status lead-status ok';
      status.textContent=this.id==='orderForm'
        ?(isEn?'Order received! We\'ll confirm the total and first payment on WhatsApp.':'¡Pedido recibido! Te confirmamos el total y el primer pago por WhatsApp.')
        :(isEn?'Thank you! We\'ll contact you on WhatsApp soon with your partner code.':'¡Gracias! Te contactamos pronto por WhatsApp con tu código de aliado.');
      this.reset();btn.disabled=false;
    }catch{
      status.className='status lead-status err';
      status.textContent=isEn?'Error sending. Please try WhatsApp.':'Error al enviar. Intenta por WhatsApp.';
      btn.disabled=false;
    }
  });
});

/* Old one-page anchors now live on their own pages */
(function(){
  const moved={'#web':'/diseno-web/','#paquetes':'/paquetes/','#ecommerce':'/paquetes/','#sistemas':'/sistemas/'};
  if(location.pathname==='/'&&moved[location.hash])location.replace(moved[location.hash]);
})();

/* INIT: page language + Altair conversation */
(function(){
  let q=null;
  try{q=new URLSearchParams(location.search).get('lang');}catch(e){}
  if((q==='en'||q==='es')&&q!==lang&&window.ALT_URL){location.replace(window.ALT_URL+location.hash);return;}
  setLang(lang);
  restoreAltair();
  // Each URL is one language: drop the other language's copy so the page (and Google) only sees this one
  document.querySelectorAll(lang==='en'?'[data-es],.opt-es':'[data-en],.opt-en').forEach(e=>e.remove());
})();
