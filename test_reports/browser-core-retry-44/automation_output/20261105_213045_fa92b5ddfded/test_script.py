async def run_test(page, output_dir, page_url):
    import sys,json
    from pathlib import Path
    sys.path.insert(0,'/app/tests')
    import phase2_ui_review
    try:
        results=await phase2_ui_review.run(page)
        Path('/app/test_reports/ui_core_results_44.json').write_text(json.dumps(results,indent=2))
        print('FINAL CORE',results)
    except Exception as exc:print('FAIL CORE',str(exc))
