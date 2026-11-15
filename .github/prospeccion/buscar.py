#!/usr/bin/env python3
"""
DGP Global Group · Prospección diaria
──────────────────────────────────────
Corre cada mañana en GitHub Actions (ver .github/workflows/prospeccion.yml).

  1. Pide al bot la configuración (zonas, cuántos por día).
  2. Junta negocios de fuentes públicas y gratuitas:
       · Sunbiz (Florida): empresas registradas ayer, archivo diario oficial.
       · Texas (data.texas.gov): permisos de venta nuevos en Houston y Dallas.
       · OpenStreetMap: negocios de la zona, muchos con correo o web.
  3. Le pregunta al bot cuáles ya vio (para no repetir).
  4. A los nuevos les busca la web y el correo (página de inicio y de contacto,
     o adivinando el dominio por el nombre), revisa que el correo exista (MX)
     y cómo está la web (candado, celular, año).
  5. Le manda al bot los mejores del día. El bot arma el correo personalizado
     y los muestra en el panel → Prospectos → Prospección.

La autenticación con el bot es con el token OIDC de GitHub (no hay claves
guardadas en el repositorio). Los registros no se imprimen: el log solo
muestra conteos.
"""
import concurrent.futures as cf
import datetime as dt
import html
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import urllib.error

BOT = 'https://ayudante-dgp-bot.dgpgroupusa-llc.workers.dev/prospeccion'
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
HOY = dt.date.today()
LOG = {}


def log(k, n=1):
    LOG[k] = LOG.get(k, 0) + n


# ───────────────────────── utilidades ─────────────────────────
def http(url, data=None, headers=None, timeout=12, metodo=None):
    h = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.8'}
    h.update(headers or {})
    if isinstance(data, (dict, list)):
        data = json.dumps(data).encode()
        h['Content-Type'] = 'application/json'
    elif isinstance(data, str):
        data = data.encode()
    req = urllib.request.Request(url, data=data, headers=h, method=metodo)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        cuerpo = r.read(1_500_000)
        return r.status, r.geturl(), cuerpo.decode(r.headers.get_content_charset() or 'utf-8', 'replace')


def oidc():
    u, t = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL'), os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if not u:
        sys.exit('Falta el permiso id-token: write en el workflow')
    _, _, b = http(u + '&audience=dgp-prospeccion', headers={'Authorization': 'Bearer ' + t})
    return json.loads(b)['value']


TOKEN = None


def bot(cuerpo):
    for intento in range(3):
        try:
            _, _, b = http(BOT, data=cuerpo, headers={'Authorization': 'Bearer ' + oidc()}, timeout=60)
            return json.loads(b)
        except urllib.error.HTTPError as e:
            if intento == 2 or e.code in (400, 401, 403):
                sys.exit(f'Bot respondió {e.code}: ' + e.read().decode('utf-8', 'replace')[:200])
            time.sleep(4 * (intento + 1))
            continue
        except Exception as e:
            if intento == 2:
                raise
            time.sleep(4 * (intento + 1))


def sin_tildes(s):
    return unicodedata.normalize('NFD', s or '').encode('ascii', 'ignore').decode()


SUFIJOS = r'\b(l\.?l\.?c\.?|inc\.?|corp\.?|corporation|co\.?|company|ltd\.?|p\.?a\.?|pllc|lp|llp|limited|incorporated|the|group|holdings?|enterprises?|services?|solutions?|of|and|&|usa|fl|florida|tx|texas)\b'


def slug(nombre, quitar=True):
    s = sin_tildes(nombre).lower()
    if quitar:
        s = re.sub(SUFIJOS, ' ', s)
    return re.sub(r'[^a-z0-9]+', '', s)


def titulo(nombre):
    s = re.sub(r'\s+', ' ', (nombre or '').strip())
    if s.isupper() or s.islower():
        s = ' '.join(w if re.fullmatch(r'(LLC|INC|CORP|PA|PLLC|LLP|LP|USA|II|III|IV|[A-Z]\.?[A-Z]\.?)', w) else w.capitalize() for w in s.split(' '))
    return s


def dns(nombre, tipo='A'):
    try:
        _, _, b = http(f'https://dns.google/resolve?name={urllib.parse.quote(nombre)}&type={tipo}', timeout=8)
        return [a.get('data', '') for a in json.loads(b).get('Answer', []) or []]
    except Exception:
        return None


_MX = {}


def mx_ok(dominio):
    if dominio not in _MX:
        r = dns(dominio, 'MX')
        _MX[dominio] = bool(r) if r is not None else True
    return _MX[dominio]


