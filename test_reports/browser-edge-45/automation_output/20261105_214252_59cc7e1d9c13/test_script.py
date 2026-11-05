async def run_test(page, output_dir, page_url):
    from pathlib import Path
    try:
        namespace={}
        filename='/app/tests/phase2_ui_acceptance.py'
        exec(compile(Path(filename).read_text(),filename,'exec'),namespace)
        results=await namespace['run'](page)
        print('EDGE SUMMARY',sum(bool(r[1]) for r in results),'/',len(results))
    except Exception as exc:
        print('FAIL edge execution',str(exc))
