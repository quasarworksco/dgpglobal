"""Builds a small Font Awesome bundle with only the icons the site uses.

Scans the templates, data and JS for fa-* icon names, keeps those rules from the
Font Awesome 6.5.1 CSS and subsets the webfonts to the same glyphs.
Usage: python3 scripts/fa-subset.py <path to @fortawesome/fontawesome-free package>
"""
import re, sys, glob, pathlib
from fontTools import subset

pkg = pathlib.Path(sys.argv[1])
out = pathlib.Path('assets/fa'); out.mkdir(parents=True, exist_ok=True)
sources = [p for g in ('_includes/**/*.html', '_layouts/*.html', '_data/**/*', 'assets/js/*.js', '**/index.html', '*.html')
           for p in glob.glob(g, recursive=True) if pathlib.Path(p).is_file() and not p.startswith(('_site', 'node_modules'))]
text = '\n'.join(pathlib.Path(p).read_text(errors='ignore') for p in sources)
used = set(re.findall(r'\bfa-([a-z0-9-]+)', text)) - {'solid', 'brands', 'regular'}

css = (pkg / 'css' / 'all.css').read_text()
# icon rules look like: .fa-check::before { content: "\f00c"; }
icon_rules = {}
for m in re.finditer(r'((?:\.fa-[a-z0-9-]+::?before,?\s*)+)\{\s*content:\s*"\\([0-9a-f]+)";\s*\}', css):
    for name in re.findall(r'\.fa-([a-z0-9-]+)::?before', m.group(1)):
        icon_rules[name] = m.group(2)
missing = sorted(n for n in used if n not in icon_rules)
found = sorted(n for n in used if n in icon_rules)
codepoints = sorted({int(icon_rules[n], 16) for n in found})

base = '''.fa,.fa-solid,.fa-regular,.fa-brands{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;line-height:1;text-rendering:auto}
.fa-solid,.fa{font-family:"Font Awesome 6 Free";font-weight:900}
.fa-regular{font-family:"Font Awesome 6 Free";font-weight:400}
.fa-brands{font-family:"Font Awesome 6 Brands";font-weight:400}
@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:block;src:url(fa-solid-900.woff2) format("woff2")}
@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:400;font-display:block;src:url(fa-regular-400.woff2) format("woff2")}
@font-face{font-family:"Font Awesome 6 Brands";font-style:normal;font-weight:400;font-display:block;src:url(fa-brands-400.woff2) format("woff2")}
'''
rules = ''.join(f'.fa-{n}::before{{content:"\\{icon_rules[n]}"}}\n' for n in found)
(out / 'fa.css').write_text('/* Font Awesome Free 6.5.1 subset — https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1) */\n' + base + rules)

for font in ('fa-solid-900', 'fa-regular-400', 'fa-brands-400'):
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = []; opts.notdef_outline = True
    f = subset.load_font(str(pkg / 'webfonts' / f'{font}.ttf'), opts)
    s = subset.Subsetter(opts); s.populate(unicodes=codepoints); s.subset(f)
    subset.save_font(f, str(out / f'{font}.woff2'), opts)
print(f'{len(found)} icons kept; not icons (ignored): {missing}')
