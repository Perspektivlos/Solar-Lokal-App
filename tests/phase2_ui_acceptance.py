"""Phase2 edge acceptance: browser-only MOCKED outages, sparse history and race; read-only app config."""
import asyncio
import copy
import json
from pathlib import Path
from playwright.async_api import expect


async def run(page):
    base=page.url.split('/smartshunt-phase2')[0]
    results=[]
    async def check(label,fn):
        try:
            await fn()
            results.append([label,True]);print('PASS',label)
        except Exception as exc:
            results.append([label,False]);print('FAIL',label,str(exc))
    async def phase1_failure():
        async def failure(route):await route.fulfill(status=503,json={'detail':'TEST_phase1_failure'})
        await page.route('**/api/smartshunt/preview',failure)
        try:
            for route,view in [('', 'dashboard'),('/energiefluss','energy'),('/geraete','devices'),('/verlauf','history'),('/diagnose','diagnostics')]:
                await page.goto(base+'/smartshunt-phase2'+route)
                await page.get_by_test_id('phase2-'+view+'-view').wait_for(timeout=15000)
                assert not await page.get_by_test_id('phase2-loading').count()
                assert not await page.get_by_test_id('phase2-error').count()
        finally:await page.unroute('**/api/smartshunt/preview',failure)
    await page.set_viewport_size({'width':1920,'height':800})
    await check('Phase1 503 never blocks all five direct Phase2 subroutes',phase1_failure)

    async def gap_curves():
        points=[]
        for minute in [0,5,30,35]:
            points.append({'ts':f'2026-01-01T00:{minute:02d}:00Z','status':'current','battery_dc_power_w':100+minute,'inverter_ac_power_w':90+minute,'battery_voltage_v':52+minute*.01,'battery_soc_pct':70+minute*.1})
        async def gap(route):await route.fulfill(json={'range':'6h','demo':True,'points':points})
        await page.route('**/api/smartshunt-phase2/history?*',gap)
        try:
            await page.goto(base+'/smartshunt-phase2/verlauf')
            await page.get_by_test_id('phase2-history-refresh').wait_for()
            await page.wait_for_timeout(500)
            for chart in ['dc-ac','voltage-soc']:
                paths=await page.get_by_test_id('phase2-chart-'+chart).locator('.recharts-line-curve').evaluate_all('(els)=>els.map(e=>e.getAttribute("d"))')
                assert len(paths)==2,paths
                assert all(p.count('M')==2 for p in paths),paths
                print('GAP PATHS',chart,paths)
            await page.screenshot(path='/app/test_reports/phase2-gap-45.jpeg',quality=40,full_page=False)
        finally:await page.unroute('**/api/smartshunt-phase2/history?*',gap)
    await check('>600s gaps break all four DC AC voltage SoC curves',gap_curves)

    async def history_outage():
        await page.goto(base+'/smartshunt-phase2/verlauf')
        await page.get_by_test_id('phase2-history-refresh').wait_for()
        await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
        async def failure(route):await route.fulfill(status=503,json={'detail':'TEST_history_failure'})
        await page.route('**/api/smartshunt-phase2/history?*',failure)
        try:
            await page.get_by_test_id('phase2-history-refresh').click(force=True)
            await page.get_by_test_id('phase2-history-error').wait_for()
            assert '–' in await page.get_by_test_id('phase2-day-ac-output').inner_text()
            assert await page.get_by_test_id('phase2-chart-dc-ac').locator('.recharts-line-curve').count()==0
        finally:await page.unroute('**/api/smartshunt-phase2/history?*',failure)
        await page.get_by_test_id('phase2-history-refresh').click(force=True)
        await page.get_by_test_id('phase2-history-error').wait_for(state='hidden')
        await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
        assert '–' not in await page.get_by_test_id('phase2-day-ac-output').inner_text(),await page.get_by_test_id('phase2-day-ac-output').inner_text()
        assert await page.get_by_test_id('phase2-chart-dc-ac').locator('.recharts-line-curve').count()==2
    await check('History 503 clears prior chart and today; retry restores',history_outage)

    async def independent_today():
        response=await page.request.get(base+'/api/smartshunt-phase2/today')
        today=await response.json()
        today.update(measurement_available=True,battery_dc_measurement_available=False,battery_dc_measured_duration_s=0,inverter_ac_measurement_available=True,inverter_ac_output_kwh=1.23)
        async def partial(route):await route.fulfill(json=today)
        await page.route('**/api/smartshunt-phase2/today',partial)
        try:
            await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
            await page.get_by_test_id('phase2-history-refresh').click(force=True)
            await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
            values=[await page.get_by_test_id('phase2-day-'+id).inner_text() for id in ['dc-charge','dc-discharge','ac-output']]
            assert '–' in values[0] and '–' in values[1] and '1,23' in values[2],values
        finally:await page.unroute('**/api/smartshunt-phase2/today',partial)
    await check('Missing DC daily coverage keeps independent AC value',independent_today)

    async def range_race():
        latest=asyncio.Event()
        slow_done=asyncio.Event()
        async def history(route,request):
            span=request.url.split('range=')[-1]
            if span=='1h':await asyncio.sleep(1.5)
            else:await asyncio.sleep(.1)
            powers=[800,0,800] if span=='1h' else [0,800,0]
            points=[{'ts':f'2026-01-01T00:{i*5:02d}:00Z','status':'current','battery_dc_power_w':p,'inverter_ac_power_w':p/2,'battery_voltage_v':52,'battery_soc_pct':70} for i,p in enumerate(powers)]
            await route.fulfill(json={'range':span,'demo':True,'points':points})
            if span=='3h':latest.set()
            if span=='1h':slow_done.set()
        await page.route('**/api/smartshunt-phase2/history?*',history)
        try:
            await page.get_by_test_id('phase2-range-1h').click(force=True)
            await page.wait_for_timeout(150)
            await page.get_by_test_id('phase2-range-3h').click(force=True)
            await asyncio.wait_for(latest.wait(),5)
            await page.wait_for_timeout(250)
            before=await page.get_by_test_id('phase2-chart-dc-ac').locator('.recharts-line-curve').first.get_attribute('d')
            await asyncio.wait_for(slow_done.wait(),5)
            await page.wait_for_timeout(250)
            after=await page.get_by_test_id('phase2-chart-dc-ac').locator('.recharts-line-curve').first.get_attribute('d')
            assert await page.get_by_test_id('phase2-range-3h').get_attribute('aria-pressed')=='true'
            assert before==after,(before,after)
        finally:await page.unroute('**/api/smartshunt-phase2/history?*',history)
    await check('Delayed 1h response cannot overwrite later 3h selection',range_race)

    async def canonical_labels():
        await page.goto(base+'/')
        await page.get_by_test_id('flow-sun2000').wait_for()
        for mode in ['compact','detail']:
            await page.get_by_test_id('flow-view-'+mode).evaluate('(e)=>e.scrollIntoView({block:"center"})')
            await page.get_by_test_id('flow-view-'+mode).click(force=True)
            text=(await page.get_by_test_id('flow-sun2000').text_content()).lower()
            assert 'sun-2000' in text and 'sun-2000 ac' not in text and 'entl.' in text,text
            assert 'smartshunt' not in (await page.get_by_test_id('flow-battery').text_content()).lower()
            await page.get_by_test_id('flow-house').evaluate('(e)=>e.scrollIntoView({block:"center"})')
            await page.get_by_test_id('flow-house').hover(force=True)
            labels=await page.get_by_test_id('flow-inspector').locator('dt').all_text_contents()
            assert 'aus Akku' in labels and 'aus Akku · AC' not in labels,labels
        await page.get_by_test_id('flow-view-auto').click(force=True)
    await check('Canonical Sun-2000 Entl. aus Akku labels unchanged',canonical_labels)
    async def history_auto_refresh():
        hits=[]
        def observe(request):
            if '/api/smartshunt-phase2/history' in request.url:hits.append(request.url)
        page.on('request',observe)
        try:
            await page.goto(base+'/smartshunt-phase2/verlauf')
            await page.get_by_test_id('phase2-history-view').wait_for()
            await expect(page.get_by_test_id('phase2-history-refresh')).to_be_enabled()
            initial=len(hits)
            await page.wait_for_timeout(62000)
            assert len(hits)>initial,(initial,len(hits))
            assert await page.get_by_test_id('phase2-range-6h').get_attribute('aria-pressed')=='true'
            print('HISTORY AUTO REFRESH requests',len(hits))
        finally:page.remove_listener('request',observe)
    await check('History 60-second automatic refresh retains selected range',history_auto_refresh)
    error_text=await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}''')
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    Path('/app/test_reports/ui_edge_results_45.json').write_text(json.dumps(results,indent=2))
    print('EDGE RESULTS',json.dumps(results))
    return results