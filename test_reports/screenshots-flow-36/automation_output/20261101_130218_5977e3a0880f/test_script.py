async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('energy-flow-panel').wait_for(timeout=20000)
        await page.get_by_test_id('flow-view-detail').click(force=True)
        await page.screenshot(path='/app/test_reports/screenshots-flow-36/automation_output/20261101_130218_5977e3a0880f/initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS frontend loads')
        print(await page.locator('[data-testid^="flow-photons-"]').count())
    except Exception as e:
        print('FAIL initial load:',str(e))
