// Unified metric helper: valid/clamped ratios and unknown-value handling.
import fs from 'node:fs';
const source = fs.readFileSync('/app/frontend/src/lib/mppt.js', 'utf8');
const { utilizationPercent: utilization } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const cases = [
  ['normal', 750, 1500, 50],
  ['upper clamp', 2000, 1500, 100],
  ['negative magnitude', -750, 1500, 50],
  ['zero power', 0, 1500, 0],
  ['missing peak', 750, null, null],
  ['zero peak', 750, 0, null],
  ['invalid peak', 750, 'bad', null],
  ['missing power', null, 1500, null],
  ['empty power', '', 1500, null],
];
let failed = 0;
for (const [name, power, peak, expected] of cases) {
  const actual = utilization(power, peak);
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: actual=${actual}, expected=${expected}`);
  if (!ok) failed++;
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exitCode = failed ? 1 : 0;