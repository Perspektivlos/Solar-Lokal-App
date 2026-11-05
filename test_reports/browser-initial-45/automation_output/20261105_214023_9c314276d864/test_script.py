async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('phase2-dashboard-view').wait_for(timeout=20000)
        await page.screenshot(path='/app/test_reports/browser-initial-45/automation_output/20261105_214023_9c314276d864/initial.jpeg', type="jpeg", quality=40, full_page=False)
        print('PASS public Phase2 dashboard loads')
    except Exception as exc:
        print('FAIL initial load',str(exc))

