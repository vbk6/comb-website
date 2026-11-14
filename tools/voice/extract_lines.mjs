// Prints every line Comby can say (every string in the `lines` blocks in script.js,
// including lists and per-section tables, plus lines passed straight to say()) as
// JSON, so the clip generator records exactly the same text.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../script.js', import.meta.url), 'utf8');
const texts = new Set();
const collect = (v) => (typeof v === 'string' ? texts.add(v) : Object.values(v).forEach(collect));

// find each `lines: {` and read up to its matching brace
for (const m of src.matchAll(/^\s*lines: \{/gm)) {
  const start = m.index + m[0].length - 1;
  let depth = 0;
  let quote = null;
  let end = start;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  collect(Function(`return (${src.slice(start, end + 1)});`)());
}
for (const m of src.matchAll(/say\('([^']+)'/g)) texts.add(m[1]);
console.log(JSON.stringify([...texts], null, 2));
