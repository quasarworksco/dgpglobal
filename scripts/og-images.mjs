// Renders the social share images (1200x630) for every page and language into assets/og/<ref>-<lang>.jpg.
// Run from the repo root after `npm install --no-save playwright sharp @fontsource/bebas-neue @fontsource/dm-sans`:
//   node scripts/og-images.mjs
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fontFile = (pkg, file) => path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files', file);
const dataUri = async (file, type) => `data:${type};base64,${(await fs.readFile(file)).toString('base64')}`;

const PAGES = {
  home:      { shot: 'pina-water-system',
               es: ['Agencia bilingüe · Florida', 'DISEÑO WEB Y', 'MARKETING DIGITAL', 'Sitios que venden, listos en 24–48h. En español e inglés.'],
               en: ['Bilingual agency · Florida', 'WEB DESIGN &', 'DIGITAL MARKETING', 'Websites that sell, ready in 24–48h. In English and Spanish.'] },
  web:       { shot: 'caibo-construction',
               es: ['Diseño web profesional', 'PÁGINAS WEB', 'QUE VENDEN', 'Landing pages en 24–48h, sitios multi-página y premium.'],
               en: ['Professional web design', 'WEBSITES', 'THAT SELL', 'Landing pages in 24–48h, multi-page and premium sites.'] },
  packages:  { shot: 'smelling-clean',
               es: ['Branding · Redes sociales', 'TU MARCA LISTA', 'PARA CRECER', 'Logo, redes, seguidores y posts en un solo paquete.'],
               en: ['Branding · Social media', 'YOUR BRAND', 'READY TO GROW', 'Logo, social media, followers and posts in one package.'] },
  ecommerce: { shot: 'the-sweet-zone',
               es: ['Gestión e-commerce', 'VENDE EN AMAZON,', 'WALMART Y TIKTOK', 'Abrimos y gestionamos tu tienda. Pago único, sin mensualidad.'],
               en: ['E-commerce management', 'SELL ON AMAZON,', 'WALMART & TIKTOK', 'We open and manage your store. One-time payment, no monthly fee.'] },
  systems:   { shot: 'moya-company',
               es: ['Software a medida', 'SISTEMAS HECHOS', 'PARA TU NEGOCIO', 'Paneles, facturación, reservas y apps web desde cero.'],
               en: ['Custom software', 'SYSTEMS BUILT', 'FOR YOUR BUSINESS', 'Dashboards, billing, bookings and web apps built from scratch.'] },
  portfolio: { shot: 'valpa-truck',
               es: ['Portafolio', 'PROYECTOS QUE HABLAN', 'POR SÍ SOLOS', 'Sitios reales para negocios en Florida y todo USA.'],
               en: ['Portfolio', 'PROJECTS THAT SPEAK', 'FOR THEMSELVES', 'Real websites for businesses across Florida and the USA.'] },
  audit:     { shot: 'appliance-solutions-901',
               es: ['Gratis · Sin compromiso', 'TU WEB REVISADA', 'GRATIS EN 24H', 'Velocidad, celular, Google y conversión en un informe claro.'],
               en: ['Free · No commitment', 'YOUR SITE REVIEWED', 'FREE IN 24H', 'Speed, mobile, Google and conversion in one clear report.'] },
  partners:  { shot: 'cleaning-group',
               es: ['Programa de aliados', 'OFRECE PÁGINAS WEB', 'CON TU MARCA', 'Para gestores de LLC y contadores: 25% de descuento y marca blanca.'],
               en: ['Partner program', 'OFFER WEBSITES', 'UNDER YOUR BRAND', 'For LLC agents and accountants: 25% off and white label.'] },
};

const fonts = {
  bebas: await dataUri(fontFile('@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff2'), 'font/woff2'),
  dm300: await dataUri(fontFile('@fontsource/dm-sans', 'dm-sans-latin-300-normal.woff2'), 'font/woff2'),
  dm500: await dataUri(fontFile('@fontsource/dm-sans', 'dm-sans-latin-500-normal.woff2'), 'font/woff2'),
};
const logo = await dataUri('assets/img/logo-mark.png', 'image/png');

