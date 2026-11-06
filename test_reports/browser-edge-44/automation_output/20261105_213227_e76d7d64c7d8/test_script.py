async def run_test(page, output_dir, page_url):
    import sys
    sys.path.insert(0,'/app/tests')
    import phase2_ui_acceptance
    try:
        results=await phase2_ui_acceptance.run(page)
        print('FINAL EDGES',results)
    except Exception as exc:print('FAIL EDGES',str(exc))
