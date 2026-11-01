async def run_test(page, output_dir, page_url):
    try:
        exec(compile(open('/app/tests/day_balance_ui_regression.py').read(), '/app/tests/day_balance_ui_regression.py', 'exec'))
        await run(page)
    except Exception as e:
        print('FAIL runner execution:', str(e))
