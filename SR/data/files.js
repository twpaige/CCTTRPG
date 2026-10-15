let lastName, sequence = 0;
export function backupFilename(now = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  const base = `SR-Backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  sequence = base === lastName ? sequence + 1 : 0; lastName = base;
  return base + (sequence ? `-${sequence}` : '') + '.json';
}
export async function saveVerified(handle, json) {
  // Refuse an existing nonempty file even if the picker allowed its selection.
  if ((await handle.getFile()).size !== 0) throw new Error('That file already contains data. Choose a new backup filename; nothing was overwritten.');
  const bytes = new TextEncoder().encode(json);
  const writer = await handle.createWritable();
  try { await writer.write(bytes); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); throw error; }
  const file = await handle.getFile(), actual = new Uint8Array(await file.arrayBuffer());
  if (actual.length !== bytes.length || actual.some((value, i) => value !== bytes[i])) throw new Error('Backup read-back verification failed. The library was not replaced.');
  return file.name;
}
