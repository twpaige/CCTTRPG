import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const applicationId = 'com.crownandcall.srproof';
export function versionCode(run, attempt) {
  run = Number(run); attempt = Number(attempt);
  const code = 100000 + run * 100 + attempt;
  if (!Number.isSafeInteger(run) || run < 1 || !Number.isInteger(attempt) || attempt < 1 || attempt > 99 || code > 2100000000) {
    throw new Error('Invalid run/version counter. Start a new workflow run; do not reset the workflow counter.');
  }
  return code;
}
export function fingerprint(value) {
  const normalized = value.replaceAll(':', '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('Expected SHA-256 signing certificate fingerprint is missing or invalid.');
  return normalized;
}
export function verifyReports(manifest, certificates, code, expected) {
  const id = manifest.match(/A: package="([^"]+)"/);
  const version = manifest.match(/A: android:versionCode\(0x0101021b\)=\(type 0x10\)0x([a-fA-F0-9]+)/);
  if (!id || !version || id[1] !== applicationId || parseInt(version[1], 16) !== code) throw new Error('APK application ID or version code mismatch.');
  const signers = [...certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]+)$/gm)];
  if (signers.length !== 1 || fingerprint(signers[0][1]) !== fingerprint(expected)) throw new Error('APK signing certificate mismatch.');
  return { applicationId, versionCode: code, signingCertificateSha256: fingerprint(expected) };
}
export function checkUpgrade(current, previous) {
  if (current.applicationId !== previous.applicationId || current.signingCertificateSha256 !== previous.signingCertificateSha256) {
    throw new Error('Published signing identity differs. Stop: changing keys would break installed updates.');
  }
  if (!Number.isInteger(previous.versionCode) || current.versionCode <= previous.versionCode) {
    throw new Error('A newer version was already published. Use Run workflow on main, not an older run.');
  }
}
function gh(...args) { return execFileSync('gh', args, { encoding: 'utf8' }); }
function main(mode) {
  if (mode === 'version') {
    const code = versionCode(process.env.GITHUB_RUN_NUMBER, process.env.GITHUB_RUN_ATTEMPT);
    appendFileSync(process.env.GITHUB_OUTPUT, `code=${code}\n`);
    return;
  }
  const code = Number(process.env.SR_VERSION_CODE);
  if (!Number.isInteger(code) || code <= 1 || code > 2100000000) throw new Error('Missing allocated build version code.');
  const dir = 'SR/mobile/app/build/distribution';
  if (mode === 'verify') {
    const metadata = verifyReports(readFileSync(`${dir}/manifest.txt`, 'utf8'), readFileSync(`${dir}/certificates.txt`, 'utf8'), code, process.env.SR_SIGNING_CERT_SHA256);
    metadata.commit = process.env.GITHUB_SHA;
    metadata.apkSha256 = createHash('sha256').update(readFileSync(`${dir}/SR.apk`)).digest('hex');
    writeFileSync(`${dir}/build-info.json`, JSON.stringify(metadata, null, 2) + '\n');
    writeFileSync(`${dir}/SR.apk.sha256`, `${metadata.apkSha256}  SR.apk\n`);
    return;
  }
  if (mode !== 'guard') throw new Error('Unknown release command.');
  const current = JSON.parse(readFileSync(`${dir}/build-info.json`, 'utf8'));
  const releases = JSON.parse(gh('api', '--paginate', '--slurp', `repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`)).flat();
  const prior = releases.filter(r => !r.draft && /^sr-android-\d+$/.test(r.tag_name))
    .sort((a, b) => Number(b.tag_name.slice(11)) - Number(a.tag_name.slice(11)))[0];
  if (prior) {
    const oldDir = `${dir}/previous`; mkdirSync(oldDir, { recursive: true });
    gh('release', 'download', prior.tag_name, '--pattern', 'build-info.json', '--dir', oldDir);
    const previous = JSON.parse(readFileSync(`${oldDir}/build-info.json`, 'utf8'));
    if (Number(prior.tag_name.slice(11)) !== previous.versionCode) throw new Error('Previous release metadata does not match its tag.');
    checkUpgrade(current, previous);
  }
  writeFileSync(`${dir}/notes.md`, `Personal SR Android proof. Download **SR.apk** below.\n\nVersion code: ${code}\nCommit: ${current.commit}\nApplication ID: ${applicationId}\nSigning SHA-256: ${current.signingCertificateSha256}\n\nAutomated checks passed. Physical-phone update/data retention remains owner verification. See SR/docs/GITHUB_APK_BUILDS.md.\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2]);
