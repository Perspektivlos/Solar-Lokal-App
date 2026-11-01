async def run_test(page, output_dir, page_url):
    import math
    await page.set_viewport_size({'width':1920,'height':800})
    responses=[]
    async def record(response):
        if response.url.endswith('/api/live') and response.status==200:
            responses.append(await response.json())
    page.on('response',record)
    def num(text):
        return float(text.replace('W','').replace('%','').replace('.','').replace(',','.').replace('−','-').strip())
    def pct(p,peak): return math.floor(max(0,min(100,abs(p)/peak*100))+0.5)
    try:
        await page.reload()
        await page.get_by_test_id('dashboard').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.wait_for_timeout(200)
        texts=await page.evaluate("Object.fromEntries([...document.querySelectorAll('[data-testid]')].map(e=>[e.dataset.testid,e.textContent.trim()]))")
        candidates=[d for d in responses if round(d['summary']['pv_ac_power'])==num(texts['flow-hoymiles-power']) and round(d['summary']['battery_power'])==num(texts['flow-battery-power']) and round(d['summary']['grid_power'])==num(texts['flow-grid-power'])]
        assert candidates, 'No matching response captured'
        d=candidates[-1];s=d['summary'];a=d['ahoy'];t=d['trucki'];v=d['victron']
        specs={'flow-hoymiles-power':round(s['pv_ac_power']),'flow-hoymiles-percent':pct(s['pv_ac_power'],1500),'flow-victron-power':round(s['pv_dc_power']),'flow-victron-percent':pct(s['pv_dc_power'],3480),'flow-battery-power':round(s['battery_power']),'flow-battery-percent':math.floor(s['battery_soc']+0.5),'flow-sun2000-power':round(s['battery_discharge_w']),'flow-sun2000-percent':math.floor(s['battery_soc']+0.5),'flow-grid-power':round(s['grid_power']),'device-card-solar-value':round(s['pv_power']),'device-card-solar-percent':pct(s['pv_power'],4980),'device-card-battery-value':round(s['battery_power']),'device-card-battery-percent':math.floor(t['soc']+0.5),'device-card-grid-value':round(s['grid_power']),'device-metric-hoymiles-power':round(a['total_power']),'device-metric-hoymiles-percent':pct(a['total_power'],1500),'trucki-power':round(t['battery_power']),'trucki-soc':math.floor(t['soc']+0.5),'victron-total-power':round(v['total_power']),'victron-total-percent':pct(v['total_power'],3480),'shelly-total-power':s['grid_power']}
        for i,m in enumerate(v['mppts']):
            peak=[1700,1780][i]
            specs.update({f'device-metric-mppt-{i+1}-power':round(m['pv_power']),f'device-metric-mppt-{i+1}-percent':pct(m['pv_power'],peak),f'victron-{m["id"]}-power':round(m['pv_power']),f'victron-{m["id"]}-percent':pct(m['pv_power'],peak)})
        failed=[]
        for key,expected in specs.items():
            ok=abs(num(texts[key])-expected)<0.11
            print(('PASS ' if ok else 'FAIL ')+key, texts[key],expected)
            if not ok:failed.append(key)
        print('EXACT LIVE METRICS',len(specs)-len(failed),'/',len(specs),'captured',len(responses),'responses')
        print('FLOW LABEL BOUNDS',await page.evaluate("""() => ['hoymiles','victron','battery','sun2000','grid'].map(id=>{const g=document.querySelector(`[data-testid="flow-${id}"]`),r=[...g.querySelectorAll('rect')].find(x=>x.getAttribute('width')==='205').getBBox(),p=g.querySelector(`[data-testid="flow-${id}-peak"]`).getBBox();return {id,overflowW:Math.max(0,p.x+p.width-r.x-r.width),beaconOverlap:p.x+p.width>r.x+r.width-16};})"""))
        print('AHOY INDIVIDUAL METRIC IDS',await page.get_by_test_id('ahoy-power').count(),await page.get_by_test_id('ahoy-percent').count())
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_test_id('card-ahoy').scroll_into_view_if_needed()
        print('AHOY MOBILE LABEL BOUNDS',await page.evaluate("""() => {const root=document.querySelector('[data-testid="ahoy-power-percent"]'),labels=[...root.querySelectorAll('div.font-sans')],peak=document.querySelector('[data-testid="ahoy-peak"]');return {labels:labels.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.scrollWidth,client:e.clientWidth})),peak:{x:peak.getBoundingClientRect().x,right:peak.getBoundingClientRect().right,y:peak.getBoundingClientRect().y}};}"""))
    except Exception as e:
        print('FAIL confirmation',str(e))
