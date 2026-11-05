async def run_test(page, output_dir, page_url):
    from pathlib import Path
    try:
        namespace={}
        exec(Path('/app/tests/phase2_duplicate_chart_review.py').read_text(),namespace)
        await namespace['run'](page)
        error_text = await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}''')
        print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
    except Exception as exc:
        print('FAIL duplicate runner',str(exc))
