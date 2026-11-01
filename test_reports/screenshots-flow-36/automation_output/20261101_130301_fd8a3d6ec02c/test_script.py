async def run_test(page, output_dir, page_url):
    import math,json
    results=[]
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def check(name,ok,actual=''):
        results.append(bool(ok))
        print(('PASS ' if ok else 'FAIL ')+name+': '+str(actual))
    async def pos(testid):
        return await page.get_by_test_id(testid).locator(':scope > g').first.evaluate('e=>{const m=e.getCTM();return [m.e,m.f]}')
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        if await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')!='true':
            await page.get_by_test_id('flow-toggle-anim').click(force=True)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        shape=await page.locator('[data-testid^="flow-photons-"]').evaluate_all('els=>els.map(g=>({id:g.dataset.testid,n:g.querySelectorAll("animateMotion").length,c:g.querySelectorAll("circle").length,p:g.querySelectorAll("path").length,r:g.querySelectorAll("animate[attributeName=r]").length,o:g.querySelectorAll("animate[attributeName=opacity]").length}))')
        check('round glowing photons',len(shape)>0 and all(s['c']==2*s['n'] and s['p']==0 and s['r']==s['n'] and s['o']==2*s['n'] for s in shape),shape)
        check('solid animated beams',await page.locator('.flow-light-beam').evaluate_all('els=>els.length>0&&els.every(e=>getComputedStyle(e).strokeDasharray==="none"&&getComputedStyle(e).animationName==="flow-beam-pulse")'))
        check('legacy segments absent',await page.locator('[data-testid^="flow-segments-"]').count()==0)
        a=await pos('flow-photons-hoymiles-house')
        await page.wait_for_timeout(300)
        b=await pos('flow-photons-hoymiles-house')
        check('photon movement',math.dist(a,b)>2,[a,b])
        base=float((await page.get_by_test_id('flow-photons-hoymiles-house').locator('animateMotion').first.get_attribute('dur')).rstrip('s'))
        for speed,key in ((1.5,'1_5'),(2,'2')):
            await page.get_by_test_id('flow-tempo-'+key).click(force=True)
            duration=float((await page.get_by_test_id('flow-photons-hoymiles-house').locator('animateMotion').first.get_attribute('dur')).rstrip('s'))
            check('tempo '+str(speed),abs(duration-base/speed)<.025,[base,duration])
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('flow off removes motion and pulse',await page.locator('[data-testid^="flow-photons-"]').count()==0 and await page.locator('.flow-light-beam').count()==0)
        static_count=await page.get_by_test_id('energy-flow-svg').locator('path[stroke-width="0.85"]').count()
        check('flow off leaves static beams',static_count>0,static_count)
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        check('flow tempo view persistence',await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='false' and await page.get_by_test_id('flow-tempo-2').get_attribute('aria-pressed')=='true' and await page.get_by_test_id('flow-view-detail').get_attribute('aria-pressed')=='true')
        await page.get_by_test_id('flow-toggle-anim').click(force=True)
        check('flow reenabled',await page.locator('[data-testid^="flow-photons-"]').count()>0)
        await page.emulate_media(reduced_motion='reduce')
        await page.wait_for_timeout(250)
        check('reduced motion static beams',await page.get_by_test_id('energy-flow-svg').locator('animateMotion').count()==0 and await page.locator('.flow-light-beam').count()==0 and await page.get_by_test_id('energy-flow-svg').locator('path[stroke-width="0.85"]').count()>0)
        await page.emulate_media(reduced_motion='no-preference')
        await page.wait_for_timeout(250)
        check('motion restored',await page.locator('[data-testid^="flow-photons-"]').count()>0)
        await page.evaluate('document.fonts.ready')
        check('DSEG loaded',await page.evaluate('[...document.fonts].some(f=>f.family==="DSEG7-Classic"&&f.status==="loaded")'))
        for node in ('hoymiles','victron','battery','sun2000','grid','house'):
            await page.get_by_test_id('flow-'+node).hover()
            await page.get_by_test_id('flow-inspector').wait_for()
            check('inspector DSEG '+node,await page.get_by_test_id('flow-inspector').locator('dd').evaluate_all('els=>els.length>0&&els.every(e=>getComputedStyle(e).fontFamily.includes("DSEG7-Classic"))'))
        await page.get_by_test_id('flow-hoymiles').hover()
        check('hover watt pill',await page.get_by_test_id('flow-pill-hoymiles-house-value').is_visible() and 'W' in await page.get_by_test_id('flow-pill-hoymiles-house-value').text_content())
        await page.mouse.move(0,0)
        for width,height in ((1920,800),(390,844)):
            await page.set_viewport_size({'width':width,'height':height})
            await page.get_by_test_id('flow-view-auto').click(force=True)
            await page.wait_for_timeout(250)
            check('page overflow '+str(width),await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            check('node cropping '+str(width),await page.get_by_test_id('energy-flow-svg').evaluate('s=>{const v=s.viewBox.baseVal;return [...s.querySelectorAll(":scope > g[data-testid]")].every(g=>{const b=g.getBBox();return b.x>=0&&b.y>=0&&b.x+b.width<=v.width&&b.y+b.height<=v.height})}'))
            check('auto topology '+str(width),await page.get_by_test_id('flow-pv' if width==390 else 'flow-hoymiles').count()==1)
            await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
            if width==390:
                await page.screenshot(path='/app/test_reports/screenshots-flow-36/automation_output/20261101_130301_fd8a3d6ec02c/mobile.jpeg', type="jpeg", quality=40, full_page=False)
        origin=page.url.split('/')[0]+'//'+page.url.split('/')[2]
        fixture=await (await page.request.get(origin+'/api/live')).json()
        async def controlled(route):
            await route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture))
        await page.route('**/api/live',controlled)
        await page.set_viewport_size({'width':1920,'height':800})
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        for watts,n in ((100,1),(400,2),(1000,3),(2000,4)):
            fixture['summary']['pv_ac_power']=watts
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            motions=page.get_by_test_id('flow-photons-hoymiles-house').locator('animateMotion')
            duration=float((await motions.first.get_attribute('dur')).rstrip('s'))
            check('MOCKED watts density speed '+str(watts),await motions.count()==n and abs(duration-(2.4-watts/3000*1.8))<.02,[await motions.count(),duration])
            check('live polling reflected '+str(watts),await page.get_by_test_id('flow-hoymiles-power').text_content()==format(watts,',').replace(',','.')+'W')
        for grid,reverse in ((-700,True),(700,False)):
            fixture['summary']['grid_power']=grid
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            await page.get_by_test_id('energy-flow-svg').evaluate('s=>s.setCurrentTime(.2)')
            a=await pos('flow-photons-grid-house')
            await page.wait_for_timeout(100)
            b=await pos('flow-photons-grid-house')
            check('MOCKED grid direction '+str(grid),(b[0]<a[0])==reverse and abs(b[0]-a[0])>1,[a,b])
        fixture['summary'].update({'battery_power':2500,'battery_soc':100,'battery_charge_w':2500})
        async with page.expect_response(lambda r:r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        for mode in ('detail','compact'):
            await page.get_by_test_id('flow-view-'+mode).click(force=True)
            boxes=await page.get_by_test_id('flow-battery').evaluate('e=>{const a=e.querySelector("[data-testid$=power]").getBBox(),b=e.querySelector("[data-testid$=percent]").getBBox();return [a.x+a.width,b.x]}')
            check('MOCKED +2500/100 nonoverlap '+mode,boxes[0]<=boxes[1],boxes)
            check('MOCKED battery values '+mode,await page.get_by_test_id('flow-battery-power').text_content()=='+2.500W' and await page.get_by_test_id('flow-battery-percent').text_content()=='100%' and await page.get_by_test_id('flow-battery-soc-ring').text_content()=='100')
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        await page.mouse.move(0,0)
        await page.screenshot(path='/app/test_reports/screenshots-flow-36/automation_output/20261101_130301_fd8a3d6ec02c/beam-desktop.jpeg', type="jpeg", quality=40, full_page=False)
        check('no runtime errors',not errors,errors)
        error_text=await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');}''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        check('script execution',False,str(e))
    print('RESULT '+str(sum(results))+'/'+str(len(results)))
