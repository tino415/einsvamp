/**
 * Headless renderer. Shims just enough DOM for src/render.ts and src/export.ts
 * to run under node, so the exact code path the browser uses can be exercised
 * and asserted on in CI (and used to produce sample images).
 *
 *   node --experimental-strip-types tool/render-svg.ts out.svg [key=value ...]
 */

class El {
  attrs = new Map<string, string>();
  children: El[] = [];
  tag: string;
  // Parameter properties are not supported by node's strip-only TS mode.
  constructor(tag: string) {
    this.tag = tag;
  }
  setAttribute(k: string, v: unknown): void {
    this.attrs.set(k, String(v));
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  appendChild(c: El): El {
    this.children.push(c);
    return c;
  }
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function serialize(node: El): string {
  const attrs = [...node.attrs].map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  if (node.children.length === 0) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map(serialize).join('')}</${node.tag}>`;
}

const g = globalThis as Record<string, unknown>;
g.document = { createElementNS: (_ns: string, tag: string) => new El(tag) };
g.XMLSerializer = class {
  serializeToString(node: El): string {
    return serialize(node);
  }
};

export { El, serialize };

// Imported after the shims are installed.
const { defaults } = await import('../src/params.ts');
const { svgSource } = await import('../src/export.ts');
const { render } = await import('../src/render.ts');

export function renderToString(overrides: Record<string, string | number | boolean> = {}): string {
  const p = { ...defaults(), ...overrides };
  return svgSource(p);
}

export function renderTree(overrides: Record<string, string | number | boolean> = {}) {
  const p = { ...defaults(), ...overrides };
  return render(p, 1000) as unknown as { svg: El; tileCount: number };
}

// CLI use: only when invoked directly, so check.ts can import this safely.
if (process.argv[1]?.endsWith('render-svg.ts')) {
  const [, , outPath, ...rest] = process.argv;
  const overrides: Record<string, string | number | boolean> = {};
  for (const kv of rest) {
    const [k, v] = kv.split('=');
    overrides[k] = v === 'true' ? true : v === 'false' ? false : Number.isFinite(Number(v)) ? Number(v) : v;
  }
  const svg = renderToString(overrides);
  if (outPath) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outPath, svg);
    console.log(`wrote ${outPath} (${(svg.length / 1024).toFixed(1)} kB)`);
  } else {
    console.log(svg);
  }
}
