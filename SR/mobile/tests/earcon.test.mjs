// Compile the service's actual chime/cancel methods against a small framework-contract
// double. Unlike the older executor fakes, this models AudioSpeechItem reading the
// utterance ID from Bundle, ignoring playEarcon's separate ID for callbacks.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, join } from 'node:path';
const directory = resolve('SR/mobile/app/build/earcon-tests');
await mkdir(directory, { recursive: true });
const service = await readFile('SR/mobile/app/src/main/java/com/crownandcall/srproof/PlaybackService.java', 'utf8');
function method(signature) {
  const start = service.indexOf(signature);
  if (start < 0) throw new Error('Missing production method: ' + signature);
  let end = service.indexOf('{', start), depth = 1;
  while (depth && ++end < service.length) {
    if (service[end] === '{') depth++;
    else if (service[end] === '}') depth--;
  }
  if (depth) throw new Error('Unbalanced production method');
  return service.slice(start, end + 1);
}
const fixture = join(directory, 'TestedChimeHost.java');
await writeFile(fixture, [
  'package com.crownandcall.srproof;',
  'import com.crownandcall.srproof.EarconCallbackTest.Bundle;',
  'import com.crownandcall.srproof.EarconCallbackTest.TextToSpeech;',
  'final class TestedChimeHost extends EarconCallbackTest.Host {',
  method('@Override public void chime('),
  method('@Override public void cancel()'),
  '}',
].join('\n'));
const jdk = process.env.SR_JAVA_HOME || process.env.JAVA_HOME;
const executable = name => jdk ? join(jdk, 'bin', name + (process.platform === 'win32' ? '.exe' : '')) : name;
execFileSync(executable('javac'), ['-d', directory, 'SR/mobile/app/src/main/java/com/crownandcall/srproof/PlaybackEngine.java', 'SR/mobile/tests/EarconCallbackTest.java', fixture], { stdio: 'inherit' });
execFileSync(executable('java'), ['-cp', directory, 'com.crownandcall.srproof.EarconCallbackTest'], { stdio: 'inherit' });