# ───────────────────────── categorías ─────────────────────────
# (clave, palabras en el nombre / etiquetas)
CATS = [
    ('limpieza', r'clean|janitor|maid|limpieza|pressure ?wash|power ?wash|window|carpet|mold'),
    ('jardineria', r'lawn|landscap|garden|tree|irrigation|sod|jardin|palm'),
    ('construccion', r'construct|build|remodel|renovat|roof|concrete|paver|framing|drywall|contractor|stucco|masonry|fenc|deck|kitchen|bath|cabinet|construccion'),
    ('plomeria', r'plumb|drain|sewer|water heater|septic|plomer'),
    ('electricidad', r'electric|solar|lighting|generator|electri'),
    ('aire', r'\bhvac\b|air condition|\bac\b|cooling|heating|refrigerat|a/c'),
    ('pintura', r'paint|coating|pintura'),
    ('piscinas', r'pool|spa service|piscina'),
    ('mudanzas', r'moving|movers|mudanza|junk|hauling|storage'),
    ('transporte', r'truck|transport|logistic|freight|dispatch|courier|delivery|towing|express|carrier|transporte'),
    ('autos', r'auto|car wash|detail|mechanic|tire|body shop|collision|motor|vehicle|automotive|carro'),
    ('restaurante', r'restaurant|grill|kitchen|cafe|coffee|bakery|pizza|taco|burger|food|catering|bbq|cuisine|bistro|eatery|restaurante|comida|panaderia|juice|smoothie|bar\b|cantina|sushi'),
    ('belleza', r'salon|beauty|nail|lash|brow|hair|barber|spa\b|esthetic|makeup|wax|glam|belleza|peluqueria|uñas|unas'),
    ('fitness', r'fitness|gym|training|yoga|pilates|crossfit|martial|boxing|wellness'),
    ('salud', r'medical|clinic|health|dental|dentist|therapy|chiropract|pharma|nurs|care\b|home care|rehab|physio|vision|optometr|counsel'),
    ('bienes_raices', r'realty|real estate|properties|property|homes|realtor|mortgage|title|investment'),
    ('seguros', r'insurance|seguros'),
    ('legal', r'\blaw\b|legal|attorney|lawyer|notary|immigration'),
    ('contabilidad', r'tax|account|bookkeep|payroll|cpa|financial|contab'),
    ('eventos', r'event|party|wedding|decor|dj\b|photo|video|studio|balloon|rental'),
    ('mascotas', r'pet|dog|grooming|veterin|animal|k9'),
    ('tienda', r'boutique|shop|store|market|apparel|clothing|jewel|gift|retail|tienda'),
    ('educacion', r'academy|tutor|school|learning|education|daycare|child care|preschool'),
    ('tecnologia', r'tech|software|digital|it\b|computer|web|data|cyber|app\b'),
    ('consultoria', r'consult|management|marketing|agency|advis|coach'),
    ('handyman', r'handyman|repair|maintenance|install|flooring|tile|glass|door|garage'),
]
OSM_CAT = {
    'hairdresser': 'belleza', 'beauty': 'belleza', 'cosmetics': 'belleza', 'massage': 'belleza', 'tattoo': 'belleza',
    'restaurant': 'restaurante', 'cafe': 'restaurante', 'fast_food': 'restaurante', 'bakery': 'restaurante', 'ice_cream': 'restaurante', 'bar': 'restaurante', 'pub': 'restaurante',
    'car_repair': 'autos', 'car_wash': 'autos', 'tyres': 'autos', 'car_parts': 'autos',
    'dentist': 'salud', 'doctors': 'salud', 'clinic': 'salud', 'physiotherapist': 'salud', 'optician': 'salud', 'veterinary': 'mascotas', 'pet_grooming': 'mascotas', 'pet': 'mascotas',
    'fitness_centre': 'fitness', 'sports_centre': 'fitness', 'estate_agent': 'bienes_raices', 'insurance': 'seguros', 'lawyer': 'legal', 'accountant': 'contabilidad', 'tax_advisor': 'contabilidad',
    'plumber': 'plomeria', 'electrician': 'electricidad', 'hvac': 'aire', 'painter': 'pintura', 'gardener': 'jardineria', 'builder': 'construccion', 'roofer': 'construccion', 'carpenter': 'construccion',
    'clothes': 'tienda', 'boutique': 'tienda', 'jewelry': 'tienda', 'gift': 'tienda', 'florist': 'tienda', 'furniture': 'tienda', 'convenience': 'tienda', 'laundry': 'limpieza', 'dry_cleaning': 'limpieza',
    'photographer': 'eventos', 'childcare': 'educacion', 'kindergarten': 'educacion', 'language_school': 'educacion', 'driving_school': 'educacion',
}
# NAICS (Texas): prefijos → categoría
NAICS = [('7225', 'restaurante'), ('7224', 'restaurante'), ('3118', 'restaurante'), ('8121', 'belleza'), ('8111', 'autos'), ('4411', 'autos'), ('4413', 'autos'), ('8112', 'handyman'),
         ('8129', 'mascotas'), ('5413', 'consultoria'), ('5416', 'consultoria'), ('5418', 'consultoria'), ('5419', 'eventos'), ('7139', 'fitness'), ('6244', 'educacion'), ('611', 'educacion'),
         ('448', 'tienda'), ('453', 'tienda'), ('442', 'tienda'), ('443', 'tecnologia'), ('445', 'tienda'), ('446', 'salud'), ('451', 'tienda'), ('452', 'tienda'), ('454', 'tienda'), ('4542', 'tienda'),
         ('2361', 'construccion'), ('2381', 'construccion'), ('2382', 'construccion'), ('2383', 'pintura'), ('5617', 'limpieza'), ('56173', 'jardineria'), ('5311', 'bienes_raices'), ('5312', 'bienes_raices'),
         ('5242', 'seguros'), ('5411', 'legal'), ('5412', 'contabilidad'), ('5415', 'tecnologia'), ('621', 'salud'), ('4841', 'transporte'), ('4842', 'transporte'), ('5321', 'autos'), ('8123', 'limpieza')]


