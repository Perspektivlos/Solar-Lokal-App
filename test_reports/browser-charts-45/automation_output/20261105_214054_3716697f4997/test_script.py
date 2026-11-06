async def run_test(page, output_dir, page_url):
    from pathlib import Path
    try:
        for filename in ['phase2_chart_barriers_review.py','phase2_duplicate_chart_review.py']:
            namespace={}
            source=Path('/app/tests/'+filename).read_text()
            exec(compile(source,filename,'exec'),namespace)
            results=await namespace['run'](page)
            print('SUMMARY',filename,sum(bool(r[1]) for r in results),'/',len(results))
        error_text = await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(', ');} """)
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
        await page.screenshot(path='/app/test_reports/browser-charts-45/automation_output/20261105_214054_3716697f4997/duplicate-mobile.jpeg', type="jpeg", quality=40, full_page=False)
    except Exception as exc:
        print('FAIL chart review execution',str(exc))
