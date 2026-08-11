/** Builds the control panel from the parameter schema. */

import { type ParamDef, type Params, PARAMS, GROUPS } from './params.ts';

export interface Controls {
  /** Push current state into the widgets (after a preset load or reset). */
  sync: (p: Params) => void;
}

export function buildControls(
  root: HTMLElement,
  state: Params,
  onChange: (key: string, value: number | string | boolean) => void,
): Controls {
  const setters: ((p: Params) => void)[] = [];

  for (const group of GROUPS) {
    const section = document.createElement('section');
    section.className = 'group';

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'group-head';
    head.textContent = group;
    head.setAttribute('aria-expanded', 'true');

    const body = document.createElement('div');
    body.className = 'group-body';

    head.addEventListener('click', () => {
      const open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', String(!open));
      body.hidden = open;
    });

    for (const def of PARAMS.filter((d) => d.group === group)) {
      body.appendChild(buildRow(def, state, onChange, setters));
    }

    section.append(head, body);
    root.appendChild(section);
  }

  return { sync: (p) => setters.forEach((s) => s(p)) };
}

function buildRow(
  def: ParamDef,
  state: Params,
  onChange: (key: string, value: number | string | boolean) => void,
  setters: ((p: Params) => void)[],
): HTMLElement {
  const row = document.createElement('div');
  row.className = `row row-${def.type}`;

  const label = document.createElement('label');
  label.textContent = def.label;
  label.htmlFor = `p-${def.key}`;
  if (def.hint) label.title = def.hint;

  const value = document.createElement('output');
  value.className = 'value';

  if (def.type === 'range') {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = `p-${def.key}`;
    input.min = String(def.min);
    input.max = String(def.max);
    input.step = String(def.step);
    input.value = String(state[def.key]);
    value.textContent = String(state[def.key]);
    input.addEventListener('input', () => {
      const n = Number(input.value);
      value.textContent = String(n);
      onChange(def.key, n);
    });
    setters.push((p) => {
      input.value = String(p[def.key]);
      value.textContent = String(p[def.key]);
    });
    row.append(label, value, input);
  } else if (def.type === 'select') {
    const sel = document.createElement('select');
    sel.id = `p-${def.key}`;
    for (const [v, text] of def.options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = text;
      sel.appendChild(o);
    }
    sel.value = String(state[def.key]);
    sel.addEventListener('change', () => onChange(def.key, sel.value));
    setters.push((p) => { sel.value = String(p[def.key]); });
    row.append(label, sel);
  } else if (def.type === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.id = `p-${def.key}`;
    input.value = String(state[def.key]);
    input.addEventListener('input', () => onChange(def.key, input.value));
    setters.push((p) => { input.value = String(p[def.key]); });
    row.append(label, input);
  } else {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `p-${def.key}`;
    input.checked = Boolean(state[def.key]);
    input.addEventListener('change', () => onChange(def.key, input.checked));
    setters.push((p) => { input.checked = Boolean(p[def.key]); });
    row.append(label, input);
  }

  if (def.hint) row.title = def.hint;
  return row;
}