def categoria(nombre, extra=''):
    t = sin_tildes(f'{nombre} {extra}').lower()
    for k, rx in CATS:
        if re.search(rx, t):
            return k
    return 'general'


HISPANO = r'\b(servicios?|limpieza|construccion|transporte|comida|tienda|taller|unas|belleza|latin[oa]?|hispan|mi |los |las |el |la |casa|familia|garcia|rodriguez|martinez|hernandez|lopez|gonzalez|perez|sanchez|ramirez|torres|flores|rivera|gomez|diaz|reyes|morales|cruz|ortiz|gutierrez|chavez|ramos|ruiz|alvarez|mendoza|castillo|jimenez|vasquez|romero|herrera|medina|aguilar|vargas|guzman|castro|fernandez|mendez|suarez|rojas|delgado|pena|soto|contreras|silva|espinoza|figueroa|navarro|acosta|molina|dominguez|cabrera|fuentes|marquez|valdez|sosa|rios|nunez|cardenas|cortez|salazar|leon|campos|vega|velasquez|mejia|guerrero|bermudez|espina|carrillo|zamora|benitez|ochoa)\b'


def idioma(*textos):
    t = sin_tildes(' '.join(x or '' for x in textos)).lower()
    return 'es' if re.search(HISPANO, t) else 'en'


# ───────────────────────── fuentes ─────────────────────────
def sunbiz(cfg):
    """Archivos diarios de Sunbiz (Florida). Solo empresas activas en los ZIP de la zona."""
    zips = tuple(cfg.get('zipsFL') or [])
    if not zips:
        return [], None
    L = "set sftp:auto-confirm yes; set net:timeout 30; set net:max-retries 3; open -u Public,'PubAccess1845!' sftp://sftp.floridados.gov"
    try:
        lista = subprocess.run(['lftp', '-c', f'{L}; cls -1 /public/doc/cor/'], capture_output=True, text=True, timeout=120).stdout.split()
    except Exception as e:
        log('sunbiz_error')
        return [], None
    archivos = sorted(f for f in lista if re.search(r'/\d{8}c\.txt$', f))
    ultimo = cfg.get('ultimoSunbiz') or ''
    nuevos = [f for f in archivos if f.rsplit('/', 1)[-1] > ultimo][-3:] or ([] if ultimo else archivos[-1:])
    out = []
    for f in nuevos:
        subprocess.run(['lftp', '-c', f"{L}; get '{f}' -o /tmp/sb.txt"], capture_output=True, timeout=300)
        try:
            lineas = open('/tmp/sb.txt', encoding='latin-1').read().splitlines()
        except Exception:
            continue
        log('sunbiz_registros', len(lineas))
        for l in lineas:
            if len(l) < 800 or l[204] != 'A':
                continue
            z = l[334:339].strip()
            if not z.startswith(zips):
                continue
            nombre = l[12:204].strip()
            ofi = l[673:715].strip()
            if l[672] == 'C':
                ofi = ''
            pila = ofi.split(',', 1)[1].split()[0] if ',' in ofi and ofi.split(',', 1)[1].split() else ''
            fecha = l[472:480]
            try:
                fecha = dt.date(int(fecha[4:]), int(fecha[:2]), int(fecha[2:4])).isoformat()
            except Exception:
                fecha = ''
            out.append({
                'clave': 'fl-' + l[0:12].strip(), 'fuente': 'sunbiz', 'nombre': titulo(nombre), 'estado': 'FL',
                'ciudad': titulo(l[304:332].strip()), 'zip': z, 'direccion': titulo(l[220:262].strip()),
                'contacto': titulo(re.sub(r'\s+', ' ', ofi.replace(',', ' ').strip())) if ofi else '',
                'registro': fecha, 'tipoEntidad': l[205:220].strip(), 'categoria': categoria(nombre), 'nombrePila': pila.capitalize() if len(pila) > 1 else '',
            })
    return out, (nuevos[-1].rsplit('/', 1)[-1] if nuevos else None)


