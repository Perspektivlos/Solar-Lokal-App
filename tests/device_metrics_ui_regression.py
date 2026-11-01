"""Device metric UI regression. Real API comparisons; explicitly MOCKED edge fixtures.

Run with REACT_APP_BACKEND_URL exported. No config, control or database writes.
The browser-tool run used equivalent inline checks and screenshots.
"""
import asyncio
import copy
import json
import math
import os

from playwright.async_api import async_playwright


def number(text):
    return float(text.replace('W', '').replace('%', '').replace('.', '').replace(',', '.').replace('−', '-').strip())


def percent(power, peak):
    return math.floor(max(0, min(100, abs(power) / peak * 100)) + 0.5)


async def run(page, origin):
    results = []
    errors = []
    responses = []
    page.on('pageerror', lambda e: errors.append(str(e)))

    def check(label, condition, actual=''):
        results.append(bool(condition))
        print(f'{"PASS" if condition else "FAIL"} {label}: {actual}')

    async def record(response):
        if response.url.endswith('/api/live') and response.status == 200:
            responses.append(await response.json())

    page.on('response', record)
    try:
        await page.set_viewport_size({'width': 1920, 'height': 800})
        await page.goto(origin)
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.wait_for_timeout(200)
        texts = await page.evaluate("Object.fromEntries([...document.querySelectorAll('[data-testid]')].map(e=>[e.dataset.testid,e.textContent.trim()]))")
        # StrictMode can issue two initial responses; select the one actually rendered.
        candidates = [d for d in responses if round(d['summary']['pv_ac_power']) == number(texts['flow-hoymiles-power']) and round(d['summary']['battery_power']) == number(texts['flow-battery-power']) and round(d['summary']['grid_power']) == number(texts['flow-grid-power'])]
        assert candidates, 'No matching live response captured'
        data = candidates[-1]
        s, a, t, v = (data[k] for k in ('summary', 'ahoy', 'trucki', 'victron'))
        expected = {
            'flow-hoymiles-power': round(s['pv_ac_power']),
            'flow-hoymiles-percent': percent(s['pv_ac_power'], 1500),
            'flow-victron-power': round(s['pv_dc_power']),
            'flow-victron-percent': percent(s['pv_dc_power'], 3480),
            'flow-battery-power': round(s['battery_power']),
            'flow-battery-percent': math.floor(s['battery_soc'] + 0.5),
            'flow-sun2000-power': round(s['battery_discharge_w']),
            'flow-sun2000-percent': math.floor(s['battery_soc'] + 0.5),
            'flow-grid-power': round(s['grid_power']),
            'device-card-solar-value': round(s['pv_power']),
            'device-card-solar-percent': percent(s['pv_power'], 4980),
            'device-card-battery-value': round(s['battery_power']),
            'device-card-battery-percent': math.floor(t['soc'] + 0.5),
            'device-card-grid-value': round(s['grid_power']),
            'device-metric-hoymiles-power': round(a['total_power']),
            'device-metric-hoymiles-percent': percent(a['total_power'], 1500),
            'trucki-power': round(t['battery_power']),
            'trucki-soc': math.floor(t['soc'] + 0.5),
            'victron-total-power': round(v['total_power']),
            'victron-total-percent': percent(v['total_power'], 3480),
            'shelly-total-power': s['grid_power'],
        }
        for i, m in enumerate(v['mppts']):
            peak = [1700, 1780][i]
            for prefix in (f'device-metric-mppt-{i+1}', f'victron-{m["id"]}'):
                expected[prefix + '-power'] = round(m['pv_power'])
                expected[prefix + '-percent'] = percent(m['pv_power'], peak)
        for key, value in expected.items():
            check(key, abs(number(texts[key]) - value) < 0.11, texts[key])
        for node in ('hoymiles', 'victron', 'battery', 'sun2000', 'grid', 'house'):
            await page.get_by_test_id('flow-' + node).hover()
            await page.get_by_test_id('flow-inspector').wait_for()
            check('inspector ' + node, await page.get_by_test_id('flow-inspector-title').is_visible())
        await page.mouse.move(0, 0)
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('animation toggle', await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed') == 'false')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.get_by_test_id('flow-tempo-2').click(force=True)
        check('tempo', await page.get_by_test_id('flow-tempo-2').get_attribute('aria-pressed') == 'true')
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        for cycle in range(2):
            async with page.expect_response(lambda r: r.url.endswith('/api/live') and r.status == 200) as info:
                pass
            latest = await (await info.value).json()
            await page.wait_for_timeout(150)
            check(f'poll {cycle+1}', number(await page.get_by_test_id('flow-hoymiles-power').text_content()) == round(latest['summary']['pv_ac_power']))
        for width, height in ((1920, 800), (390, 844)):
            await page.set_viewport_size({'width': width, 'height': height})
            await page.get_by_test_id('flow-view-auto').click(force=True)
            check(f'overflow {width}', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await page.get_by_test_id('flow-pv').wait_for()
        check('compact peak', '4.980 W' in await page.get_by_test_id('flow-pv-peak').text_content())
        check('compact ratio', abs(number(await page.get_by_test_id('flow-pv-percent').text_content()) - number(await page.get_by_test_id('flow-pv-power').text_content()) / 4980 * 100) <= 0.6)
        await page.set_viewport_size({'width': 1920, 'height': 800})
        # MOCKED browser-only edge data. Application config and physical controls unchanged.
        fixture = copy.deepcopy(data)
        fixture['summary'].update({'battery_charge_w': 100, 'battery_discharge_w': 700, 'battery_power': -600, 'grid_power': 350})
        fixture['trucki']['battery_power'] = -700

        async def controlled(route):
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(fixture))

        await page.route('**/api/live', controlled)
        await page.reload()
        await page.get_by_test_id('dashboard').wait_for()
        await page.get_by_test_id('flow-view-detail').click(force=True)
        check('battery negative', await page.get_by_test_id('flow-battery-power').text_content() == '−600W')
        check('grid positive', await page.get_by_test_id('flow-grid-power').text_content() == '+350W')
        check('net discharge label', 'Entladen' in await page.get_by_test_id('flow-battery-peak').text_content())
        for invalid in (None, 0, 'not-a-number'):
            fixture['trucki']['max_power_w'] = invalid
            async with page.expect_response(lambda r: r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            for key in ('flow-sun2000-peak', 'device-card-battery-peak', 'trucki-peak'):
                check(f'unknown nominal {invalid} {key}', 'Nenn –' in await page.get_by_test_id(key).text_content())
        fixture['ahoy']['total_power'] = None
        fixture['victron']['mppts'][0]['pv_power'] = None
        fixture['summary']['battery_soc'] = None
        fixture['trucki']['soc'] = None
        async with page.expect_response(lambda r: r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        for key in ('device-metric-hoymiles-percent', 'device-metric-mppt-1-percent', f'victron-{v["mppts"][0]["id"]}-percent', 'device-card-battery-percent', 'flow-battery-percent'):
            check('unknown metric ' + key, await page.get_by_test_id(key).text_content() == '–')
        check('individual Hoymiles IDs', await page.get_by_test_id('ahoy-power').count() == 1 and await page.get_by_test_id('ahoy-percent').count() == 1)
        check('no runtime errors', not errors, errors)
        error_text = await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
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