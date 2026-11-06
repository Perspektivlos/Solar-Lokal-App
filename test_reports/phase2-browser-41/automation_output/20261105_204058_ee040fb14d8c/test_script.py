async def run_test(page, output_dir, page_url):
    try:
     namespace={}
     exec(compile(open('/app/tests/phase2_ui_review.py').read(),'/app/tests/phase2_ui_review.py','exec'),namespace)
     await namespace['run'](page)
    except Exception as e: print('FAIL runner',str(e))
