# Public DayBalance integration checks; browser-only MOCKED failures/empty-data/threshold edges.
import re
from decimal import Decimal, ROUND_HALF_UP
from urllib.parse import urlparse, parse_qs


async def run(page):
    checks, snapshots, runtime = [], {}, []
    page.on('pageerror', lambda e: runtime.append(str(e)))

    async def capture(response):
        if urlparse(response.url).path == '/api/today' and response.status == 200:
            snapshots[parse_qs(urlparse(response.url).query).get('day_offset', ['0'])[0]] = await response.json()

    page.on('response', capture)

    def check(label, valid, detail=''):
        checks.append((label, bool(valid)))
        print(('PASS: ' if valid else 'FAIL: ') + label + ' ' + str(detail))

    def number(text):
        return float(re.search(r'[-+]?\d+(?:[.,]\d+)?', text.replace('.', '').replace('−', '-')).group(0).replace(',', '.'))

    def rounded(value):
        return float(Decimal(str(value)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP))

    try:
        await page.set_viewport_size({'width': 1920, 'height': 800})
        await page.reload()
        await page.get_by_test_id('history-page').wait_for(timeout=20000)
        for _ in range(60):
            if '0' in snapshots and '1' in snapshots: break
            await page.wait_for_timeout(100)
        await page.wait_for_timeout(300)
        d, y = snapshots['0'], snapshots['1']
        actual = await page.locator('[data-testid]').evaluate_all('(els) => Object.fromEntries(els.map(e => [e.dataset.testid,e.textContent]))')
        fields = {'vp-bal-pv-value': 'pv_kwh', 'vp-bal-house-value': 'consumption_kwh',
                  'vp-bal-battery-value': 'battery_discharge_kwh', 'vp-bal-grid-value': 'grid_import_kwh',
                  'vp-bal-pv-row-direkt-zum-haus-value': 'pv_direct_kwh',
                  'vp-bal-pv-row-in-akku-geladen-value': 'battery_charge_kwh',
                  'vp-bal-pv-row-pv-netzeinspeisung-value': 'pv_export_kwh',
                  'vp-bal-house-row-aus-solar-direkt-value': 'pv_direct_kwh',
                  'vp-bal-house-row-aus-batteriespeicher-value': 'battery_to_house_kwh',
                  'vp-bal-house-row-aus-ffentlichem-netz-value': 'grid_import_kwh',
                  'vp-bal-battery-row-ladung-kumuliert-value': 'battery_charge_kwh',
                  'vp-bal-battery-row-davon-zum-haus-value': 'battery_to_house_kwh',
                  'vp-bal-battery-row-davon-ins-netz-value': 'battery_export_kwh',
                  'vp-bal-grid-row-netzeinspeisung-value': 'grid_export_kwh'}
        for tid, field in fields.items():
            expected = rounded(d[field]) * (-1 if tid == 'vp-bal-grid-row-netzeinspeisung-value' else 1)
            check('API value '+tid, abs(number(actual[tid])-expected)<0.006)
            delta = tid[:-5]+'delta'
            if delta in actual:
                diff = d[field]-y[field]
                check('Delta '+field, 'unverändert' in actual[delta] if abs(diff)<.005 else abs(number(actual[delta])-rounded(diff))<.006)
        check('Net saldo', abs(number(actual['vp-bal-grid-row-netto-netzsaldo-value'])-rounded(d['grid_import_kwh']-d['grid_export_kwh']))<.006)
        ratio = actual['vp-bal-battery-row-entlade-ladeverh-ltnis-value']
        check('Ratio and correct label', 'Entlade-/Ladeverhältnis' in actual['vp-bal-battery'] and (abs(number(ratio)-d['battery_discharge_charge_pct'])<.06 if d['battery_charge_kwh']>.05 else ratio=='–'))
        for prefix, labels in [('vp-dist-pv',['direkt','akku','netz']), ('vp-dist-house',['solar','akku','netz'])]:
            check(prefix+' shares sum 100', sum(number(actual[prefix+'-'+label]) for label in labels)==100)
            check(prefix+' no false hint', prefix+'-hint' not in actual)
        check('Historical legend', 'PV lokal genutzt' in actual['vp-balance-history-bars'])
        check('Desktop no overflow', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await page.get_by_test_id('vp-balance').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-balance-37/desktop-verified.jpeg', quality=40, full_page=False)
        for rng in ['1h','3h','6h','12h','24h']:
            async with page.expect_response(lambda r: '/api/history?range='+rng in r.url and r.status==200):
                await page.get_by_test_id('vp-range-'+rng).click(force=True)
            check('Range '+rng, await page.get_by_test_id('vp-range-'+rng).get_attribute('aria-pressed')=='true')
        for view in ['four','multi']:
            await page.get_by_test_id('vp-view-'+view).click(force=True)
            check('View '+view, await page.get_by_test_id('vp-view-'+view).get_attribute('aria-pressed')=='true')
        async with page.expect_response(lambda r: urlparse(r.url).path=='/api/today' and 'day_offset=0' in r.url and r.status==200, timeout=10000):
            await page.wait_for_timeout(5300)
        check('Polling continues', True)
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_timeout(300)
        check('Mobile no overflow', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await page.get_by_test_id('vp-balance').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-balance-37/mobile-verified.jpeg', quality=40, full_page=False)

        empty = {k: 0 for k in d}
        async def empty_yesterday(route):
            if 'day_offset=1' in route.request.url:
                await route.fulfill(status=200, json=empty)
            else: await route.continue_()
        await page.route('**/api/today*', empty_yesterday)
        await page.reload()
        await page.wait_for_timeout(800)
        await page.get_by_test_id('vp-bal-pv-delta').wait_for()
        text = await page.get_by_test_id('vp-bal-pv-delta').inner_text()
        check('MOCKED empty yesterday means unavailable', text=='Gestern: –', text)
        await page.unroute('**/api/today*', empty_yesterday)

        async def failed_yesterday(route):
            if 'day_offset=1' in route.request.url: await route.fulfill(status=502, json={'detail':'TEST unavailable'})
            else: await route.continue_()
        await page.route('**/api/today*', failed_yesterday)
        await page.reload()
        await page.wait_for_timeout(800)
        check('MOCKED failed yesterday means unavailable', await page.get_by_test_id('vp-bal-pv-delta').inner_text()=='Gestern: –')
        await page.unroute('**/api/today*', failed_yesterday)

        async def failed_today(route):
            if 'day_offset=0' in route.request.url: await route.fulfill(status=502, json={'detail':'TEST unavailable'})
            else: await route.continue_()
        await page.route('**/api/today*', failed_today)
        await page.reload()
        await page.wait_for_timeout(800)
        text = await page.get_by_test_id('vp-bal-pv-value').inner_text()
        alerts = await page.get_by_test_id('vp-balance').locator('[role="alert"]').count()
        check('MOCKED failed today not presented as zero', text not in ['0,00','0'] or alerts>0, {'value':text,'alerts':alerts})
        await page.unroute('**/api/today*', failed_today)

        for charge, expected in [(0.05,'–'), (0.051,'50,0%')]:
            fixture = {**empty, 'pv_kwh':charge, 'battery_charge_kwh':charge,
                       'battery_discharge_kwh':charge/2, 'battery_to_house_kwh':charge/2,
                       'consumption_kwh':charge/2, 'battery_discharge_charge_pct':50,
                       'round_trip_pct':50, 'autarky_pct':100, 'self_consumption_pct':100}
            async def threshold(route): await route.fulfill(status=200, json=fixture)
            await page.route('**/api/today*', threshold)
            await page.reload()
            await page.wait_for_timeout(700)
            text = await page.get_by_test_id('vp-bal-battery-row-entlade-ladeverh-ltnis-value').inner_text()
            check('MOCKED threshold '+str(charge), text==expected, text)
            await page.unroute('**/api/today*', threshold)
        await page.reload()
        await page.wait_for_timeout(500)
        check('No runtime errors', not runtime, runtime)
    except Exception as e:
        check('Harness completion', False, str(e))
    error_text = await page.evaluate("""() => { const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]')); return errorElements.map(el => el.textContent).join(', '); }""")
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    print('RESULT', sum(ok for _,ok in checks), '/', len(checks))
    return checks