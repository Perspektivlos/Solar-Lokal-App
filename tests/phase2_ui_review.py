"""Read-only Phase2 UI review; telemetry/error cases are browser-only MOCKED."""
import json

async def run(page):
    base = page.url.split('/smartshunt-phase2')[0]
    results=[]
    async def check(label, fn):
        try:
            await fn()
            results.append((label,True)); print('PASS',label)
        except Exception as e:
            results.append((label,False)); print('FAIL',label,str(e))
    async def require(condition, message='assertion failed'):
        assert condition, message
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    views=[('dashboard','phase2-dashboard-view'),('energiefluss','phase2-energy-view'),('geraete','phase2-devices-view'),('diagnose','phase2-diagnostics-view'),('verlauf','phase2-history-view')]
    for width,height in [(1920,1080),(390,844)]:
        await page.set_viewport_size({'width':width,'height':height})
        for tab,view in views:
            try:
                await page.get_by_test_id('phase2-nav-'+tab).click(force=True)
                await page.get_by_test_id(view).wait_for(timeout=15000)
                await page.wait_for_timeout(6500)
                await require(await page.get_by_test_id(view).is_visible(),'refresh changed view')
                await require(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'horizontal overflow')
                audit=await page.evaluate('''() => {const els=[...document.querySelectorAll('[data-testid]')];const ids=els.map(e=>e.dataset.testid);return {duplicates:ids.filter((x,i)=>ids.indexOf(x)!==i),missing:[...document.querySelectorAll('button,a,input,select')].filter(e=>!e.dataset.testid).map(e=>e.textContent)}}''')
                await require(not audit['duplicates'],str(audit))
                await require(not audit['missing'],str(audit))
                print('PASS layout/nav/polling/testids',width,tab);results.append((f'{width}-{tab}',True))
                if width==390 and tab=='energiefluss':
                    await page.screenshot(path='/app/test_reports/phase2-mobile-energy-41.jpeg',quality=40,full_page=False)
            except Exception as e:
                print('FAIL layout/nav/polling/testids',width,tab,str(e));results.append((f'{width}-{tab}',False))
    await page.set_viewport_size({'width':1920,'height':1080})
    await page.get_by_test_id('phase2-nav-energiefluss').click(force=True)
    await page.get_by_test_id('flow-battery').wait_for()
    async def flow_controls():
        for mode in ['compact','detail','auto']:
            await page.get_by_test_id('flow-view-'+mode).click(force=True)
            await require(await page.get_by_test_id('energy-flow-svg').is_visible())
        await page.get_by_test_id('flow-tempo-2').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        if await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='true':
            await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await require(await page.locator('[data-testid^="flow-photons-"]').count()==0)
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.get_by_test_id('flow-battery').hover()
        await require('SMARTSHUNT' in (await page.get_by_test_id('flow-inspector-title').inner_text()).upper())
        await page.get_by_test_id('flow-sun2000').hover()
        await require('TRUCKI' in (await page.get_by_test_id('flow-inspector-title').inner_text()).upper())
    await check('flow controls and source inspectors',flow_controls)
    await page.get_by_test_id('phase2-nav-diagnose').click(force=True)
    async def probe():
        await page.get_by_test_id('smartshunt-probe-button').click(force=True)
        await require(await page.get_by_test_id('smartshunt-probe-button').is_disabled())
        await page.get_by_test_id('smartshunt-probe-result').wait_for(timeout=20000)
        print('REAL CLOUD PROBE:',await page.get_by_test_id('smartshunt-probe-verdict').inner_text(),await page.get_by_test_id('smartshunt-probe-reason').inner_text())
    await check('local read-only probe gives structured cloud failure',probe)
    await page.get_by_test_id('phase2-nav-verlauf').click(force=True)
    async def ranges():
        for span in ['1h','3h','6h','12h','24h']:
            async with page.expect_response(lambda r: '/api/smartshunt-phase2/history' in r.url and 'range='+span in r.url):
                await page.get_by_test_id('phase2-range-'+span).click(force=True)
            await require(await page.get_by_test_id('phase2-range-'+span).get_attribute('aria-pressed')=='true')
        await require(await page.locator('[data-testid^="phase2-day-"]').count()==10)
        await require(await page.get_by_test_id('phase2-chart-dc-ac').is_visible())
        await require(await page.get_by_test_id('phase2-chart-voltage-soc').is_visible())
    await check('five history ranges/two charts/eight values',ranges)
    async def fail_history(route): await route.fulfill(status=503,json={'detail':'TEST_failure'})
    await page.route('**/api/smartshunt-phase2/today',fail_history)
    await page.get_by_test_id('phase2-history-refresh').click(force=True)
    await page.get_by_test_id('phase2-history-error').wait_for()
    print('PASS history error visible');results.append(('history error',True))
    print('ON ERROR retained daily value:',await page.get_by_test_id('phase2-day-dc-charge').inner_text())
    await page.unroute('**/api/smartshunt-phase2/today',fail_history)
    await page.get_by_test_id('phase2-history-refresh').click(force=True)
    await page.get_by_test_id('phase2-history-error').wait_for(state='hidden')
    print('PASS history retry');results.append(('history retry',True))
    live=(await (await page.request.get(base+'/api/smartshunt-phase2/live')).json())
    for status in ['stale','unavailable']:
        payload=json.loads(json.dumps(live))
        payload['battery_dc']['status']=payload['smartshunt']['status']=status
        payload['summary']['battery_data_status']=status
        payload['battery_dc']['age_seconds']=payload['smartshunt']['age_seconds']=120 if status=='stale' else 240
        if status=='unavailable':
            for k in ['power_w','charge_w','discharge_w','voltage_v','current_a','soc_pct','time_to_go_s','consumed_ah']:payload['battery_dc'][k]=None
            for k in ['power_w','voltage_v','current_a','soc_pct','time_to_go_s','consumed_ah']:payload['smartshunt'][k]=None
            payload['smartshunt']['optional']={}
            for k in ['battery_power','battery_charge_w','battery_discharge_w','battery_soc','battery_voltage_v','battery_current_a']:payload['summary'][k]=None
        async def mocked_live(route,request,payload=payload):await route.fulfill(json=payload)
        await page.route('**/api/smartshunt-phase2/live',mocked_live)
        await page.get_by_test_id('phase2-nav-dashboard').click(force=True)
        await page.get_by_test_id('phase2-refresh-button').click(force=True)
        await page.wait_for_timeout(500)
        async def state_check():
            power=await page.get_by_test_id('phase2-kpi-battery-dc-value').inner_text()
            await require(('–' in power)==(status=='unavailable'),power)
            await require('–' not in await page.get_by_test_id('phase2-ac-output').inner_text())
            print('MOCKED',status,await page.get_by_test_id('phase2-battery-status').inner_text())
        await check(status+' dashboard masking and independent AC',state_check)
        await page.get_by_test_id('phase2-nav-energiefluss').click(force=True)
        await page.get_by_test_id('flow-battery').hover()
        text=await page.get_by_test_id('flow-inspector').inner_text()
        print('MOCKED',status,'battery inspector:',text)
        if status=='unavailable':
            await check('unavailable inspector must not display zero DC power',lambda:require('0 W' not in text,text))
        await page.unroute('**/api/smartshunt-phase2/live',mocked_live)
    async def empty_today(route):
        d=(await (await page.request.get(base+'/api/smartshunt-phase2/today')).json())
        for k in d:
            if k.endswith('_kwh'):d[k]=0
        d.update(measurement_available=False,measured_duration_s=0,sample_count=0)
        await route.fulfill(json=d)
    await page.route('**/api/smartshunt-phase2/today',empty_today)
    await page.get_by_test_id('phase2-nav-verlauf').click(force=True)
    await page.wait_for_timeout(600)
    empty_text=await page.get_by_test_id('phase2-day-dc-charge').inner_text()
    await check('missing today measurements must display dash',lambda:require('–' in empty_text,empty_text))
    await page.unroute('**/api/smartshunt-phase2/today',empty_today)
    for path in ['/','/verlauf','/geraete','/diagnose','/steuerung','/smartshunt-preview']:
        try:
            await page.goto(base+path)
            await page.wait_for_timeout(1600)
            await require(await page.locator('main').count()>0 or await page.get_by_test_id('smartshunt-preview-page').count()>0)
            await require(await page.locator('a[href^="/smartshunt-phase2"]').count()==0)
            print('PASS regression route',path);results.append((path,True))
        except Exception as e:print('FAIL regression',path,str(e));results.append((path,False))
    cfg=await (await page.request.get(base+'/api/config')).json()
    if cfg['demo_mode']:
        await page.goto(base+'/steuerung')
        await page.get_by_test_id('control-loaded-at').wait_for()
        async def demo_control():
            await page.get_by_test_id('tru-limit-send').click(force=True)
            await page.get_by_test_id('control-trucki').get_by_test_id('control-result').wait_for()
            await page.wait_for_timeout(300)
            await require('"demo": true' in await page.get_by_test_id('control-trucki').get_by_test_id('control-result').inner_text())
        await check('unchanged Trucki demo setpoint submit',demo_control)
    await check('no browser runtime exceptions',lambda:require(not errors,str(errors)))
    error_text=await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}''')
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    print('RESULTS',json.dumps(results))