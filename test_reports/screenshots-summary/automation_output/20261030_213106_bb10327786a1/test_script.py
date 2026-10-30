async def run_test(page, output_dir, page_url):
    samples={'today':[],'live':[]}
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    async def capture(response):
        key=response.url.split('/api/')[-1].split('?')[0]
        if key in samples and response.status==200:
            samples[key].append(await response.json())
    page.on('response',capture)
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('flow-summary').wait_for(state='visible',timeout=20000)
        assert await page.get_by_test_id('summary-battery-label').text_content()=='Akku verfügbar'
        assert 'Schätzwert' in await page.get_by_test_id('summary-battery-source').inner_text()
        assert await page.get_by_test_id('summary-autarky-label').text_content()=='Autarkie heute'
        for tile in ('pv','grid'):
            source=await page.get_by_test_id(f'summary-{tile}-source').inner_text()
            assert 'Simulierter Messverlauf seit 00:00 UTC' in source,source
        for tile in ('pv','grid','battery'):
            assert await page.get_by_test_id(f'summary-{tile}-unit').inner_text()=='kWh'
        assert await page.get_by_test_id('summary-autarky-unit').inner_text()=='%'
        print('PASS: correct labels, units, simulated measurement sources and battery estimate marker')
        counts={key:len(samples[key]) for key in samples}
        await page.wait_for_timeout(6500)
        for key in counts:
            assert len(samples[key])>=counts[key]+2,f'{key} polling stopped'
        assert samples['live'][-1]['timestamp'] != samples['live'][-2]['timestamp']
        assert await page.get_by_test_id('flow-summary').is_visible()
        assert await page.get_by_test_id('dashboard-error').count()==0
        today=samples['today'][-1]
        expected=await page.evaluate('''t=>({pv:t.pv_kwh.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}),grid:t.grid_import_kwh.toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2}),autarky:t.autarky_pct.toLocaleString('de-DE',{minimumFractionDigits:1,maximumFractionDigits:1})})''',today)
        for tile,value in expected.items():
            assert await page.get_by_test_id(f'summary-{tile}-value').inner_text()==value
        counters=sum(c['yield_day'] for c in samples['live'][-1]['ahoy']['channels'])+sum(m['yield_today'] for m in samples['live'][-1]['victron']['mppts'])
        pv_display=float((await page.get_by_test_id('summary-pv-value').inner_text()).replace('.','').replace(',','.'))
        assert abs(pv_display-counters)>0.01
        print(f'PASS: two further live/today polls, values synchronized; PV {pv_display} vs device counters {counters:.3f}')
        for width,height in ((1920,800),(390,844)):
            await page.set_viewport_size({'width':width,'height':height})
            await page.get_by_test_id('flow-summary').scroll_into_view_if_needed()
            await page.wait_for_timeout(250)
            bounds=await page.evaluate('''()=>{
                const tiles=[...document.querySelectorAll('[data-testid="flow-summary"] > div')];
                const clipped=tiles.flatMap(tile=>[...tile.querySelectorAll('[data-testid]')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.dataset.testid));
                const outside=[...document.querySelectorAll('[data-testid="flow-summary"] [data-testid]')].filter(el=>{const r=el.getBoundingClientRect();const t=el.closest('[data-testid="flow-summary"] > div').getBoundingClientRect();return r.right>t.right+1||r.left<t.left-1;}).map(el=>el.dataset.testid);
                return {viewport:innerWidth,document:document.documentElement.scrollWidth,clipped,outside};
            }''')
            print(f'Layout {width}x{height}: {bounds}')
            assert bounds['document']<=width,bounds
            assert not bounds['clipped'] and not bounds['outside'],bounds
            print(f'PASS: {width}x{height} no horizontal overflow or summary text clipping')
            await page.screenshot(path=f"/app/test_reports/screenshots-summary/automation_output/20261030_213106_bb10327786a1/flow_summary_{width}.jpeg", type="jpeg", quality=40, full_page=False)
        error_text=await page.evaluate('''()=>{
            const errorElements=Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));
            return errorElements.map(el=>el.textContent).join(', ');
        }''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        assert not errors,errors
        print('PASS: no browser runtime exceptions')
    except Exception as e:
        print(f'FAIL: remaining regression: {type(e).__name__}: {e}')
