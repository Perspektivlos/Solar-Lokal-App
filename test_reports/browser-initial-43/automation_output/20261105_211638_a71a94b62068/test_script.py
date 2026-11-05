async def run_test(page, output_dir, page_url):
    try:
        await page.set_viewport_size({'width':1920,'height':800})
        await page.get_by_test_id('phase2-dashboard-view').wait_for(timeout=20000)
        print('PASS Phase2 initial load')
        await page.screenshot(path='/app/test_reports/browser-initial-43/automation_output/20261105_211638_a71a94b62068/initial.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as exc:
        print('FAIL initial load',str(exc))
    error_text = await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}''')
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
