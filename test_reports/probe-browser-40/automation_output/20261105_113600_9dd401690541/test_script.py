async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({'width':1920,'height':1080})
        await page.get_by_test_id('smartshunt-preview-back').click(force=True)
        await page.get_by_test_id('dashboard').wait_for(timeout=15000)
        assert await page.get_by_test_id('device-cards').is_visible()
        print('PASS preview back to dashboard and device cards')
        for nav,root in [('control','control-page'),('history','history-page'),('devices','devices-page'),('diagnose','diagnose-page'),('integrations','integrations-page'),('dashboard','dashboard')]:
            await page.get_by_test_id('nav-'+nav).click(force=True)
            await page.get_by_test_id(root).wait_for(timeout=15000)
            assert await page.get_by_test_id(root).is_visible()
            print('PASS main '+nav+' navigation/load')
            if nav=='control':
                await page.get_by_test_id('btn-reload-device').click(force=True)
                await page.get_by_test_id('control-loaded-at').wait_for(timeout=15000)
                assert await page.get_by_test_id('trucki-status').is_visible()
                assert await page.get_by_test_id('btn-tru-zepc-on').is_enabled()
                assert await page.get_by_test_id('btn-tru-zepc-off').is_enabled()
                print('PASS Trucki control read-only reload/status/buttons; no commands sent')
        await page.set_viewport_size({'width':390,'height':844})
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        print('PASS mobile dashboard no overflow')
        error_text=await page.evaluate('''() => { const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]')); return errorElements.map(el => el.textContent).join(", "); }''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as e:
        print(f'FAIL regression: {type(e).__name__}: {e}')