def texas(cfg):
    ciudades = [c.upper() for c in (cfg.get('ciudadesTX') or [])]
    if not ciudades:
        return []
    desde = (HOY - dt.timedelta(days=int(cfg.get('diasTX') or 10))).isoformat()
    hasta = (HOY + dt.timedelta(days=45)).isoformat()
    lista = ','.join("'" + c.replace("'", '') + "'" for c in ciudades)
    q = urllib.parse.urlencode({
        '$where': f"outlet_first_sales_date between '{desde}' and '{hasta}' AND outlet_city in({lista})",
        '$limit': 3000, '$order': 'outlet_first_sales_date DESC'})
    try:
        _, _, b = http('https://data.texas.gov/resource/jrea-zgmq.json?' + q, timeout=60)
        filas = json.loads(b)
    except Exception:
        log('texas_error')
        return []
    out = []
    for r in filas:
        nombre = r.get('outlet_name') or r.get('taxpayer_name') or ''
        if not nombre or r.get('taxpayer_organization_type') in ('GS', 'GC', 'GV'):  # gobierno
            continue
        naics = r.get('outlet_naics_code') or ''
        cat = next((c for p, c in sorted(NAICS, key=lambda x: -len(x[0])) if naics.startswith(p)), None) or categoria(nombre)
        out.append({
            'clave': f"tx-{r.get('taxpayer_number')}-{r.get('outlet_number')}", 'fuente': 'texas', 'nombre': titulo(nombre), 'estado': 'TX',
            'ciudad': titulo(r.get('outlet_city', '')), 'zip': (r.get('outlet_zip_code') or '')[:5], 'direccion': titulo(r.get('outlet_address', '')),
            'contacto': '', 'registro': (r.get('outlet_first_sales_date') or '')[:10], 'naics': naics, 'categoria': cat,
            'razonSocial': titulo(r.get('taxpayer_name', '')) if r.get('taxpayer_name') != nombre else '',
        })
    log('texas_registros', len(out))
    return out


def socrata(url, params):
    try:
        _, _, b = http(url + '?' + urllib.parse.urlencode(params), timeout=90)
        return json.loads(b)
    except Exception:
        return None


# Servicios que registran empresas a nombre de otros: su correo no es del negocio
FORMADORES = r'registeredagent|incfile|legalzoom|zenbusiness|bizfilings|northwest|corpnet|swyft|tailorbrands|harborcompliance|ctcorporation|wolterskluwer|cogency|csc(global|info)|sunbiz|filings?@|compliance@|incorporat|formation|statutory|agent'


