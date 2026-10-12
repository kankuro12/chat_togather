import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adToBs,bsToAd} from '../src/app/calendar-conversion.ts';
test('AD/BS calendar converts a known new year and round-trips dates without time shifts',()=>{
  assert.equal(adToBs('2020-04-13'),'2077-01-01');assert.equal(bsToAd('2077-01-01'),'2020-04-13');
  for(const ad of ['2026-10-12','2024-02-29','2026-11-02'])assert.equal(bsToAd(adToBs(ad)),ad);
  assert.throws(()=>bsToAd('2083-13-01'));assert.throws(()=>bsToAd('2083-01-99'));assert.throws(()=>adToBs('2026-02-30'));
});
