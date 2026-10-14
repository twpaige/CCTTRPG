import { run } from './native.test.js';
globalThis.srNativeResults = await run(); document.getElementById('results').textContent = JSON.stringify(globalThis.srNativeResults, null, 2);
