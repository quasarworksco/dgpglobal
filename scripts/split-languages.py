"""Wraps every Spanish/English element in the templates with a Liquid language check.

Elements marked data-es / data-en (and <option class="opt-es|opt-en">) end up only in the
page of their language, so each built page contains a single language in its HTML.
Idempotent: elements that are already wrapped are left alone.
Usage: python3 scripts/split-languages.py _includes/*.html _includes/pages/*.html
"""
import sys
from html.parser import HTMLParser

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}
OPEN = {'es': "{% if page.lang == 'es' %}", 'en': "{% if page.lang == 'en' %}"}
CLOSE = '{% endif %}'


def lang_of(attrs):
    names = dict(attrs)
    if 'data-es' in names:
        return 'es'
    if 'data-en' in names:
        return 'en'
    classes = (names.get('class') or '').split()
    if 'opt-es' in classes:
        return 'es'
    if 'opt-en' in classes:
        return 'en'
    return None


class Finder(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.line_start = [0]
        for i, ch in enumerate(src):
            if ch == '\n':
                self.line_start.append(i + 1)
        self.stack = []  # [tag, lang, start_offset]
        self.spans = []  # (start, end, lang)

    def pos_now(self):
        line, col = self.getpos()
        return self.line_start[line - 1] + col

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        self.stack.append([tag, lang_of(attrs), self.pos_now()])

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        start = self.pos_now()
        end = self.src.index('>', start) + 1
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                _, lang, s = self.stack[i]
                del self.stack[i:]
                if lang:
                    self.spans.append((s, end, lang))
                return


def process(path):
    src = open(path, encoding='utf-8').read()
    finder = Finder(src)
    finder.feed(src)
    finder.close()
    edits = []
    for start, end, lang in finder.spans:
        before = src[max(0, start - len(OPEN[lang])):start]
        if before == OPEN[lang]:
            continue  # already wrapped
        edits.append((start, end, lang))
    # Offsets refer to the original text, so apply every insertion from the end backwards
    # Where one language block ends exactly where the other starts, the close must stay before the open
    inserts = [(start, OPEN[lang]) for start, end, lang in edits] + [(end, CLOSE) for start, end, lang in edits]
    for pos, text in sorted(inserts, key=lambda x: x[0], reverse=True):
        src = src[:pos] + text + src[pos:]
    open(path, 'w', encoding='utf-8').write(src)
    return len(edits)


if __name__ == '__main__':
    total = 0
    for p in sys.argv[1:]:
        n = process(p)
        total += n
        print(f'{n:4}  {p}')
    print(f'{total} elements wrapped')
