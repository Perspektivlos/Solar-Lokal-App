async def run_test(page, output_dir, page_url):
    import math
    import json
    results=[]
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    def check(label,ok,actual=''):
        results.append(bool(ok));print(f'{"PASS" if ok else "FAIL"} {label}: {actual}')
    try:
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.set_viewport_size({'width':390,'height':844})
        await page.get_by_test_id('flow-view-auto').click(force=True)
        await page.wait_for_timeout(200)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        check('mobile auto compact',await page.get_by_test_id('flow-pv').count()==1 and await page.get_by_test_id('flow-hoymiles').count()==0)
        check('mobile page overflow',await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        check('mobile nodes not clipped',await page.evaluate("(()=>{const s=document.querySelector('[data-testid=energy-flow-svg]'),v=s.viewBox.baseVal;return [...s.querySelectorAll(':scope > g[data-testid]')].every(g=>{const b=g.getBBox();return b.x>=0&&b.y>=0&&b.x+b.width<=v.width&&b.y+b.height<=v.height})})()"))
        await page.screenshot(path='/app/test_reports/screenshots-flow-35/automation_output/20261101_125141_a95b589f7f2f/mobile.jpeg', type="jpeg", quality=40, full_page=False)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        check('mobile detail switch',await page.get_by_test_id('flow-hoymiles').count()==1 and await page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('flow-view-auto').click(force=True)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        await page.get_by_test_id('flow-victron').hover()
        await page.get_by_test_id('flow-inspector').wait_for()
        ib=await page.get_by_test_id('flow-inspector').evaluate("e=>{const b=e.getBoundingClientRect();return [...e.querySelectorAll('dd')].map(d=>{const r=d.getBoundingClientRect();return {text:d.textContent,left:r.left,right:r.right,box:[b.left,b.right],overflow:r.left<b.left||r.right>b.right}})}")
        check('inspector values inside panel',not any(x['overflow'] for x in ib),ib)
        await page.screenshot(path='/app/test_reports/screenshots-flow-35/automation_output/20261101_125141_a95b589f7f2f/inspector.jpeg', type="jpeg", quality=40, full_page=False)
        await page.mouse.move(0,0)
        origin=await page.evaluate('location.origin')
        fixture=await (await page.request.get(origin+'/api/live')).json()
        # MOCKED edge values in this browser only, without config or hardware writes.
        fixture['summary'].update({'pv_ac_power':100,'grid_power':-700})
        async def controlled(route):
            await route.fulfill(status=200,content_type='application/json',body=json.dumps(fixture))
        await page.route('**/api/live',controlled)
        await page.reload()
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.get_by_test_id('flow-tempo-1').click(force=True)
        for watts,n in [(100,1),(400,2),(1000,3),(2000,4)]:
            fixture['summary']['pv_ac_power']=watts
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            group=page.get_by_test_id('flow-segments-hoymiles-house')
            d=float((await group.locator('animateMotion').first.get_attribute('dur')).rstrip('s'))
            check('watts density/speed '+str(watts),await group.locator('animateMotion').count()==n and abs(d-(2.4-watts/3000*1.8))<0.02,{'n':await group.locator('animateMotion').count(),'dur':d})
        for grid,reverse in [(-700,True),(700,False)]:
            fixture['summary']['grid_power']=grid
            async with page.expect_response(lambda r:r.url.endswith('/api/live')):
                pass
            await page.wait_for_timeout(150)
            info=await page.get_by_test_id('flow-segments-grid-house').locator('animateMotion').first.evaluate("e=>{const p=e.getAttribute('path').match(/[\\d.]+/g).map(Number);return {p,reverse:e.parentElement.parentElement.parentElement.querySelector('.flow-particles').classList.contains('reverse'),color:e.parentElement.querySelector('path').getAttribute('fill')}}")
            check('grid path direction '+str(grid),(info['p'][0]>info['p'][2])==reverse and info['reverse']==reverse and info['color']==('#10B981' if reverse else '#F87171'),info)
            await page.evaluate("document.querySelector('[data-testid=energy-flow-svg]').setCurrentTime(0.2)")
            start=await page.get_by_test_id('flow-segments-grid-house').locator('g').first.evaluate('e=>{const m=e.getCTM();return [m.e,m.f]}')
            await page.wait_for_timeout(100)
            end=await page.get_by_test_id('flow-segments-grid-house').locator('g').first.evaluate('e=>{const m=e.getCTM();return [m.e,m.f]}')
            check('grid actual motion '+str(grid),(end[0]<start[0])==reverse and abs(end[0]-start[0])>1,[start,end])
        fixture['summary'].update({'battery_power':2500,'battery_soc':100,'battery_charge_w':2500})
        async with page.expect_response(lambda r:r.url.endswith('/api/live')):
            pass
        await page.wait_for_timeout(150)
        overlap=await page.get_by_test_id('flow-battery').evaluate("e=>{const a=e.querySelector('[data-testid$=power]').getBBox(),b=e.querySelector('[data-testid$=percent]').getBBox();return {powerRight:a.x+a.width,percentLeft:b.x,overlap:a.x+a.width>b.x}}")
        check('full SoC with 2500 W nonoverlap',not overlap['overlap'],overlap)
        await page.get_by_test_id('energy-flow-panel').scroll_into_view_if_needed()
        await page.screenshot(path='/app/test_reports/screenshots-flow-35/automation_output/20261101_125141_a95b589f7f2f/battery-100.jpeg', type="jpeg", quality=40, full_page=False)
        # Footer and beacon rectangles in SVG coordinates.
        footers=await page.evaluate("[...document.querySelectorAll('[data-testid=energy-flow-svg] text[data-testid$=peak]')].map(e=>{const b=e.getBBox(),r=e.parentElement.querySelector('rect[fill=\"url(#nodeFill)\"]'),right=+r.getAttribute('x')+(+r.getAttribute('width'));return {id:e.dataset.testid,right:b.x+b.width,nodeRight:right,outside:b.x+b.width>right}})")
        check('node footers fit',not any(x['outside'] for x in footers),footers)
        check('no runtime errors',not errors,errors)
        error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        await page.unroute('**/api/live',controlled)
    except Exception as e:
        check('script execution',False,str(e))
    print(f'RESULT {sum(results)}/{len(results)}')
