#!/usr/bin/env python3
"""Снимки SVG-схем страницы — чтобы посмотреть их глазами, а не поверить коду.

Запуск:  python3 tests/shots.py <страница> [<страница> ...]
Пример:  python3 tests/shots.py p-solid p-osc

Кладёт по одному PNG на каждую схему шире 200 px в каталог, заданный
переменной окружения SHOTS_DIR (по умолчанию — /tmp/physics-shots).
Заодно печатает ошибки консоли и «сырые» (неотрендеренные) формулы: если
KaTeX не разобрал выражение, на снимке это видно, но лучше знать заранее.
"""
import asyncio
import os
import sys

from playwright.async_api import async_playwright

ROOT = 'https://shadeswd.duckdns.org/physics/'
OUT = os.environ.get('SHOTS_DIR', '/tmp/physics-shots')


async def shoot(ctx, page_name):
    pg = await ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(ROOT + page_name, wait_until='networkidle')
    await pg.wait_for_timeout(2500)

    raw = await pg.evaluate(
        r"""()=>{const t=document.body.innerText;
             const m=t.match(/\\frac|\\sqrt|\\begin\{|\$\$[^$]{3,}\$\$/);
             return (m?m[0]:null) || (document.querySelector('.katex-error')?'katex-error':null);}""")
    svgs = pg.locator('svg.geo-board')
    n = await svgs.count()
    made = []
    for i in range(n):
        el = svgs.nth(i)
        if not await el.is_visible():
            continue
        box = await el.bounding_box()
        if not box or box['width'] < 200:
            continue
        path = os.path.join(OUT, '%s-%02d.png' % (page_name, i + 1))
        await el.scroll_into_view_if_needed()
        await pg.wait_for_timeout(150)
        await el.screenshot(path=path)
        made.append(path)
    await pg.close()
    print('%-16s схем %-3d %s%s' % (
        page_name, len(made),
        'ошибки консоли: %s' % errs[0][:70] if errs else 'консоль чистая',
        ' | СЫРАЯ ФОРМУЛА: %s' % raw if raw else ''))
    return made


async def main():
    os.makedirs(OUT, exist_ok=True)
    pages = sys.argv[1:]
    if not pages:
        print(__doc__)
        return
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1000, 'height': 900},
                                  device_scale_factor=2)
        for name in pages:
            try:
                await shoot(ctx, name)
            except Exception as e:
                print('%-16s ✗ %s' % (name, str(e)[:90]))
        await b.close()
    print('снимки в', OUT)

asyncio.run(main())
