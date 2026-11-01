async def run_test(page, output_dir, page_url):
    import math
    await page.set_viewport_size({'width':1920,'height':800})
    runtime=[]
    page.on('pageerror', lambda e: runtime.append(str(e)))
    checks=[]
    def check(name, condition, actual=None):
        checks.append(condition)
        print(('PASS ' if condition else 'FAIL ') + name + (f': {actual}' if actual is not None else ''))
    def num(text):
        return float(text.replace('W','').replace('%','').replace('.','').replace(',','.').replace('−','-').strip())
    def pct(p, peak):
        return math.floor(max(0,min(100,abs(p)/peak*100))+0.5)
    try:
        async with page.expect_response(lambda r: r.url.endswith('/api/live') and r.status==200) as info:
            await page.reload()
        data=await (await info.value).json()
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.wait_for_timeout(150)
        texts=await page.evaluate("Object.fromEntries([...document.querySelectorAll('[data-testid]')].map(e=>[e.dataset.testid,e.textContent.trim()]))")
        s=data['summary']; a=data['ahoy']; t=data['trucki']; v=data['victron']
        specs={
          'flow-hoymiles-power':round(s['pv_ac_power']), 'flow-hoymiles-percent':pct(s['pv_ac_power'],1500),
          'flow-victron-power':round(s['pv_dc_power']), 'flow-victron-percent':pct(s['pv_dc_power'],3480),
          'flow-battery-power':round(s['battery_power']), 'flow-battery-percent':math.floor(s['battery_soc']+0.5),
          'flow-sun2000-power':round(s['battery_discharge_w']), 'flow-sun2000-percent':math.floor(s['battery_soc']+0.5),
          'flow-grid-power':round(s['grid_power']),
          'device-card-solar-value':round(s['pv_power']), 'device-card-solar-percent':pct(s['pv_power'],4980),
          'device-card-battery-value':round(s['battery_power']), 'device-card-battery-percent':math.floor(t['soc']+0.5),
          'device-card-grid-value':round(s['grid_power']),
          'device-metric-hoymiles-power':round(a['total_power']), 'device-metric-hoymiles-percent':pct(a['total_power'],1500),
          'trucki-power':round(t['battery_power']), 'trucki-soc':math.floor(t['soc']+0.5),
          'victron-total-power':round(v['total_power']), 'victron-total-percent':pct(v['total_power'],3480),
          'shelly-total-power':s['grid_power']}
        for i,m in enumerate(v['mppts']):
            peak=[1700,1780][i]
            specs.update({f'device-metric-mppt-{i+1}-power':round(m['pv_power']),f'device-metric-mppt-{i+1}-percent':pct(m['pv_power'],peak),f'victron-{m["id"]}-power':round(m['pv_power']),f'victron-{m["id"]}-percent':pct(m['pv_power'],peak)})
        for key,expected in specs.items():
            check(key,key in texts and abs(num(texts[key])-expected)<0.11,texts.get(key))
        for key,expected in {'flow-hoymiles-peak':'1.500 W','flow-victron-peak':'3.480 W','flow-battery-peak':'Nenn –','flow-sun2000-peak':'800 W','device-card-solar-peak':'4.980 W','device-card-battery-peak':'800 W','ahoy-peak':'1.500 W','victron-total-peak':'3.480 W','trucki-peak':'800 W'}.items():
            check(key,expected in texts[key],texts[key])
        for key in ['flow-grid-percent','device-card-grid-percent','shelly-total-percent']:
            check(key+' unavailable',texts[key]=='–')
        check('House has no invented percent','flow-house-percent' not in texts and 'device-card-house-percent' not in texts)
        check('VBAT retained','VBAT' in texts['card-trucki'])
        check('Hoymiles detail W + utilization','Total AC' in texts['ahoy-power-percent'] and 'Auslastung' in texts['ahoy-power-percent'])
        check('Desktop no horizontal page overflow',await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        collisions=await page.evaluate("""() => [...document.querySelectorAll('[data-testid^="flow-"][data-testid$="-power"]')].flatMap(p=>{const q=document.querySelector(`[data-testid="${p.dataset.testid.replace('-power','-percent')}"]`);if(!q)return [];const a=p.getBoundingClientRect(),b=q.getBoundingClientRect();return a.right>b.left?[p.dataset.testid]:[]})""")
        check('Flow power and percent do not overlap',len(collisions)==0,collisions)
        await page.get_by_test_id('energy-flow-svg').scroll_into_view_if_needed()
        await page.mouse.move(10,100)
        await page.screenshot(path='/app/test_reports/screenshots-metrics-34/automation_output/20261101_111956_ffc34cae0854/detail-desktop.jpeg', type="jpeg", quality=40, full_page=False)
        for node in ['hoymiles','victron','battery','sun2000','grid','house']:
            await page.get_by_test_id('flow-'+node).hover()
            await page.get_by_test_id('flow-inspector').wait_for()
            print('PASS inspector',node,await page.get_by_test_id('flow-inspector-title').text_content())
        await page.mouse.move(10,100)
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('Flow animation toggle off',await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='false')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.get_by_test_id('flow-tempo-2').click(force=True)
        check('Flow tempo changes',await page.get_by_test_id('flow-tempo-2').get_attribute('aria-pressed')=='true')
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        for cycle in range(2):
            async with page.expect_response(lambda r:r.url.endswith('/api/live') and r.status==200) as info:
                pass
            latest=await (await info.value).json()
            await page.wait_for_timeout(150)
            current=await page.get_by_test_id('flow-hoymiles-power').text_content()
            check('Live polling cycle '+str(cycle+1),num(current)==round(latest['summary']['pv_ac_power']),current)
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_test_id('flow-view-auto').click(force=True)
        await page.get_by_test_id('flow-pv').wait_for()
        check('Mobile compact PV peak','4.980 W' in await page.get_by_test_id('flow-pv-peak').text_content())
        p=num(await page.get_by_test_id('flow-pv-power').text_content()); percent=num(await page.get_by_test_id('flow-pv-percent').text_content())
        check('Mobile compact utilization',abs(percent-p/4980*100)<=0.6)
        check('Mobile no horizontal page overflow',await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
        await page.get_by_test_id('energy-flow-svg').scroll_into_view_if_needed()
        await page.mouse.move(0,0)
        await page.screenshot(path='/app/test_reports/screenshots-metrics-34/automation_output/20261101_111956_ffc34cae0854/compact-mobile.jpeg', type="jpeg", quality=40, full_page=False)
        await page.get_by_test_id('card-ahoy').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-metrics-34/automation_output/20261101_111956_ffc34cae0854/ahoy-mobile.jpeg', type="jpeg", quality=40, full_page=False)
        duplicates=await page.evaluate("""() => {const ids=[...document.querySelectorAll('[data-testid]')].map(e=>e.dataset.testid);return [...new Set(ids.filter((id,i)=>ids.indexOf(id)!==i))]}""")
        check('Unique test IDs',not duplicates,duplicates)
        check('No runtime errors',not runtime,runtime)
        error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        print('RESULT',sum(checks),'/',len(checks))
    except Exception as e:
        print('FAIL UI script',str(e))
