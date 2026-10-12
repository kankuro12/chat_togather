import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../src/app/server-url.js';
import { localInstant, repeatedLocalTime } from '../src/app/time.js';
test('native authentication requires HTTPS while local web development may use HTTP',()=>{
  assert.throws(()=>normalizeServerUrl('http://192.168.1.2:3001',true),/HTTPS/);
  assert.equal(normalizeServerUrl(' https://together.example.com/ ',true),'https://together.example.com');
  assert.equal(normalizeServerUrl('http://localhost:3001',false),'http://localhost:3001');
  assert.throws(()=>normalizeServerUrl('',true),/HTTPS/);
});
test('local schedules reject nonexistent spring times and require explicit fall-back occurrence',()=>{
  const previous=process.env.TZ;process.env.TZ='America/New_York';
  try{
    assert.throws(()=>localInstant('2026-03-08T02:30'),/does not exist/);
    assert.equal(repeatedLocalTime('2026-11-01T01:30'),true);
    assert.throws(()=>localInstant('2026-11-01T01:30'),/occurrence/);
    assert.equal(localInstant('2026-11-01T01:30','earlier'),'2026-11-01T05:30:00.000Z');
    assert.equal(localInstant('2026-11-01T01:30','later'),'2026-11-01T06:30:00.000Z');
    assert.equal(localInstant('2026-11-02T18:00'),'2026-11-02T23:00:00.000Z');
  }finally{if(previous)process.env.TZ=previous;else delete process.env.TZ;}
});
test('half-hour daylight transitions also resolve both occurrences',()=>{
  const previous=process.env.TZ;process.env.TZ='Australia/Lord_Howe';
  try{assert.equal(localInstant('2026-04-05T01:45','earlier'),'2026-04-04T14:45:00.000Z');assert.equal(localInstant('2026-04-05T01:45','later'),'2026-04-04T15:15:00.000Z');}
  finally{if(previous)process.env.TZ=previous;else delete process.env.TZ;}
});
