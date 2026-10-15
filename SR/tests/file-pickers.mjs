// Headless picker substitute, backed by actual disposable files. No personal paths.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function installPickers(page, directory) {
  await page.exposeFunction('testReadFile', async () => { try { return await readFile(join(directory, 'backup.json'), 'utf8'); } catch (e) { if (e.code === 'ENOENT') return ''; throw e; } });
  await page.exposeFunction('testWriteFile', text => writeFile(join(directory, 'backup.json'), text));
  await page.addInitScript(() => {
    window.picker = { incoming: '', mode: '', opens: 0, saves: 0, names: [] };
    const input = { getFile: async () => new File([picker.incoming], 'incoming.json') };
    window.showOpenFilePicker = async () => { picker.opens++; if (picker.mode === 'cancel-open') throw new DOMException('Cancelled', 'AbortError'); return [input]; };
    window.showSaveFilePicker = async options => {
      picker.saves++; picker.names.push(options.suggestedName); picker.sameFolder = options.startIn === input;
      if (picker.mode === 'cancel-save') throw new DOMException('Cancelled', 'AbortError');
      const name = options.suggestedName;
      return {
        getFile: async () => new File([await testReadFile()], name),
        createWritable: async () => ({
          write: async bytes => { if (picker.mode === 'write-fail') throw new Error('Injected write failure'); await testWriteFile(new TextDecoder().decode(bytes) + (picker.mode === 'corrupt' ? '!' : '')); },
          close: async () => {}, abort: async () => {}
        })
      };
    };
  });
}
