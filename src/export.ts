/**
 * SVG export. Re-renders at the requested pixel size using the very same
 * render path as the preview, so the file always matches what was on screen.
 */

import { type Params } from './params.ts';
import { render } from './render.ts';

export function svgSource(p: Params): string {
  const { svg } = render(p, p.exportSize as number);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const body = new XMLSerializer().serializeToString(svg);
  const stamp = `<!-- einsvamp build ${__BUILD_SHA__} (${__BUILD_TIME__}) - https://github.com/tino415/einsvamp -->`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${stamp}\n${body}\n`;
}

export function downloadSvg(p: Params, filename = 'einsvamp.svg'): number {
  const source = svgSource(p);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return blob.size;
}
