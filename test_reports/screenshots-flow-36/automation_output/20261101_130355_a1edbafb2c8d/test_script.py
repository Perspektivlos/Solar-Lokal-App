async def run_test(page, output_dir, page_url):
    import math
    results=[]
    responses=[]
    errors=[]
    def check(name,ok,actual=''):
        results.append(bool(ok))
        print(('PASS ' if ok else 'FAIL ')+name+': '+str(actual))
    def number(t):
        return float(t.replace('W','').replace('%','').replace('.','').replace(',','.').replace('−','-').strip())
    def percent(p,peak):
        return math.floor(max(0,min(100,abs(p)/peak*100))+.5)
    async def record(r):
        if r.url.endswith('/api/live') and r.status==200:
            responses.append(await r.json())
    page.on('response',record)
    page.on('pageerror',lambda e:errors.append(str(e)))
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.reload()
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.wait_for_timeout(200)
        texts=await page.evaluate('Object.fromEntries([...document.querySelectorAll("[data-testid]")].map(e=>[e.dataset.testid,e.textContent.trim()]))')
        candidates=[d for d in responses if round(d['summary']['pv_ac_power'])==number(texts['flow-hoymiles-power']) and round(d['summary']['battery_power'])==number(texts['flow-battery-power']) and round(d['summary']['grid_power'])==number(texts['flow-grid-power'])]
        assert candidates,'No matching rendered response'
        data=candidates[-1]
        s,a,t,v=(data[k] for k in ('summary','ahoy','trucki','victron'))
        expected={'flow-hoymiles-power':round(s['pv_ac_power']),'flow-hoymiles-percent':percent(s['pv_ac_power'],1500),'flow-victron-power':round(s['pv_dc_power']),'flow-victron-percent':percent(s['pv_dc_power'],3480),'flow-battery-power':round(s['battery_power']),'flow-battery-percent':math.floor(s['battery_soc']+.5),'flow-sun2000-power':round(s['battery_discharge_w']),'flow-sun2000-percent':math.floor(s['battery_soc']+.5),'flow-grid-power':round(s['grid_power']),'device-card-solar-value':round(s['pv_power']),'device-card-solar-percent':percent(s['pv_power'],4980),'device-card-battery-value':round(s['battery_power']),'device-card-battery-percent':math.floor(t['soc']+.5),'device-card-grid-value':round(s['grid_power']),'device-metric-hoymiles-power':round(a['total_power']),'device-metric-hoymiles-percent':percent(a['total_power'],1500),'trucki-power':round(t['battery_power']),'trucki-soc':math.floor(t['soc']+.5),'victron-total-power':round(v['total_power']),'victron-total-percent':percent(v['total_power'],3480),'shelly-total-power':s['grid_power']}
        for i,m in enumerate(v['mppts']):
            for prefix in (f'device-metric-mppt-{i+1}',f'victron-{m["id"]}'):
                expected[prefix+'-power']=round(m['pv_power'])
                expected[prefix+'-percent']=percent(m['pv_power'],[1700,1780][i])
        for key,value in expected.items():
            check(key,abs(number(texts[key])-value)<.11,texts[key])
        for cycle in range(2):
            async with page.expect_response(lambda r:r.url.endswith('/api/live') and r.status==200) as info:
                pass
            latest=await (await info.value).json()
            await page.wait_for_timeout(150)
            check('real demo polling '+str(cycle+1),number(await page.get_by_test_id('flow-hoymiles-power').text_content())==round(latest['summary']['pv_ac_power']))
        check('beams do not cross node housings',await page.get_by_test_id('energy-flow-svg').evaluate('''s=>{const boxes=[...s.querySelectorAll(':scope>g[data-testid]')].map(g=>{const r=g.querySelector('rect[fill="url(#nodeFill)"]');return {x:+r.getAttribute('x'),y:+r.getAttribute('y'),w:+r.getAttribute('width'),h:+r.getAttribute('height')}});return [...s.querySelectorAll('.flow-light-beam')].every(p=>{const l=p.getTotalLength();for(let i=0;i<=100;i++){const q=p.getPointAtLength(l*i/100);if(boxes.some(b=>q.x>b.x&&q.x<b.x+b.w&&q.y>b.y&&q.y<b.y+b.h))return false;}return true;})}'''))
        await page.get_by_test_id('flow-view-compact').click(force=True)
        check('desktop compact topology',await page.get_by_test_id('flow-pv').count()==1 and await page.get_by_test_id('flow-hoymiles').count()==0)
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_test_id('flow-view-detail').click(force=True)
        check('mobile detail selectable',await page.get_by_test_id('flow-hoymiles').count()==1 and await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await page.get_by_test_id('flow-view-auto').click(force=True)
        check('mobile auto restored',await page.get_by_test_id('flow-pv').count()==1)
        check('unique test IDs',await page.evaluate('(()=>{const a=[...document.querySelectorAll("[data-testid]")].map(e=>e.dataset.testid);return new Set(a).size===a.length})()'))
        check('no runtime errors',not errors,errors)
        error_text=await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');}''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        check('script execution',False,str(e))
    print('RESULT '+str(sum(results))+'/'+str(len(results)))
