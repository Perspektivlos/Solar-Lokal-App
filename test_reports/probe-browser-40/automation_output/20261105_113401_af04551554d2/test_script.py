async def run_test(page, output_dir, page_url):
    import json
    try:
        await page.set_viewport_size({'width':1920,'height':1080})
        await page.get_by_test_id('smartshunt-tab-diagnostics').click(force=True)
        button=page.get_by_test_id('smartshunt-probe-button')
        assert await button.is_visible()
        async with page.expect_response(lambda r:'/api/smartshunt/probe' in r.url and r.request.method=='POST') as info:
            await button.click(force=True)
            assert await button.is_disabled()
            assert 'Prüfung läuft' in await button.inner_text()
            print('PASS running state and disabled button')
        response=await info.value
        result=await response.json()
        assert response.status==200 and result['passed'] is False and result['read_only'] is True
        await page.get_by_test_id('smartshunt-probe-verdict').wait_for()
        assert await page.get_by_test_id('smartshunt-probe-verdict').inner_text()=='Hardwareprüfung nicht bestanden'
        assert 'Timeout' in await page.get_by_test_id('smartshunt-probe-check-broker-detail').inner_text()
        assert await page.get_by_test_id('smartshunt-probe-check-read-only').is_visible()
        assert await button.is_enabled()
        print('PASS real cloud timeout and write protection')
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path='/app/test_reports/probe-browser-40/automation_output/20261105_113401_af04551554d2/probe-desktop-40.jpeg', type="jpeg", quality=40, full_page=False)
        await page.set_viewport_size({'width':390,'height':844})
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await button.scroll_into_view_if_needed()
        assert await button.is_visible()
        box=await button.bounding_box()
        assert box['x']>=0 and box['x']+box['width']<=390
        print('PASS mobile no overflow and button in bounds')
        await page.screenshot(path='/app/test_reports/probe-browser-40/automation_output/20261105_113401_af04551554d2/probe-mobile-40.jpeg', type="jpeg", quality=40, full_page=False)
        for tab in ['overview','device','history','diagnostics']:
            await page.get_by_test_id('smartshunt-tab-'+tab).click(force=True)
            assert await page.get_by_test_id('smartshunt-tab-'+tab).get_attribute('data-state')=='active'
            assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
            print('PASS tab '+tab)
        preview=await (await page.request.get(response.url.replace('/probe','/preview'))).json()
        success=dict(result)
        success.update({'passed':True,'duration_ms':100,'message_count':9,'field_count':9,'current':preview['current'],'checks':[dict(c,ok=True,detail='TEST_simulated') for c in preview['diagnostics']['checks']]})
        async def successful(route):
            await route.fulfill(status=200,content_type='application/json',body=json.dumps(success))
        await page.route('**/api/smartshunt/probe',successful)
        await button.click(force=True)
        await page.get_by_test_id('smartshunt-probe-verdict').filter(has_text='Hardwareprüfung bestanden').wait_for()
        assert await page.get_by_test_id('smartshunt-probe-status').inner_text()=='ABNAHMEBEREIT'
        for check in success['checks']:
            assert await page.get_by_test_id('smartshunt-probe-check-'+check['id']).is_visible()
        print('PASS MOCKED success renders all checks')
        await page.unroute('**/api/smartshunt/probe',successful)
        async def failed(route):
            await route.fulfill(status=500,content_type='application/json',body='{"detail":"TEST_failure"}')
        await page.route('**/api/smartshunt/probe',failed)
        await button.click(force=True)
        await page.get_by_test_id('smartshunt-probe-error').wait_for()
        assert await button.is_enabled()
        assert await page.get_by_test_id('smartshunt-probe-readonly-note').is_visible()
        print('PASS MOCKED HTTP500 error recovery and read-only note')
        await page.unroute('**/api/smartshunt/probe',failed)
        error_text=await page.evaluate('''() => { const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]')); return errorElements.map(el => el.textContent).join(", "); }''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        print(f'FAIL UI: {e}')
