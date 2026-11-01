"""EnergyFlow SCADA regression: public API, browser-only MOCKED watt/direction edges.

Run with REACT_APP_BACKEND_URL exported and Playwright installed.
Equivalent checks executed through the browser automation tool in iteration 36.
No application configuration, hardware controls or database writes.
"""
import asyncio
import json
import math
import os

from playwright.async_api import async_playwright


async def run(page, origin):
    results, errors = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def check(label, ok, actual=''):
        results.append(bool(ok))
        print(f'{"PASS" if ok else "FAIL"} {label}: {actual}')

    async def ctm(selector):
        return await page.locator(selector).first.evaluate(
            'e=>{const m=e.getCTM();return [m.e,m.f]}')

    try:
        await page.set_viewport_size({'width': 1920, 'height': 800})
        await page.goto(origin)
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        if await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed') != 'true':
            await page.get_by_test_id('flow-toggle-anim').click(force=True)
        shape = await page.evaluate("""[...document.querySelectorAll('[data-testid^=flow-photons-]')].map(g=>({
            paths:g.querySelectorAll('path').length,circles:g.querySelectorAll('circle').length,
            n:g.querySelectorAll('animateMotion').length,
            rotate:g.querySelector('animateMotion').getAttribute('rotate'),
            radius:g.querySelectorAll('animate[attributeName=r]').length,
            opacity:g.querySelectorAll('animate[attributeName=opacity]').length}))""")
        check('round glowing photons', bool(shape) and all(s['paths'] == 0 and s['circles'] == 2*s['n'] and s['radius'] == s['n'] and s['opacity'] == 2*s['n'] for s in shape), shape)
        check('narrow solid channels', await page.locator('[data-testid^=flow-channel-]').evaluate_all("els=>els.length>0&&els.every(e=>Number(e.getAttribute('stroke-width'))<=2.6&&getComputedStyle(e).strokeDasharray==='none')"))
        check('no legacy segments', await page.locator('[data-testid^=flow-segments-]').count() == 0)
        selector = '[data-testid=flow-photons-hoymiles-house] > g'
        a = await ctm(selector)
        await page.wait_for_timeout(350)
        b = await ctm(selector)
        check('measurable photon movement', math.hypot(b[0]-a[0], b[1]-a[1]) > 2, [a, b])
        motions = page.get_by_test_id('flow-photons-hoymiles-house').locator('animateMotion')
        base = float((await motions.first.get_attribute('dur')).rstrip('s'))
        for tempo, key in ((1.5, '1_5'), (2, '2')):
            await page.get_by_test_id('flow-tempo-'+key).click(force=True)
            dur = float((await motions.first.get_attribute('dur')).rstrip('s'))
            check('tempo '+str(tempo), abs(dur-base/tempo) <= .02 and await page.get_by_test_id('flow-tempo-'+key).get_attribute('aria-pressed') == 'true')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('flow off', await page.locator('[data-testid^=flow-photons-]').count() == 0 and await page.locator('[data-testid=energy-flow-svg] .flow-light-beam').count() == 0 and await page.evaluate('localStorage.getItem("solar.flowOn")') == '0')
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        check('flow/tempo persistence', await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed') == 'false' and await page.get_by_test_id('flow-tempo-2').get_attribute('aria-pressed') == 'true')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.emulate_media(reduced_motion='reduce')
        await page.wait_for_timeout(250)
        check('reduced motion', await page.locator('[data-testid=energy-flow-svg] animateMotion').count() == 0 and await page.locator('[data-testid=energy-flow-svg] .flow-light-beam').count() == 0)
        await page.emulate_media(reduced_motion='no-preference')
        await page.wait_for_timeout(250)
        check('motion restored', await page.locator('[data-testid^=flow-photons-]').count() > 0)
        await page.evaluate('document.fonts.ready')
        check('DSEG loaded', await page.evaluate("[...document.fonts].some(f=>f.family==='DSEG7-Classic'&&f.status==='loaded')"))
        for node in ('hoymiles', 'victron', 'battery', 'sun2000', 'grid', 'house'):
            await page.get_by_test_id('flow-'+node).hover()
            await page.get_by_test_id('flow-inspector').wait_for()
            check('inspector '+node, await page.get_by_test_id('flow-inspector').locator('dd').evaluate_all("els=>els.every(e=>getComputedStyle(e).fontFamily.includes('DSEG7-Classic'))"))
        await page.mouse.move(0, 0)
        check('unique IDs', await page.evaluate("(()=>{const a=[...document.querySelectorAll('[data-testid]')].map(e=>e.dataset.testid);return new Set(a).size===a.length})()"))
        for width, height in ((1920, 800), (390, 844)):
            await page.set_viewport_size({'width': width, 'height': height})
            await page.get_by_test_id('flow-view-auto').click(force=True)
            await page.wait_for_timeout(200)
            check('page overflow '+str(width), await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check('node clipping '+str(width), await page.evaluate("""(()=>{const s=document.querySelector('[data-testid=energy-flow-svg]'),v=s.viewBox.baseVal;
                return [...s.querySelectorAll(':scope > g[data-testid]')].every(g=>{const b=g.getBBox();return b.x>=0&&b.y>=0&&b.x+b.width<=v.width&&b.y+b.height<=v.height})})()"""))
        # Explicitly MOCKED browser edge responses. No application state changes.
        fixture = await (await page.request.get(origin+'/api/live')).json()

        async def controlled(route):
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(fixture))

        await page.route('**/api/live', controlled)
        await page.set_viewport_size({'width': 1920, 'height': 800})
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        for watts, n in ((100, 1), (400, 2), (1000, 3), (2000, 4)):
            fixture['summary']['pv_ac_power'] = watts
            async with page.expect_response(lambda r: r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            motions = page.get_by_test_id('flow-photons-hoymiles-house').locator('animateMotion')
            dur = float((await motions.first.get_attribute('dur')).rstrip('s'))
            check('watt density and speed '+str(watts), await motions.count() == n and abs(dur-(2.4-watts/3000*1.8)) < .02)
        for grid, reverse in ((-700, True), (700, False)):
            fixture['summary']['grid_power'] = grid
            async with page.expect_response(lambda r: r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            await page.evaluate("document.querySelector('[data-testid=energy-flow-svg]').setCurrentTime(.2)")
            a = await ctm('[data-testid=flow-photons-grid-house] > g')
            await page.wait_for_timeout(100)
            b = await ctm('[data-testid=flow-photons-grid-house] > g')
            check('grid actual direction '+str(grid), (b[0] < a[0]) == reverse and abs(b[0]-a[0]) > 1, [a, b])
        fixture['summary'].update({'battery_power': 2500, 'battery_soc': 100, 'battery_charge_w': 2500})
        async with page.expect_response(lambda r: r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        for mode in ('detail', 'compact'):
            await page.get_by_test_id('flow-view-'+mode).click(force=True)
            overlap = await page.get_by_test_id('flow-battery').evaluate("e=>{const a=e.querySelector('[data-testid$=power]').getBBox(),b=e.querySelector('[data-testid$=percent]').getBBox();return a.x+a.width>b.x}")
            check('full SoC signed power nonoverlap '+mode, not overlap)
        check('no runtime errors', not errors, errors)
        error_text = await page.evaluate("""() => {
            const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el => el.textContent).join(', ');
        }""")
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        await page.unroute('**/api/live', controlled)
    except Exception as exc:
        check('script execution', False, str(exc))
    print(f'RESULT {sum(results)}/{len(results)}')
    return all(results)


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        ok = await run(page, os.environ['REACT_APP_BACKEND_URL'].rstrip('/'))
        await browser.close()
        return ok


if __name__ == '__main__':
    raise SystemExit(0 if asyncio.run(main()) else 1)