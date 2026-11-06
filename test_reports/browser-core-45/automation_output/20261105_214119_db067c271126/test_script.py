async def run_test(page, output_dir, page_url):
    import json
    from pathlib import Path
    try:
        namespace={}
        filename='/app/tests/phase2_ui_review.py'
        exec(compile(Path(filename).read_text(),filename,'exec'),namespace)
        results=await namespace['run'](page)
        Path('/app/test_reports/ui_core_results_45.json').write_text(json.dumps(results,indent=2))
        print('CORE SUMMARY',sum(bool(r[1]) for r in results),'/',len(results))
    except Exception as exc:
        print('FAIL core execution',str(exc))
