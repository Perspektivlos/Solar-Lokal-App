async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('flow-summary').wait_for(state='visible', timeout=20000)
        print('PASS: dashboard and FlowSummary load')
        print('PV:', await page.get_by_test_id('summary-pv-value').inner_text())
        await page.screenshot(path='/app/test_reports/screenshots-summary-33/automation_output/20261030_213305_00c02bc6dfdd/initial_dashboard.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as exc:
        print(f'FAIL: initial load: {exc}')
        raise
