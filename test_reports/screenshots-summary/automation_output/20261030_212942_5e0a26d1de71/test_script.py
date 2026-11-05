async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({"width":1920,"height":800})
        await page.get_by_test_id('flow-summary').wait_for(state='visible', timeout=20000)
        print('PASS: dashboard and FlowSummary loaded')
        print(await page.get_by_test_id('flow-summary').inner_text())
        await page.screenshot(path='/app/test_reports/screenshots-summary/automation_output/20261030_212942_5e0a26d1de71/initial_dashboard.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as e:
        print(f'FAIL: initial dashboard load: {e}')
