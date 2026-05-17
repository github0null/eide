import { h } from 'vue';

/** Inline SVG icons (no external assets). */
export const GraphIcon = {
  render() {
    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: '1em',
        height: '1em',
        fill: 'currentColor',
      },
      [
        h('circle', { cx: 5, cy: 6, r: 2 }),
        h('circle', { cx: 19, cy: 6, r: 2 }),
        h('circle', { cx: 12, cy: 18, r: 2 }),
        h('path', {
          d: 'M7 7l4 9m6-9l-4 9',
          stroke: 'currentColor',
          fill: 'none',
          'stroke-width': 1.5,
        }),
      ],
    );
  },
};

export const HelpCircleIcon = {
  render() {
    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: '1em',
        height: '1em',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
      },
      [
        h('circle', { cx: 12, cy: 12, r: 10 }),
        h('path', {
          d: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
          'stroke-linecap': 'round',
        }),
        h('circle', { cx: 12, cy: 17, r: 0.5, fill: 'currentColor', stroke: 'none' }),
      ],
    );
  },
};

export const TableIcon = {
  render() {
    return h(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        width: '1em',
        height: '1em',
        fill: 'currentColor',
      },
      [
        h('path', {
          d: 'M4 5h16v2H4V5zm0 4h16v2H4V9zm0 4h10v2H4v-2zm0 4h10v2H4v-2z',
        }),
      ],
    );
  },
};