def fmcsa(cfg):
    """Registro federal de transportistas (FMCSA): empresas de camiones nuevas, casi todas con correo."""
    estados = cfg.get('estadosFMCSA') or []
    if not estados:
        return []
    zips = tuple((cfg.get('zipsFL') or []) + (cfg.get('zipsTX') or []))
    desde = (HOY - dt.timedelta(days=int(cfg.get('diasFMCSA') or 7))).strftime('%Y%m%d')
    lista = ','.join(f"'{e}'" for e in estados)
    filas = socrata('https://datahub.transportation.gov/resource/az4n-8mr2.json', {
        '$select': 'dot_number,legal_name,dba_name,phy_street,phy_city,phy_state,phy_zip,email_address,phone,company_officer_1,add_date,power_units',
        '$where': f"add_date >= '{desde}' AND phy_state in({lista}) AND email_address IS NOT NULL", '$limit': 5000})
    if filas is None:
        log('fmcsa_error')
        return []
    out = []
    for r in filas:
        z = (r.get('phy_zip') or '')[:5]
        if zips and not z.startswith(zips):
            continue
        correo = (r.get('email_address') or '').strip().lower()
        if re.search(FORMADORES, correo):
            correo = ''
        a = r.get('add_date') or ''
        nombre = r.get('dba_name') or r.get('legal_name') or ''
        out.append({
            'clave': 'dot-' + r.get('dot_number', ''), 'fuente': 'fmcsa', 'nombre': titulo(nombre), 'estado': r.get('phy_state', ''),
            'ciudad': titulo(r.get('phy_city', '')), 'zip': z, 'direccion': titulo(r.get('phy_street', '')),
            'contacto': titulo(r.get('company_officer_1', '')), 'registro': f'{a[:4]}-{a[4:6]}-{a[6:8]}' if len(a) == 8 else '',
            'categoria': 'transporte', 'email': correo, 'telefono': r.get('phone', ''),
            'nombrePila': (lambda w: w.capitalize() if re.fullmatch(r'[A-Za-z]{2,}', w or '') else '')(((r.get('company_officer_1') or '').split() or [''])[0]),
            'razonSocial': titulo(r.get('legal_name', '')) if r.get('dba_name') else '',
        })
    log('fmcsa_registros', len(out))
    return out


def connecticut(cfg):
    """Registro de empresas de Connecticut: casi todas las nuevas traen correo."""
    if not cfg.get('connecticut'):
        return []
    desde = (HOY - dt.timedelta(days=int(cfg.get('diasCT') or 4))).isoformat()
    filas = socrata('https://data.ct.gov/resource/n7gp-d28j.json', {
        '$where': f"date_registration >= '{desde}' AND business_email_address IS NOT NULL AND status = 'Active'",
        '$limit': 3000, '$order': 'date_registration DESC'})
    if filas is None:
        log('ct_error')
        return []
    out = []
    for r in filas:
        correo = (r.get('business_email_address') or '').strip().lower()
        if not correo or re.search(FORMADORES, correo):
            continue
        dirc = str(r.get('mailing_address') or '')
        m = re.search(r',\s*([A-Za-z .\'-]+),\s*([A-Z]{2})\s*,?\s*(\d{5})?', dirc)
        ciudad = m.group(1) if m else ''
        zipc = (m.group(3) or '') if m else ''
        nombre = r.get('name', '')
        naics = str(r.get('naics_code') or '')
        out.append({
            'clave': 'ct-' + (r.get('accountnumber') or r.get('id') or ''), 'fuente': 'connecticut', 'nombre': titulo(nombre), 'estado': 'CT',
            'ciudad': titulo(ciudad), 'zip': zipc, 'direccion': '', 'contacto': '',
            'registro': (r.get('date_registration') or '')[:10], 'email': correo,
            'categoria': next((c for p, c in sorted(NAICS, key=lambda x: -len(x[0])) if naics.startswith(p)), None) or categoria(nombre),
        })
    log('ct_registros', len(out))
    return out


# Zonas para OpenStreetMap (sur, oeste, norte, este). Se rota una parte cada día.
ZONAS_OSM = {
    'Miami': (25.55, -80.50, 25.98, -80.12), 'Fort Lauderdale': (25.98, -80.35, 26.35, -80.06), 'West Palm Beach': (26.35, -80.25, 26.95, -80.03),
    'Fort Myers': (26.45, -82.05, 26.75, -81.65), 'Naples': (26.05, -81.85, 26.33, -81.65), 'Cape Coral': (26.53, -82.08, 26.75, -81.90),
    'Sarasota': (27.10, -82.65, 27.45, -82.35), 'Tampa': (27.85, -82.62, 28.18, -82.30), 'St Petersburg': (27.68, -82.80, 27.95, -82.60),
    'Lakeland': (27.95, -82.05, 28.15, -81.85), 'Orlando': (28.35, -81.55, 28.68, -81.20), 'Kissimmee': (28.20, -81.50, 28.35, -81.25),
    'Port St Lucie': (27.15, -80.50, 27.40, -80.25), 'Houston': (29.55, -95.70, 30.05, -95.10), 'Dallas': (32.60, -97.00, 33.05, -96.55),
}


