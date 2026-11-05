// Prints every line Comby can say (from the `lines` blocks in script.js, plus the
// sound-on line) as JSON, so the clip generator records exactly the same text.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const texts = new Set();
for (const m of src.matchAll(/^\s*lines: (\{[\s\S]*?\n\s*\}),/gm)) {
  const lines = Function(`return (${m[1]});`)();
  Object.values(lines).forEach((t) => texts.add(t));
}
for (const m of src.matchAll(/say\('([^']+)'/g)) texts.add(m[1]);
console.log(JSON.stringify([...texts], null, 2));
