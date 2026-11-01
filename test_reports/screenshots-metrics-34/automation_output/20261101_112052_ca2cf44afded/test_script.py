async def run_test(page, output_dir, page_url):
    import copy
    import json
    await page.set_viewport_size({'width':1920,'height':800})
    runtime=[]
    page.on('pageerror',lambda e:runtime.append(str(e)))
    try:
        response=await page.request.get('/api/live')
        assert response.status==200
        original=await response.json()
        fixture=copy.deepcopy(original)
        fixture['ahoy']['total_power']=750
        fixture['victron']['total_power']=100
        for m in fixture['victron']['mppts']:m['pv_power']=50
        fixture['trucki'].update({'battery_power':-700,'ac_display_w':700,'soc':40,'max_power_w':800})
        fixture['shelly']['total_power']=350
        fixture['summary'].update({'pv_power':850,'pv_ac_power':750,'pv_dc_power':100,'grid_power':350,'battery_power':-600,'battery_charge_w':100,'battery_discharge_w':700,'battery_soc':40,'house_power':1800})
        async def controlled(route):
            await route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture))
        await page.route('**/api/live',controlled)
        await page.reload()
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.wait_for_timeout(150)
        for key,expected in {'flow-battery-power':'−600W','device-card-battery-value':'−600','flow-grid-power':'+350W','device-card-grid-value':'+350'}.items():
            actual=await page.get_by_test_id(key).text_content()
            print(('PASS ' if actual==expected else 'FAIL ')+key,actual)
        actual=await page.get_by_test_id('flow-battery-peak').text_content()
        print(('PASS ' if 'Entladen' in actual else 'FAIL ')+'net battery direction must be Entladen',actual)
        await page.get_by_test_id('flow-battery').hover()
        print('BATTERY INSPECTOR',await page.get_by_test_id('flow-inspector').text_content())
        await page.mouse.move(0,0)
        for invalid in [None,0,'not-a-number']:
            fixture['trucki']['max_power_w']=invalid
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            for key in ['flow-sun2000-peak','device-card-battery-peak','trucki-peak']:
                actual=await page.get_by_test_id(key).text_content()
                print(('PASS ' if 'Nenn –' in actual else 'FAIL ')+str(invalid)+' missing/invalid nominal '+key,actual)
        fixture['ahoy']['total_power']=2000
        fixture['victron']['total_power']=5000
        fixture['victron']['mppts'][0]['pv_power']=2500
        fixture['victron']['mppts'][1]['pv_power']=2500
        fixture['summary'].update({'pv_ac_power':2000,'pv_dc_power':5000,'pv_power':7000,'battery_power':4300,'battery_charge_w':5000,'grid_power':-900})
        fixture['shelly']['total_power']=-900
        async with page.expect_response(lambda r:r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        for key in ['flow-hoymiles-percent','flow-victron-percent','device-card-solar-percent','device-metric-mppt-1-percent','device-metric-mppt-2-percent','victron-total-percent']:
            actual=await page.get_by_test_id(key).text_content()
            print(('PASS ' if actual.replace('%','').strip()=='100' else 'FAIL ')+'clamped utilization '+key,actual)
        print('GRID EXPORT SIGN',await page.get_by_test_id('flow-grid-power').text_content())
        await page.get_by_test_id('flow-view-compact').click(force=True)
        print('COMPACT CLAMP',await page.get_by_test_id('flow-pv-percent').text_content())
        fixture['ahoy']['total_power']=None
        fixture['victron']['mppts'][0]['pv_power']=None
        fixture['trucki']['soc']=None
        fixture['summary']['battery_soc']=None
        async with page.expect_response(lambda r:r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        for key in ['device-metric-hoymiles-power','device-metric-hoymiles-percent','device-metric-mppt-1-power','device-metric-mppt-1-percent','victron-1-percent','device-card-battery-percent','flow-battery-percent','trucki-soc']:
            actual=await page.get_by_test_id(key).text_content()
            expected='–' if key!='trucki-soc' else '–%'
            print(('PASS ' if actual==expected else 'FAIL ')+'missing values '+key,actual)
        text=await page.get_by_test_id('dashboard').text_content()
        print('NO NaN/Infinity', 'NaN' not in text and 'Infinity' not in text)
        print('RUNTIME ERRORS',runtime)
        error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        print('FAIL edge tests',str(e))
