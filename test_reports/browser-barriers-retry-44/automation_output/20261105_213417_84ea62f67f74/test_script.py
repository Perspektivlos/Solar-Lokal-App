async def run_test(page, output_dir, page_url):
    import sys
    sys.path.insert(0,'/app/tests')
    import phase2_chart_barriers_review
    try:
        results=await phase2_chart_barriers_review.run(page)
        print('FINAL BARRIERS',results)
    except Exception as exc:print('FAIL BARRIERS',str(exc))
    error_text=await page.evaluate("""() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}""")
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
