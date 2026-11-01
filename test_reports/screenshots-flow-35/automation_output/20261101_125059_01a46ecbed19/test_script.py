async def run_test(page, output_dir, page_url):
    import math
    import json
    results=[]
    errors=[]
    lives=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    async def record(r):
        if r.url.endswith('/api/live') and r.status==200:
            lives.append(await r.json())
    page.on('response',record)
    def check(label,ok,actual=''):
        results.append(bool(ok))
        print(f'{"PASS" if ok else "FAIL"} {label}: {actual}')
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        if await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')!='true':
            await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.wait_for_timeout(250)
        shape=await page.evaluate("[...document.querySelectorAll('[data-testid^=flow-segments-]')].map(g=>({id:g.dataset.testid,paths:g.querySelectorAll('path').length,circles:g.querySelectorAll('circle').length,n:g.querySelectorAll('animateMotion').length,rotate:g.querySelector('animateMotion').getAttribute('rotate')}))")
        check('angular segments, no photons',len(shape)>0 and all(s['paths']==s['n']*2 and s['circles']==0 and s['rotate']=='auto' for s in shape),shape)
        async def position():
            return await page.evaluate("(()=>{const g=document.querySelector('[data-testid^=flow-segments-] > g');const m=g.getCTM();return [m.e,m.f,m.a,m.b]})()")
        p1=await position()
        await page.wait_for_timeout(350)
        p2=await position()
        check('measurable motion',math.hypot(p2[0]-p1[0],p2[1]-p1[1])>2,[p1,p2])
        base=float((await page.locator('[data-testid="flow-segments-hoymiles-house"] animateMotion').first.get_attribute('dur')).rstrip('s'))
        for t,key in [(1.5,'1_5'),(2,'2')]:
            await page.get_by_test_id('flow-tempo-'+key).click(force=True)
            dur=float((await page.locator('[data-testid="flow-segments-hoymiles-house"] animateMotion').first.get_attribute('dur')).rstrip('s'))
            check('tempo '+str(t),abs(dur-base/t)<=0.02 and await page.get_by_test_id('flow-tempo-'+key).get_attribute('aria-pressed')=='true' and await page.evaluate('localStorage.getItem("solar.flowTempo")')==str(t),dur)
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('flow off removes segments/CSS',await page.locator('[data-testid^="flow-segments-"]').count()==0 and await page.locator('[data-testid="energy-flow-svg"] .flow-particles').count()==0 and await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='false' and await page.evaluate('localStorage.getItem("solar.flowOn")')=='0')
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        check('persist after reload',await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='false' and await page.get_by_test_id('flow-tempo-2').get_attribute('aria-pressed')=='true')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('flow reactivation',await page.locator('[data-testid^="flow-segments-"]').count()>0)
        await page.emulate_media(reduced_motion='reduce')
        await page.wait_for_timeout(250)
        check('system reduced SMIL/CSS',await page.locator('[data-testid="energy-flow-svg"] animateMotion').count()==0 and await page.locator('[data-testid="energy-flow-svg"] .flow-particles').count()==0 and await page.locator('[data-testid="energy-flow-svg"] animateTransform').count()==0)
        await page.emulate_media(reduced_motion='no-preference')
        await page.wait_for_timeout(250)
        check('system motion restored',await page.locator('[data-testid^="flow-segments-"]').count()>0)
        await page.evaluate('localStorage.setItem("solar.motionPref","on")')
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        check('manual reduced motion',await page.locator('[data-testid="energy-flow-svg"] animateMotion').count()==0 and await page.locator('[data-testid="energy-flow-svg"] .flow-particles').count()==0)
        await page.evaluate('localStorage.setItem("solar.motionPref","auto")')
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        await page.evaluate('document.fonts.ready')
        font=await page.evaluate("({loaded:[...document.fonts].some(f=>f.family==='DSEG7-Classic'&&f.status==='loaded'),values:[...document.querySelectorAll('[data-testid=energy-flow-svg] text[data-testid$=power],[data-testid=energy-flow-svg] text[data-testid$=percent],[data-testid=flow-battery-soc-ring]')].map(e=>getComputedStyle(e).fontFamily)})")
        check('DSEG loaded on numeric values and ring',font['loaded'] and all('DSEG7-Classic' in x and 'JetBrains Mono' in x for x in font['values']),font)
        for node in ['hoymiles','victron','battery','sun2000','grid','house']:
            await page.get_by_test_id('flow-'+node).hover()
            await page.get_by_test_id('flow-inspector').wait_for()
            inspector=await page.get_by_test_id('flow-inspector').locator('dd').evaluate_all('(els)=>els.map(e=>getComputedStyle(e).fontFamily)')
            check('inspector '+node,all('DSEG7-Classic' in f for f in inspector))
        await page.get_by_test_id('flow-hoymiles').hover()
        pill=await page.evaluate("[...document.querySelectorAll('[data-testid=energy-flow-svg] > g > text:not([data-testid])')].filter(e=>e.textContent.endsWith(' W')).map(e=>getComputedStyle(e).fontFamily)")
        check('hover watt pill DSEG',len(pill)>0 and all('DSEG7-Classic' in f for f in pill),pill)
        await page.mouse.move(0,0)
        bg=await page.evaluate("['flowPanelBg','bggrid','scadaScan'].map(id=>document.querySelectorAll('[data-testid=energy-flow-svg] rect[fill=\"url(#'+id+')\"]').length)")
        check('background gradient grid scanlines',bg==[1,1,1],bg)
        duplicates=await page.evaluate("(()=>{const a=[...document.querySelectorAll('[data-testid]')].map(e=>e.dataset.testid);return [...new Set(a.filter((s,i)=>a.indexOf(s)!==i))]})()")
        check('all test IDs unique',not duplicates,duplicates)
        bounds=await page.evaluate("[...document.querySelectorAll('[data-testid=energy-flow-svg] text[data-testid$=power]')].map(e=>{const b=e.getBBox(),p=e.parentElement.querySelector('text[data-testid$=percent]');const c=p?.getBBox();return {id:e.dataset.testid,powerRight:b.x+b.width,percentLeft:c?.x,overlap:c?b.x+b.width>c.x:false}})")
        check('power/percentage nonoverlap',not any(x['overlap'] for x in bounds),bounds)
        for view,count in [('compact',5),('detail',6),('auto',6)]:
            await page.get_by_test_id('flow-view-'+view).click(force=True)
            nodes=await page.evaluate("[...document.querySelectorAll('[data-testid=energy-flow-svg] > g[data-testid]')].filter(e=>!e.dataset.testid.startsWith('flow-segments-')).length")
            check('view '+view,nodes==count and await page.get_by_test_id('flow-view-'+view).get_attribute('aria-pressed')=='true',nodes)
        for i in range(2):
            async with page.expect_response(lambda r:r.url.endswith('/api/live') and r.status==200) as pending:
                pass
            data=await (await pending.value).json()
            await page.wait_for_timeout(100)
            value=await page.get_by_test_id('flow-hoymiles-power').text_content()
            check('live poll '+str(i+1),float(value.replace('W','').replace('.','').replace(',','.'))==round(data['summary']['pv_ac_power']),value)
        for width,height in [(1920,800),(390,844)]:
            await page.set_viewport_size({'width':width,'height':height})
            await page.get_by_test_id('flow-view-auto').click(force=True)
            await page.wait_for_timeout(200)
            await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
            check('page overflow '+str(width),await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            clipping=await page.evaluate("(()=>{const svg=document.querySelector('[data-testid=energy-flow-svg]'),v=svg.viewBox.baseVal;return [...svg.querySelectorAll(':scope > g[data-testid]')].map(g=>({id:g.dataset.testid,b:g.getBBox()})).filter(x=>x.b.x<0||x.b.y<0||x.b.x+x.b.width>v.width||x.b.y+x.b.height>v.height).map(x=>x.id)})()")
            check('node clipping '+str(width),not clipping,clipping)
            await page.screenshot(path='/app/test_reports/screenshots-flow-35/automation_output/20261101_125059_01a46ecbed19/flow-.jpeg'+str(width, type="jpeg", quality=40)+'.jpeg', quality=40, full_page=False)
        # Explicit MOCKED browser-only edge fixture; application and physical devices unchanged.
        fixture=lives[-1] if lives else await (await page.request.get(page.url.rstrip('/')+'/api/live')).json()
        fixture['summary'].update({'pv_ac_power':100,'grid_power':-700})
        async def controlled(route):
            await route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture))
        await page.route('**/api/live',controlled)
        await page.set_viewport_size({'width':1920,'height':800})
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        for watts,n in [(100,1),(400,2),(1000,3),(2000,4)]:
            fixture['summary']['pv_ac_power']=watts
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(100)
            group=page.get_by_test_id('flow-segments-hoymiles-house')
            d=float((await group.locator('animateMotion').first.get_attribute('dur')).rstrip('s'))
            check('watts density/speed '+str(watts),await group.locator('animateMotion').count()==n and abs(d-(2.4-watts/3000*1.8))<0.02,{'n':await group.locator('animateMotion').count(),'dur':d})
        for grid,reverse in [(-700,True),(700,False)]:
            fixture['summary']['grid_power']=grid
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(100)
            info=await page.get_by_test_id('flow-segments-grid-house').locator('animateMotion').first.evaluate("e=>{const p=e.getAttribute('path').match(/[\\d.]+/g).map(Number);return {p,reverse:e.parentElement.parentElement.parentElement.querySelector('.flow-particles').classList.contains('reverse'),color:e.parentElement.querySelector('path').getAttribute('fill')}}")
            check('grid path direction '+str(grid),(info['p'][0]>info['p'][2])==reverse and info['reverse']==reverse and info['color']==('#10B981' if reverse else '#F87171'),info)
            # Compare path progress to elapsed SVG time to handle segment wrapping.
            await page.evaluate("document.querySelector('[data-testid=energy-flow-svg]').setCurrentTime(0.2)")
            start=await page.get_by_test_id('flow-segments-grid-house').locator('g').first.evaluate('e=>{const m=e.getCTM();return [m.e,m.f]}')
            await page.wait_for_timeout(100)
            end=await page.get_by_test_id('flow-segments-grid-house').locator('g').first.evaluate('e=>{const m=e.getCTM();return [m.e,m.f]}')
            check('grid actual motion '+str(grid),(end[0]<start[0])==reverse and abs(end[0]-start[0])>1,[start,end])
        check('no runtime errors',not errors,errors)
        error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        await page.unroute('**/api/live',controlled)
    except Exception as e:
        check('script execution',False,str(e))
    print(f'RESULT {sum(results)}/{len(results)}')
