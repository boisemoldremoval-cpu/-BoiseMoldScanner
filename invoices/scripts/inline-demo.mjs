// Packs the demo build into one self-contained HTML file: dist-demo/invoices-demo.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-demo';
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const css = [...html.matchAll(/<link rel="stylesheet"[^>]*href="\/?([^"]+)"[^>]*>/g)].map((m) =>
  readFileSync(join(dir, m[1]), 'utf8'),
);
const js = [...html.matchAll(/<script type="module"[^>]*src="\/?([^"]+)"[^>]*><\/script>/g)].map((m) =>
  readFileSync(join(dir, m[1]), 'utf8').replace(/<\/script/gi, '<\\/script'),
);

const page = `<title>Invoices Demo</title>
<style>
${css.join('\n')}
</style>
<div id="root"></div>
<script type="module">
${js.join('\n')}
</script>
`;

writeFileSync(join(dir, 'invoices-demo.html'), page);
console.log(`Wrote ${join(dir, 'invoices-demo.html')} (${Math.round(page.length / 1024)} KB)`);