const html = async (ref, lang) => {
  const [eyebrow, line1, line2, sub] = PAGES[ref][lang];
  const desktop = await dataUri(`assets/portfolio/${PAGES[ref].shot}/desktop.webp`, 'image/webp');
  const mobile = await dataUri(`assets/portfolio/${PAGES[ref].shot}/mobile.webp`, 'image/webp');
  const titleSize = Math.max(line1.length, line2.length) > 17 ? 68 : 84;
  return `<!doctype html><html><head><style>
@font-face{font-family:Bebas;src:url(${fonts.bebas})}
@font-face{font-family:DM;font-weight:300;src:url(${fonts.dm300})}
@font-face{font-family:DM;font-weight:500;src:url(${fonts.dm500})}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;font-family:DM;background:linear-gradient(135deg,#050b24 0%,#0d1f5c 55%,#1438cc 100%);position:relative;color:#fff}
body:before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.09) 1px,transparent 1px);background-size:26px 26px}
.glow{position:absolute;right:-120px;top:40px;width:760px;height:560px;background:radial-gradient(ellipse,rgba(77,120,255,.45),transparent 65%);filter:blur(10px)}
.brand{position:absolute;left:64px;top:52px;display:flex;align-items:center;gap:14px}
.tile{width:54px;height:54px;border-radius:12px;background:#fff;display:flex;align-items:center;justify-content:center}
.tile img{height:38px}
.name{font-family:Bebas;font-size:30px;letter-spacing:5px}.name span{color:#8fb0ff}
.text{position:absolute;left:64px;top:160px;width:560px}
.eyebrow{display:inline-block;font-family:DM;font-weight:500;font-size:15px;letter-spacing:3px;text-transform:uppercase;color:#c7d6ff;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);border-radius:100px;padding:7px 16px;margin-bottom:22px}
h1{font-family:Bebas;font-weight:400;font-size:${titleSize}px;line-height:.92;letter-spacing:1px}
h1 span{display:block;color:#8fb0ff}
p{font-weight:300;font-size:24px;line-height:1.4;color:rgba(255,255,255,.82);margin-top:22px;max-width:520px}
.foot{position:absolute;left:64px;bottom:44px;display:flex;align-items:center;gap:14px;font-family:DM;font-weight:500;font-size:18px;letter-spacing:1px}
.pill{background:#fff;color:#0d1f5c;border-radius:100px;padding:8px 18px}
.langs{color:rgba(255,255,255,.7);font-size:15px;letter-spacing:2px;text-transform:uppercase}
.laptop{position:absolute;right:92px;top:118px;width:500px}
.screen{background:#0e0f12;border-radius:14px 14px 3px 3px;padding:12px 12px 14px;box-shadow:0 0 0 1px #2a2c31 inset,0 30px 60px -15px rgba(0,0,0,.6)}
.vp{overflow:hidden;background:#f3f4f7}
.laptop .vp{aspect-ratio:16/10;border-radius:2px}
.vp img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.base{height:14px;margin:0 -34px;background:linear-gradient(180deg,#e2e4e9,#9da1aa);border-radius:0 0 14px 14px}
.phone{position:absolute;right:52px;top:250px;width:128px;background:#0e0f12;border-radius:22px;padding:9px 6px;box-shadow:0 0 0 2px #c9ccd3,0 30px 50px -10px rgba(0,0,0,.6)}
.phone .vp{aspect-ratio:9/19.5;border-radius:15px}
</style></head><body>
<div class="glow"></div>
<div class="brand"><div class="tile"><img src="${logo}"></div><div class="name">DGP <span>GLOBAL</span> GROUP</div></div>
<div class="text"><div class="eyebrow">${eyebrow}</div><h1>${line1}<span>${line2}</span></h1><p>${sub}</p></div>
<div class="foot"><span class="pill">dgpglobalgroup.com</span><span class="langs">Español · English</span></div>
<div class="laptop"><div class="screen"><div class="vp"><img src="${desktop}"></div></div><div class="base"></div></div>
<div class="phone"><div class="vp"><img src="${mobile}"></div></div>
</body></html>`;
};

await fs.mkdir('assets/og', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const ref of Object.keys(PAGES)) {
  for (const lang of ['es', 'en']) {
    await page.setContent(await html(ref, lang), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `assets/og/${ref}-${lang}.jpg`, type: 'jpeg', quality: 86 });
    console.log(`assets/og/${ref}-${lang}.jpg`);
  }
}
await browser.close();
