async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width":1920,"height":800})
        await page.get_by_test_id('smartshunt-tab-overview').wait_for(timeout=20000)
        await page.screenshot(path='/app/test_reports/screenshots-smartshunt-39/automation_output/20261105_110653_1fe192e17f12/smartshunt-initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS preview loads')
    except Exception as e:
        print(f'FAIL preview load: {e}')
