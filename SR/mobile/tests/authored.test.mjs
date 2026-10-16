// Development-only JSON implementation for host JVM tests; never packaged in the APK.
import './earcon.test.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, delimiter, join } from 'node:path';
import { buildNativePlan } from '../../js/native-study.js';
import { migrateSnapshot } from '../../js/validation.js';
import { legacyFixture } from '../../tests/mastery.test.js';
const directory = resolve('SR/mobile/app/build/authored-tests'); await mkdir(directory, { recursive: true });
const jar = join(directory, 'json-20240303.jar'), sha = '3cf6cd6892e32e2b4c1c39e0f52f5248a2f5b37646fdfbb79a66b46b618414ed';
let bytes; try { bytes = await readFile(jar); } catch { const response = await fetch('https://repo.maven.apache.org/maven2/org/json/json/20240303/json-20240303.jar'); if (!response.ok) throw new Error('Cannot fetch test-only JSON jar'); bytes = Buffer.from(await response.arrayBuffer()); }
if (createHash('sha256').update(bytes).digest('hex') !== sha) throw new Error('Test dependency checksum mismatch');
await writeFile(jar, bytes);
const snapshot = migrateSnapshot(legacyFixture());
snapshot.flashcards[0].steps[0].answer = '  Long answer 🧠 日本語.\n'.repeat(1000);
snapshot.flashcards[0].steps[0].recallSeconds = 3600;
const fixture = join(directory, 'plan.json');
await writeFile(fixture, JSON.stringify(buildNativePlan(snapshot, { window: { type: 'max' }, now: 2000000000000 })));
const stress = JSON.parse(await readFile('SR/test-data/sr-eclectic-1000-stress.json', 'utf8'));
const stressPlan = buildNativePlan(stress, { window: { type: 'max' }, now: 2000000000000 });
const stressFile = join(directory, 'stress-plan.json'); await writeFile(stressFile, JSON.stringify(stressPlan));
const jdk = process.env.SR_JAVA_HOME || process.env.JAVA_HOME;
const executable = name => jdk ? join(jdk, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
execFileSync(executable('javac'), ['-cp', jar, '-d', directory, ...['PlaybackEngine', 'CompletionQueue', 'Plan', 'SessionStore', 'FocusRecovery', 'BackupDocument'].map(name => `SR/mobile/app/src/main/java/com/crownandcall/srproof/${name}.java`), 'SR/mobile/tests/AuthoredPlaybackTest.java', 'SR/mobile/tests/PreparedSessionTest.java', 'SR/mobile/tests/ListeningInterfaceTest.java', 'SR/mobile/tests/ChimePlaybackTest.java'], { stdio: 'inherit' });
execFileSync(executable('java'), ['-cp', directory + delimiter + jar, 'com.crownandcall.srproof.AuthoredPlaybackTest', fixture, stressFile, String(stressPlan.units.length)], { stdio: 'inherit' });


execFileSync(executable('java'), ['-cp', directory + delimiter + jar, 'com.crownandcall.srproof.PreparedSessionTest', stressFile], { stdio: 'inherit' });

execFileSync(executable('java'), ['-cp', directory + delimiter + jar, 'com.crownandcall.srproof.ListeningInterfaceTest'], { stdio: 'inherit' });
execFileSync(executable('java'), ['-cp', directory + delimiter + jar, 'com.crownandcall.srproof.ChimePlaybackTest'], { stdio: 'inherit' });
