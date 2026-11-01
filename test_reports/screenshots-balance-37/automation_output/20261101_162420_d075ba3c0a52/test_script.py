async def run_test(page, output_dir, page_url):
    import asyncio
    import re
    from urllib.parse import urlparse, parse_qs
    checks = []
    snapshots = {}
    runtime = []
    page.on('pageerror', lambda e: runtime.append(str(e)))
    async def capture(response):
        if urlparse(response.url).path == '/api/today' and response.status == 200:
            key = parse_qs(urlparse(response.url).query).get('day_offset', ['0'])[0]
            snapshots[key] = await response.json()
    page.on('response', capture)
    def check(label, valid, detail=''):
        checks.append((label, bool(valid)))
        print(('PASS: ' if valid else 'FAIL: ') + label + ' ' + str(detail))
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.reload()
        await page.get_by_test_id('history-page').wait_for(timeout=20000)
        for _ in range(40):
            if '0' in snapshots and '1' in snapshots: break
            await page.wait_for_timeout(100)
        await page.wait_for_timeout(400)
        check('Real today and yesterday captured', '0' in snapshots and '1' in snapshots)
        actual = await page.locator('[data-testid]').evaluate_all('(els) => Object.fromEntries(els.map(e => [e.dataset.testid,e.textContent]))')
        d = snapshots['0']; y = snapshots['1']
        def num(s):
            return float(re.search(r'[−+]?\d+(?:[.,]\d+)?', s.replace('.', '').replace('−','-')).group(0).replace(',','.'))
        fields = {'vp-bal-pv-value':'pv_kwh','vp-bal-house-value':'consumption_kwh','vp-bal-battery-value':'battery_discharge_kwh','vp-bal-grid-value':'grid_import_kwh','vp-bal-pv-row-direkt-zum-haus-value':'pv_direct_kwh','vp-bal-pv-row-in-akku-geladen-value':'battery_charge_kwh','vp-bal-pv-row-pv-netzeinspeisung-value':'pv_export_kwh','vp-bal-house-row-aus-solar-direkt-value':'pv_direct_kwh','vp-bal-house-row-aus-batteriespeicher-value':'battery_to_house_kwh','vp-bal-house-row-aus-ffentlichem-netz-value':'grid_import_kwh','vp-bal-battery-row-ladung-kumuliert-value':'battery_charge_kwh','vp-bal-battery-row-davon-zum-haus-value':'battery_to_house_kwh','vp-bal-battery-row-davon-ins-netz-value':'battery_export_kwh','vp-bal-grid-row-netzeinspeisung-value':'grid_export_kwh'}
        for testid, field in fields.items():
            displayed = num(actual[testid]); expected = round(d[field],2)
            if testid == 'vp-bal-grid-row-netzeinspeisung-value': expected = -expected
            check('API matches '+testid, abs(displayed-expected)<0.006, [displayed,expected])
        check('Net saldo exact', abs(num(actual['vp-bal-grid-row-netto-netzsaldo-value'])-round(d['grid_import_kwh']-d['grid_export_kwh'],2))<0.006)
        check('Ratio correct label', 'Entlade-/Ladeverhältnis' in actual['vp-bal-battery'] and 'Round-Trip' not in actual['vp-bal-battery'])
        check('Ratio matches API', abs(num(actual['vp-bal-battery-row-entlade-ladeverh-ltnis-value'])-d['battery_discharge_charge_pct'])<0.06)
        for prefix, labels in [('vp-dist-pv',['direkt','akku','netz']),('vp-dist-house',['solar','akku','netz'])]:
            check(prefix+' percentages sum 100', sum(num(actual[prefix+'-'+label]) for label in labels)==100)
            check(prefix+' no false warning', prefix+'-hint' not in actual)
        check('PV local legend', 'PV lokal genutzt' in actual['vp-balance-history-bars'])
        for testid, field in fields.items():
            deltaid = testid[:-5]+'delta'
            if deltaid not in actual: continue
            diff = d[field]-y[field]
            text = actual[deltaid]
            if abs(diff)<0.005: valid = 'unverändert' in text
            else: valid = abs(num(text)-round(diff,2))<0.006
            check('Yesterday delta '+field, valid, text)
        check('Desktop no overflow', await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        await page.get_by_test_id('vp-balance').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-balance-37/automation_output/20261101_162420_d075ba3c0a52/desktop.jpeg', type="jpeg", quality=40, full_page=False)
        count0 = len(checks)
        for rng in ['1h','3h','6h','12h','24h']:
            async with page.expect_response(lambda r: '/api/history?range='+rng in r.url and r.status==200) as pending:
                await page.get_by_test_id('vp-range-'+rng).click(force=True)
            response = await pending.value
            check('Range '+rng, (await response.json())['range']==rng)
        await page.get_by_test_id('vp-view-four').click(force=True)
        check('Four view selected', await page.get_by_test_id('vp-view-four').get_attribute('aria-pressed')=='true')
        await page.get_by_test_id('vp-view-multi').click(force=True)
        check('Multi view selected', await page.get_by_test_id('vp-view-multi').get_attribute('aria-pressed')=='true')
        async with page.expect_response(lambda r: urlparse(r.url).path=='/api/today' and 'day_offset=0' in r.url and r.status==200, timeout=10000):
            await page.wait_for_timeout(5300)
        check('Today polling continues', True)
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_timeout(400)
        check('Mobile no overflow', await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        await page.get_by_test_id('vp-balance').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-balance-37/automation_output/20261101_162420_d075ba3c0a52/mobile.jpeg', type="jpeg", quality=40, full_page=False)
        check('No runtime errors', not runtime, runtime)
    except Exception as e:
        check('Harness completion', False, str(e))
    error_text = await page.evaluate("""() => { const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]')); return errorElements.map(el => el.textContent).join(', '); }""")
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    print('RESULT',sum(ok for _,ok in checks),'/',len(checks), 'runtime',runtime)
