async def run_test(page, output_dir, page_url):
    await page.set_viewport_size({"width":1920,"height":1080})
    try:
     await page.get_by_test_id('phase2-dashboard-view').wait_for(timeout=20000)
     print('PASS preview loaded')
     await page.screenshot(path='/app/test_reports/phase2-browser-41/automation_output/20261105_203843_548be79cfd00/phase2-initial-41.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as e: print('FAIL load',str(e))
