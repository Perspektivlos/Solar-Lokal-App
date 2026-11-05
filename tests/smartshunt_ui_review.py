"""SmartShunt preview tabs, error states, responsive layout and main-page regression."""
import copy
import json


async def run(page):
    base = page.url.split('/smartshunt-preview')[0]
    results = []
    runtime_errors = []
    writes = []
    page.on('pageerror', lambda error: runtime_errors.append(str(error)))
    page.on('request', lambda request: writes.append(request.url) if '/api/' in request.url and request.method not in ['GET', 'HEAD', 'OPTIONS'] else None)

    def check(name, condition, detail=''):
        results.append({'name':name, 'passed':bool(condition), 'detail':detail})
        print(f'{"PASS" if condition else "FAIL"}: {name} {detail}')

    async def layout(name):
        info = await page.evaluate("""() => {
          const ids=Array.from(document.querySelectorAll('[data-testid]')).map(e=>e.dataset.testid);
          const controls=Array.from(document.querySelectorAll('button,a,[role="tab"]')).filter(e=>e.getBoundingClientRect().width>0);
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,
            duplicates:ids.filter((id,i)=>ids.indexOf(id)!==i),
            missing:controls.filter(e=>!e.dataset.testid).map(e=>e.textContent),
            clipped:controls.filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1).map(e=>e.dataset.testid)};
        }""")
        check(name+' no page overflow', info['scroll'] <= info['width'], str(info))
        check(name+' unique testids and complete controls', not info['duplicates'] and not info['missing'] and not info['clipped'], str(info))

    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('smartshunt-tab-overview').wait_for(timeout=20000)
        response = await page.request.get(base+'/api/smartshunt/preview')
        original = await response.json()
        for tab in ['overview','device','diagnostics','history']:
            await page.get_by_test_id('smartshunt-tab-'+tab).click(force=True)
            await page.get_by_test_id('smartshunt-'+tab+'-panel').wait_for()
            check('desktop '+tab+' loads', True)
            await page.wait_for_timeout(5300)
            check(tab+' survives auto-refresh', await page.get_by_test_id('smartshunt-tab-'+tab).get_attribute('data-state') == 'active')
            await layout('desktop '+tab)
        for range_name in ['1h','3h','6h','12h','24h']:
            async with page.expect_response(lambda r: '/api/smartshunt/history' in r.url and 'range='+range_name in r.url) as captured:
                await page.get_by_test_id('smartshunt-range-'+range_name).click(force=True)
            data = await (await captured.value).json()
            check('history range '+range_name, data['range']==range_name and len(data['points'])==96)
            check('range button '+range_name, await page.get_by_test_id('smartshunt-range-'+range_name).get_attribute('aria-pressed')=='true')
        await page.get_by_test_id('smartshunt-history-refresh').click(force=True)
        await page.wait_for_timeout(500)
        check('two charts render four curves', await page.locator('[data-testid="smartshunt-history-panel"] path.recharts-line-curve').count()==4)
        await page.screenshot(path='/app/test_reports/smartshunt-history-desktop.jpeg', quality=40, full_page=False)
        await page.get_by_test_id('smartshunt-refresh-button').click(force=True)
        await page.wait_for_timeout(400)
        check('manual preview refresh keeps history range', await page.get_by_test_id('smartshunt-range-24h').get_attribute('aria-pressed')=='true')
        await page.set_viewport_size({'width':390,'height':844})
        for tab in ['overview','device','diagnostics','history']:
            await page.get_by_test_id('smartshunt-tab-'+tab).click(force=True)
            await page.get_by_test_id('smartshunt-'+tab+'-panel').wait_for()
            await page.wait_for_timeout(400)
            await layout('mobile '+tab)
            await page.evaluate('window.scrollTo(0,0)')
            await page.screenshot(path='/app/test_reports/smartshunt-mobile-'+tab+'.jpeg', quality=40, full_page=False)
        check('preview sends no writes', not writes, str(writes))

        mock = copy.deepcopy(original)
        async def preview_mock(route):
            await route.fulfill(status=200, content_type='application/json', body=json.dumps(mock))
        await page.route('**/api/smartshunt/preview', preview_mock)
        async def refresh():
            await page.get_by_test_id('smartshunt-refresh-button').click(force=True)
            await page.wait_for_timeout(500)
        await page.get_by_test_id('smartshunt-tab-overview').click(force=True)
        mock['current'].update(status='stale', age_seconds=120, direction='discharging', power_w=-320, current_a=-6.08, time_to_go_s=3660)
        await refresh()
        check('MOCKED stale badge', await page.get_by_test_id('smartshunt-status-badge').inner_text()=='VERALTET')
        check('MOCKED negative means discharge', await page.get_by_test_id('smartshunt-direction').inner_text()=='Entladen' and '-320' in await page.get_by_test_id('smartshunt-power-value').inner_text())
        check('MOCKED runtime direct value', await page.get_by_test_id('smartshunt-time-to-go').inner_text()=='1 h 1 min')
        mock['current'].update(status='current', age_seconds=0, direction='charging', power_w=320, current_a=6.08)
        await refresh()
        check('MOCKED positive means charge', await page.get_by_test_id('smartshunt-direction').inner_text()=='Laden' and '+320' in await page.get_by_test_id('smartshunt-power-value').inner_text())
        check('source separation', 'Batteriemessung' in await page.get_by_test_id('smartshunt-source-role').inner_text() and 'AC-Regelung' in await page.get_by_test_id('trucki-source-role').inner_text())
        mock['current'].update(status='unavailable', age_seconds=181, direction='idle', voltage_v=None,current_a=None,power_w=None,soc_pct=None,time_to_go_s=None,consumed_ah=None)
        mock['current']['identity']['connected']=0
        mock['current']['alerts']=[{'code':'data_unavailable','label':'TEST_ Connected=0','severity':'critical','source':'data'}]
        await refresh()
        check('MOCKED unavailable badge', await page.get_by_test_id('smartshunt-status-badge').inner_text()=='NICHT VERFÜGBAR')
        for field in ['voltage','current','power','soc']:
            check('MOCKED unavailable hides '+field, await page.get_by_test_id('smartshunt-'+field+'-value').inner_text()=='–')
        check('MOCKED unavailable visual alarm', await page.get_by_test_id('smartshunt-alert-data_unavailable').is_visible())
        await page.get_by_test_id('smartshunt-tab-device').click(force=True)
        sensor=page.get_by_test_id('smartshunt-optional-temperature-c')
        check('MOCKED disconnected optional measurement masked', not await sensor.count() or (await sensor.inner_text()).startswith('–'), await sensor.inner_text() if await sensor.count() else '')
        check('MOCKED connected participates in verified identity', await page.get_by_test_id('smartshunt-identity-badge').inner_text()!='VERIFIZIERT')
        mock['current']['identity']['valid']=False
        await refresh()
        check('MOCKED wrong identity badge', await page.get_by_test_id('smartshunt-identity-badge').inner_text()=='NICHT BESTÄTIGT')
        mock['current']['optional']={}
        mock['current']['device_history']={'charge_cycles':777,'charged_energy_kwh':123.4}
        await refresh()
        check('MOCKED absent sensors hidden', await page.get_by_test_id('smartshunt-optional-empty').is_visible() and await sensor.count()==0)
        check('MOCKED native counters displayed directly', await page.get_by_test_id('smartshunt-counter-charge-cycles').inner_text()=='777' and '123,4' in await page.get_by_test_id('smartshunt-counter-charged-energy-kwh').inner_text())
        mock['events']=[{'ts':original['generated_at'],'event':'raised','code':'low_soc','label':'TEST_ niedriger SoC','severity':'warning'}]
        await refresh()
        await page.get_by_test_id('smartshunt-tab-diagnostics').click(force=True)
        check('MOCKED event visual only', await page.get_by_test_id('smartshunt-event-0-state').inner_text()=='Ausgelöst')
        check('diagnostics topic and raw checks', await page.get_by_test_id('smartshunt-diagnostic-topic').inner_text()==original['topic_base'] and await page.get_by_test_id('smartshunt-diagnostic-count').inner_text()=='7 Prüfungen')
        await page.unroute('**/api/smartshunt/preview', preview_mock)
        async def failure(route):
            await route.fulfill(status=503,content_type='application/json',body='{"detail":"TEST_ failure"}')
        await page.route('**/api/smartshunt/history*', failure)
        await page.get_by_test_id('smartshunt-tab-history').click(force=True)
        await page.get_by_test_id('smartshunt-history-error').wait_for()
        check('MOCKED history failure displayed', 'nicht geladen' in await page.get_by_test_id('smartshunt-history-error').inner_text())
        await page.unroute('**/api/smartshunt/history*', failure)
        await page.get_by_test_id('smartshunt-history-refresh').click(force=True)
        await page.wait_for_timeout(500)
        check('history failure recovery', await page.get_by_test_id('smartshunt-history-error').count()==0)
        await page.route('**/api/smartshunt/preview', failure)
        await refresh()
        check('MOCKED preview failure displayed', await page.get_by_test_id('smartshunt-preview-error').is_visible())
        await page.unroute('**/api/smartshunt/preview', failure)
        await refresh()
        check('preview failure recovery', await page.get_by_test_id('smartshunt-preview-error').count()==0)

        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('smartshunt-preview-back').click(force=True)
        await page.get_by_test_id('nav-menu').wait_for()
        check('no SmartShunt main navigation link', await page.get_by_test_id('nav-menu').locator('a[href="/smartshunt-preview"]').count()==0)
        for nav,path in [('dashboard','/'),('history','/verlauf'),('control','/steuerung'),('devices','/geraete'),('diagnose','/diagnose')]:
            await page.get_by_test_id('nav-'+nav).click(force=True)
            await page.wait_for_timeout(900)
            check('main route '+path+' loads', page.url==base+path and len(await page.locator('main').inner_text())>50)
        await page.get_by_test_id('nav-control').click(force=True)
        await page.get_by_test_id('control-loaded-at').wait_for()
        cfg = await (await page.request.get(base+'/api/config')).json()
        if cfg['demo_mode']:
            await page.get_by_test_id('tru-limit-send').click(force=True)
            await page.wait_for_timeout(500)
            check('Trucki UI demo control integration', '"demo": true' in await page.get_by_test_id('control-trucki').get_by_test_id('control-result').inner_text())
        check('no runtime exceptions', not runtime_errors, str(runtime_errors))
        error_text = await page.evaluate("""() => {
          const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
          return errorElements.map(el => el.textContent).join(', ');
        }""")
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as error:
        check('runner completed', False, str(error))
    print('RESULTS '+json.dumps(results,ensure_ascii=False))
    print(f'TOTAL {sum(r["passed"] for r in results)}/{len(results)}')