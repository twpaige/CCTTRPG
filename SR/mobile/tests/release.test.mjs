import assert from 'node:assert/strict';
import { applicationId, versionCode, fingerprint, verifyReports, checkUpgrade } from '../ci/release.mjs';
let passed = 0;
function test(name, fn) { fn(); console.log('PASS ' + name); passed++; }
const cert = 'ab'.repeat(32);
const report = `Signer #1 certificate SHA-256 digest: ${cert}\n`;
const badge = `A: package="${applicationId}"\nA: android:versionCode(0x0101021b)=(type 0x10)0x18705`;
test('New runs and attempts increase version codes', () => {
  assert.equal(versionCode(1, 1), 100101);
  assert.ok(versionCode(2, 1) > versionCode(1, 99));
  assert.ok(versionCode(1, 2) > versionCode(1, 1));
});
test('Counter limits reject collisions and Android overflow', () => {
  for (const [run, attempt] of [[0, 1], [1, 100], [1.5, 1], [21000000, 1]]) assert.throws(() => versionCode(run, attempt));
});
test('Certificate normalization accepts colon-separated SHA-256 only', () => {
  assert.equal(fingerprint(cert.toUpperCase().match(/../g).join(':')), cert);
  assert.throws(() => fingerprint('')); assert.throws(() => fingerprint('123'));
});
test('APK identity and version must match', () => {
  assert.equal(verifyReports(badge, report, 100101, cert).applicationId, applicationId);
  assert.throws(() => verifyReports(badge.replace(applicationId, 'another.app'), report, 100101, cert));
  assert.throws(() => verifyReports(badge, report, 100102, cert));
});
test('Wrong or multiple APK signers fail closed', () => {
  assert.throws(() => verifyReports(badge, report, 100101, 'cd'.repeat(32)));
  assert.throws(() => verifyReports(badge, report + report.replace('#1', '#2'), 100101, cert));
});
test('Published upgrades require same identity and strictly greater version', () => {
  const previous = { applicationId, versionCode: 100101, signingCertificateSha256: cert };
  checkUpgrade({ ...previous, versionCode: 100201 }, previous);
  for (const change of [{ versionCode: 100101 }, { versionCode: 100001 }, { applicationId: 'other' }, { signingCertificateSha256: 'cd'.repeat(32) }]) {
    assert.throws(() => checkUpgrade({ ...previous, versionCode: 100201, ...change }, previous));
  }
});
console.log(`${passed}/${passed} release safety tests passed.`);
