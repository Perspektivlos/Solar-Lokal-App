async def run_test(page, output_dir, page_url):
    import json
    await page.set_viewport_size({'width':1920,'height':1080})
    base=page.url.split('/smartshunt-phase2')[0]
    try:
     await page.get_by_test_id('flow-battery').wait_for(timeout=15000)
     for mode in ['compact','detail','auto']:
      await page.get_by_test_id('flow-view-'+mode).click(force=True)
      print('PASS flow mode',mode)
     await page.get_by_test_id('flow-tempo-2').click(force=True)
     await page.get_by_test_id('flow-tempo-1').click(force=True)
     if await page.get_by_test_id('flow-toggle-anim').get_attribute('aria-pressed')=='true': await page.get_by_test_id('flow-toggle-anim').click(force=True)
     assert await page.locator('[data-testid^="flow-photons-"]').count()==0
     await page.get_by_test_id('flow-toggle-anim').click(force=True)
     print('PASS animation and tempo')
     for node,source in [('battery','SMARTSHUNT'),('sun2000','TRUCKI')]:
      await page.get_by_test_id('flow-'+node).hover()
      assert source in (await page.get_by_test_id('flow-inspector-title').inner_text()).upper()
      print('PASS inspector',node,await page.get_by_test_id('flow-inspector').inner_text())
    except Exception as e: print('FAIL flow',str(e))
    try:
     history={'range':'6h','demo':True,'points':[{'ts':'2026-11-05T10:00:00+00:00','status':'current','battery_dc_power_w':-100,'inverter_ac_power_w':90,'battery_voltage_v':52,'battery_soc_pct':70},{'ts':'2026-11-05T10:30:00+00:00','status':'current','battery_dc_power_w':-200,'inverter_ac_power_w':180,'battery_voltage_v':53,'battery_soc_pct':71}]}
     async def gap(route):await route.fulfill(json=history)
     await page.route('**/api/smartshunt-phase2/history*',gap)
     await page.get_by_test_id('phase2-nav-verlauf').click(force=True)
     await page.get_by_test_id('phase2-chart-dc-ac').wait_for()
     await page.wait_for_timeout(600)
     paths=await page.get_by_test_id('phase2-chart-dc-ac').locator('path.recharts-line-curve').evaluate_all('(els)=>els.map(e=>e.getAttribute("d"))')
     print('MOCKED 30-minute gap curve paths:',paths)
     print('FAIL history draws continuous line across >600s gap' if any('L' in d for d in paths) else 'PASS gaps broken')
     await page.screenshot(path='/app/test_reports/phase2-edge-41/automation_output/20261105_204528_915f55c8b95b/phase2-gap-41.jpeg', type="jpeg", quality=40, full_page=False)
     await page.unroute('**/api/smartshunt-phase2/history*',gap)
    except Exception as e:print('FAIL gap test',str(e))
    error_text=await page.evaluate('''() => {const errorElements = Array.from(document.querySelectorAll('.error, [class*="error"], [id*="error"]'));return errorElements.map(el => el.textContent).join(", ");}''')
    print(f'Found error message: {error_text}' if error_text else 'No error messages found on the page')
