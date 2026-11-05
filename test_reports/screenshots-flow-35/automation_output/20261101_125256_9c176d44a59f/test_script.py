async def run_test(page, output_dir, page_url):
    import math
    results=[]
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def number(text):
        return float(text.replace('W','').replace('%','').replace('.','').replace(',','.').replace('−','-').strip())
    def percent(power,peak):
        return math.floor(max(0,min(100,abs(power)/peak*100))+.5)
    def check(label,ok,actual=''):
        results.append(bool(ok));print(f'{"PASS" if ok else "FAIL"} {label}: {actual}')
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        async with page.expect_response(lambda r:r.url.endswith('/api/live') and r.status==200) as pending:
            pass
        data=await (await pending.value).json()
        await page.wait_for_timeout(150)
        texts=await page.evaluate("Object.fromEntries([...document.querySelectorAll('[data-testid]')].map(e=>[e.dataset.testid,e.textContent.trim()]))")
        s,a,t,v=(data[k] for k in ['summary','ahoy','trucki','victron'])
        expected={'flow-hoymiles-power':round(s['pv_ac_power']),'flow-hoymiles-percent':percent(s['pv_ac_power'],1500),'flow-victron-power':round(s['pv_dc_power']),'flow-victron-percent':percent(s['pv_dc_power'],3480),'flow-battery-power':round(s['battery_power']),'flow-battery-percent':math.floor(s['battery_soc']+.5),'flow-sun2000-power':round(s['battery_discharge_w']),'flow-sun2000-percent':math.floor(s['battery_soc']+.5),'flow-grid-power':round(s['grid_power']),'device-card-solar-value':round(s['pv_power']),'device-card-solar-percent':percent(s['pv_power'],4980),'device-card-battery-value':round(s['battery_power']),'device-card-battery-percent':math.floor(t['soc']+.5),'device-card-grid-value':round(s['grid_power']),'device-metric-hoymiles-power':round(a['total_power']),'device-metric-hoymiles-percent':percent(a['total_power'],1500),'trucki-power':round(t['battery_power']),'trucki-soc':math.floor(t['soc']+.5),'victron-total-power':round(v['total_power']),'victron-total-percent':percent(v['total_power'],3480),'shelly-total-power':s['grid_power']}
        for i,m in enumerate(v['mppts']):
            for prefix in [f'device-metric-mppt-{i+1}',f'victron-{m["id"]}']:
                expected[prefix+'-power']=round(m['pv_power'])
                expected[prefix+'-percent']=percent(m['pv_power'],[1700,1780][i])
        for key,value in expected.items():
            check(key,abs(number(texts[key])-value)<.11,texts[key])
        check('no runtime errors',not errors,errors)
        print('Missing critical-value IDs (review):',await page.evaluate("({inspectorValuesWithoutIds:document.querySelectorAll('[data-testid=flow-inspector] dd:not([data-testid])').length})"))
        error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        check('script execution',False,str(e))
    print(f'RESULT {sum(results)}/{len(results)}')