def osm(cfg):
    zonas = [z for z in (cfg.get('zonasOSM') or list(ZONAS_OSM)) if z in ZONAS_OSM]
    if not zonas:
        return []
    hoy = HOY.toordinal()
    elegidas = [zonas[(hoy * 3 + i) % len(zonas)] for i in range(min(3, len(zonas)))]
    out = []
    for z in dict.fromkeys(elegidas):
        s, w, n, e = ZONAS_OSM[z]
        bb = f'({s},{w},{n},{e})'
        tipos = 'shop|craft|office|amenity|healthcare'
        partes = [
            f'nwr["name"]["email"][~"^({tipos})$"~"."]{bb};',
            f'nwr["name"]["contact:email"]{bb};',
            f'nwr["name"]["website"][!"email"][~"^(shop|craft|office|healthcare)$"~"."]{bb};',
            f'nwr["name"]["website"][!"email"]["amenity"~"^(restaurant|cafe|dentist|doctors|clinic|veterinary|car_wash|car_repair|childcare)$"]{bb};',
        ]
        datos = {'elements': []}
        for parte in partes:
            q = f"[out:json][timeout:60];({parte});out tags center 250;"
            for host in ('https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
                try:
                    _, _, b2 = http(host, data='data=' + urllib.parse.quote(q), headers={'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'DGP-Prospeccion/1.0 (+https://dgpglobalgroup.com)'}, timeout=90)
                    datos['elements'] += json.loads(b2).get('elements', [])
                    break
                except Exception as e:
                    log('osm_falla_' + type(e).__name__)
                    continue
            time.sleep(2)
        if not datos['elements']:
            datos = None
        if not datos:
            log('osm_error')
            continue
        for el in datos.get('elements', []):
            t = el.get('tags', {})
            if t.get('brand') or t.get('brand:wikidata') or t.get('operator:wikidata'):
                continue  # cadenas grandes: no
            tipo = t.get('shop') or t.get('craft') or t.get('amenity') or t.get('office') or t.get('healthcare') or ''
            correo = (t.get('email') or t.get('contact:email') or '').split(';')[0].strip()
            web = (t.get('website') or t.get('contact:website') or t.get('url') or '').split(';')[0].strip()
            out.append({
                'clave': f"osm-{el['type'][0]}{el['id']}", 'fuente': 'osm', 'nombre': t.get('name', '').strip(), 'estado': t.get('addr:state', 'FL' if z not in ('Houston', 'Dallas') else 'TX'),
                'ciudad': t.get('addr:city') or z, 'zip': (t.get('addr:postcode') or '')[:5],
                'direccion': ' '.join(x for x in (t.get('addr:housenumber'), t.get('addr:street')) if x),
                'contacto': '', 'registro': '', 'categoria': OSM_CAT.get(tipo) or categoria(t.get('name', ''), tipo),
                'email': correo, 'web': web, 'telefono': (t.get('phone') or t.get('contact:phone') or '').split(';')[0].strip(),
                'facebook': t.get('contact:facebook', ''), 'instagram': t.get('contact:instagram', ''),
            })
        log('osm_' + z.replace(' ', ''), len(datos.get('elements', [])))
        time.sleep(3)
    return out


# ───────────────────────── enriquecer ─────────────────────────
RX_MAIL = re.compile(r'[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,120}\.[A-Za-z]{2,10}')
MALOS = re.compile(r'(\.(png|jpe?g|gif|svg|webp|css|js)$)|sentry|wixpress|example\.|domain\.com|yourdomain|email\.com$|godaddy|squarespace|wordpress|@2x|noreply|no-reply|donotreply|privacy@|abuse@|webmaster@|@sentry', re.I)
GENERICOS = ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'live.com', 'msn.com', 'comcast.net', 'att.net', 'bellsouth.net', 'me.com', 'protonmail.com')


def correos_de(texto, dominio=''):
    t = html.unescape(texto).replace('[at]', '@').replace('(at)', '@').replace(' [dot] ', '.')
    vistos = []
    for m in RX_MAIL.findall(t):
        m = m.strip('.').lower()
        if MALOS.search(m) or m in vistos:
            continue
        vistos.append(m)
    # Primero los del mismo dominio, luego genéricos (gmail…), luego otros
    dom = dominio.lower().removeprefix('www.')
    return sorted(vistos, key=lambda m: (0 if dom and m.endswith('@' + dom) else 1 if m.split('@')[1] in GENERICOS else 2, len(m)))


def revisar_web(url):
    """Devuelve {ok, url, https, celular, anio, correos, titulo, constructor}."""
    if not url:
        return None
    if not re.match(r'https?://', url):
        url = 'https://' + url
    try:
        st, final, cuerpo = http(url, timeout=12)
    except Exception:
        try:
            st, final, cuerpo = http(url.replace('https://', 'http://'), timeout=12)
        except Exception:
            return {'ok': False, 'url': url}
    host = urllib.parse.urlparse(final).hostname or ''
    info = {
        'ok': st < 400, 'url': final, 'https': final.startswith('https://'),
        'celular': bool(re.search(r'<meta[^>]+name=["\']viewport', cuerpo, re.I)),
        'titulo': html.unescape((re.search(r'<title[^>]*>(.*?)</title>', cuerpo, re.I | re.S) or [None, ''])[1]).strip()[:120],
        'constructor': next((n for n, rx in (('Wix', 'wix.com|wixstatic'), ('GoDaddy', 'godaddy|secureserver'), ('Squarespace', 'squarespace'), ('WordPress', 'wp-content'), ('Shopify', 'shopify')) if re.search(rx, cuerpo, re.I)), ''),
        'host': host,
    }
    anios = [int(a) for a in re.findall(r'(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d|19\d\d)', cuerpo, re.I)]
    info['anio'] = max(anios) if anios else None
    correos = correos_de(cuerpo, host)
    if not correos:
        # páginas de contacto
        links = re.findall(r'href=["\']([^"\']*(?:contact|about|contacto)[^"\']*)["\']', cuerpo, re.I)[:3]
        for l in dict.fromkeys(links):
            try:
                _, _, c2 = http(urllib.parse.urljoin(final, l), timeout=10)
                correos = correos_de(c2, host)
                if correos:
                    break
            except Exception:
                pass
    info['correos'] = correos[:3]
    return info


def adivinar_web(p):
    """Para empresas sin web conocida: prueba nombre.com / nombre.net y confirma que la página sea de ese negocio."""
    base = slug(p['nombre'])
    completo = slug(p['nombre'], quitar=False)
    est = (p.get('estado') or '').lower()
    candidatos = [c for c in dict.fromkeys([base, completo, base + est, base + 'llc', base + 'co', base + 'usa']) if 4 <= len(c) <= 40]
    palabras = [w for w in re.findall(r'[a-z]{4,}', sin_tildes(p['nombre']).lower()) if not re.fullmatch(SUFIJOS.strip(r'\b()'), w)][:3]
    for c in candidatos:
        for tld in ('.com', '.net', '.co', '.us'):
            d = c + tld
            a = dns(d)
            if not a:
                continue
            w = revisar_web(d)
            if not w or not w.get('ok'):
                continue
            pagina = sin_tildes((w.get('titulo') or '') + ' ' + ' '.join(w.get('correos') or [])).lower()
            if any(x in pagina for x in palabras) and not re.search(r'for sale|buy this domain|parked|godaddy|domain is', pagina):
                return w
    return None


def sub_libre(p):
    """Subdominio sugerido en dgp-link.com (corto y libre)."""
    base = slug(p['nombre'])[:22] or slug(p['nombre'], quitar=False)[:22]
    if len(base) < 3:
        base = slug(p['nombre'], quitar=False)[:22]
    ciudad = slug(p.get('ciudad', ''))[:10]
    for s in dict.fromkeys([base, base + ciudad, base + p.get('estado', '').lower()]):
        if s and not dns(f'{s}.dgp-link.com'):
            return s
    return base


def enriquecer(p):
    try:
        web = None
        if p.get('web'):
            web = revisar_web(p['web'])
        elif p['fuente'] in ('sunbiz', 'texas'):
            web = adivinar_web(p)
        correos = []
        if p.get('email'):
            correos.append(p['email'].lower())
        if web and web.get('correos'):
            correos += [c for c in web['correos'] if c not in correos]
        correos = [c for c in correos if mx_ok(c.split('@')[-1])]
        p['email'] = correos[0] if correos else ''
        p['correosExtra'] = correos[1:3]
        if web:
            p['web'] = web.get('url', p.get('web', ''))
            p['webInfo'] = {k: web.get(k) for k in ('ok', 'https', 'celular', 'anio', 'constructor', 'titulo')}
        p['subdominio'] = sub_libre(p)
        p['idioma'] = idioma(p['nombre'], p.get('contacto'), p.get('razonSocial'))
        # Puntaje: lo que más vale es tener correo y no tener web (o tenerla mala)
        pts = 0
        if p['email']:
            pts += 50
        if not p.get('web') or (web and not web.get('ok')):
            pts += 20
        elif web:
            malas = (not web.get('https')) + (not web.get('celular')) + bool(web.get('anio') and web['anio'] < HOY.year - 3) + bool(web.get('constructor') in ('Wix', 'GoDaddy'))
            pts += 6 * malas
        if p.get('telefono'):
            pts += 8
        if p.get('registro'):
            try:
                dias = (HOY - dt.date.fromisoformat(p['registro'])).days
                pts += 15 if -60 <= dias <= 30 else 0
            except Exception:
                pass
        if p['categoria'] != 'general':
            pts += 5
        p['puntaje'] = pts
        log('con_correo' if p['email'] else 'sin_correo')
    except Exception:
        log('enriquecer_error')
        p.setdefault('puntaje', 0)
    return p


# ───────────────────────── principal ─────────────────────────
def main():
    global TOKEN
    TOKEN = oidc()
    # Primero: dejar al día los correos ya guardados (textos nuevos)
    for _ in range(30):
        r = bot({'accion': 'rehacer'})
        log('rehechos', r.get('rehechos', 0))
        if not r.get('quedan'):
            LOG['listos_para_enviar'] = r.get('listos', 0)
            break
    if os.environ.get('SOLO_REHACER'):
        print(json.dumps(LOG))
        return
    cfg = bot({'accion': 'config'}).get('config', {})
    if cfg.get('pausado'):
        print('Prospección en pausa desde el panel')
        return
    por_dia = int(cfg.get('porDia') or 60)

    fl, ultimo = sunbiz(cfg)
    tx = texas(cfg)
    om = osm(cfg)
    fm = fmcsa(cfg)
    ct = connecticut(cfg)
    todos = fl + tx + om + fm + ct
    log('candidatos', len(todos))

    # Quitar los que ya vimos (el bot lleva la cuenta)
    nuevas = set()
    claves = [p['clave'] for p in todos]
    for i in range(0, len(claves), 500):
        nuevas |= set(bot({'accion': 'filtrar', 'claves': claves[i:i + 500]}).get('nuevas', []))
    todos = [p for p in todos if p['clave'] in nuevas and p.get('nombre')]
    log('nuevos', len(todos))

    # Enriquecer: primero los que más prometen, con un tope para no tardar horas
    def pre(p):
        return (bool(p.get('email')) * 3 + bool(p.get('web')) * 2 + (p['fuente'] != 'osm') + (p['categoria'] != 'general'))
    todos.sort(key=pre, reverse=True)
    tope = int(cfg.get('maxRevisar') or 900)
    lote = todos[:tope]
    with cf.ThreadPoolExecutor(24) as ex:
        lote = list(ex.map(enriquecer, lote))

    con = sorted([p for p in lote if p.get('email')], key=lambda p: -p['puntaje'])
    sin = sorted([p for p in lote if not p.get('email')], key=lambda p: -p['puntaje'])
    # Mezclar fuentes (Florida y Texas primero) para que no salgan solo camioneros o Connecticut
    orden = ['sunbiz', 'texas', 'osm', 'fmcsa', 'connecticut']
    grupos = {f: [p for p in con if p['fuente'] == f] for f in orden}
    peso = {'sunbiz': 3, 'texas': 3, 'osm': 2, 'fmcsa': 1, 'connecticut': 1}
    elegidos = []
    tope_cat = lambda c: max(3, int(por_dia * (0.12 if c == 'transporte' else 0.2)))
    por_cat = {}
    while len(elegidos) < por_dia and any(grupos.values()):
        for f in orden:
            for _ in range(peso[f]):
                while grupos[f] and len(elegidos) < por_dia:
                    p = grupos[f].pop(0)
                    if por_cat.get(p['categoria'], 0) >= tope_cat(p['categoria']):
                        continue   # ya hay muchos de este tipo hoy: se guarda para otro día
                    por_cat[p['categoria']] = por_cat.get(p['categoria'], 0) + 1
                    elegidos.append(p)
                    break
    for c, n in sorted(por_cat.items(), key=lambda x: -x[1]):
        log('tipo_' + c, n)
    for f in orden:
        log('correo_' + f, len([p for p in elegidos if p['fuente'] == f]))
    # Los que no tienen correo no sirven: no se guardan (solo se marcan como vistos)
    log('elegidos_con_correo', len([p for p in elegidos if p.get('email')]))
    log('elegidos', len(elegidos))

    guardados = 0
    for i in range(0, len(elegidos), 25):
        r = bot({'accion': 'guardar', 'items': elegidos[i:i + 25]})
        guardados += r.get('guardados', 0)
    # Los revisados que no entraron se marcan como vistos para no repetirlos mañana
    descartados = [p['clave'] for p in lote if p not in elegidos]
    for i in range(0, len(descartados), 500):
        bot({'accion': 'vistos', 'claves': descartados[i:i + 500]})
    bot({'accion': 'fin', 'ultimoSunbiz': ultimo, 'resumen': {**LOG, 'guardados': guardados}})
    print(json.dumps({**LOG, 'guardados': guardados}, indent=1))


if __name__ == '__main__':
    main()
