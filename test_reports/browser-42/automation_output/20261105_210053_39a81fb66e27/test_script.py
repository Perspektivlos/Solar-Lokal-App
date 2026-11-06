async def run_test(page, output_dir, page_url):
    try:
     await page.set_viewport_size({'width':1920,'height':800})
     await page.get_by_test_id('phase2-dashboard-view').wait_for(timeout=20000)
     print('PASS initial Phase2 load')
     await page.screenshot(path='/app/test_reports/browser-42/automation_output/20261105_210053_39a81fb66e27/phase2-initial-42.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as e:
     print('FAIL initial load',str(e))
