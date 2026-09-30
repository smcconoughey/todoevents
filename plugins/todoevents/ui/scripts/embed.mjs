import { readFile, writeFile } from 'node:fs/promises';

const [js, css] = await Promise.all([
  readFile(new URL('../dist/widget.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist/plugin-ui.css', import.meta.url), 'utf8'),
]);
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light dark"><title>Todo Events</title><style>${css.replaceAll('</style', '<\\/style')}</style></head><body><div id="app"></div><script>${js.replaceAll('</script', '<\\/script')}</script></body></html>`;
await writeFile(new URL('../dist/events.html', import.meta.url), html);
console.log('Created self-contained dist/events.html (no external assets)');
