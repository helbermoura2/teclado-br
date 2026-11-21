import assert from 'node:assert/strict';
// Read-only service reachability check: no pending login, account or playback writes.
const key='sb_publishable_1Clq8rlTVACkdcZuqr6_AD__xUUC_EN';
const response=await fetch('https://api.nuvio.tv/auth/v1/settings',{headers:{apikey:key,Accept:'application/json','User-Agent':'CENA/0.10.0'},signal:AbortSignal.timeout(20000)});
assert.equal(response.status,200,'Official Nuvio public auth configuration must be reachable');const body=await response.json();assert(body&&typeof body==='object'&&!Array.isArray(body));console.log('Nuvio public authentication configuration reachable; no user session or remote playback data created.');
