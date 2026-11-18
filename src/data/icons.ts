/**
 * Original 12x12 pixel-art sprites, drawn by hand for this site.
 *
 * Legend:
 *   .  transparent
 *   a  main colour   -> var(--icon-a)  (set per card)
 *   b  outline       -> dark plum
 *   c  highlight      -> warm cream
 *   d  accent         -> var(--icon-d) (cyan by default)
 *
 * To add an icon: append a 12-row, 12-column sprite here and add its key
 * to IconName. `validateIcons()` runs at build time and will fail loudly
 * if a row has the wrong width.
 */

export const GRID = 12;

export const ICON_PALETTE: Record<string, string> = {
  a: 'var(--icon-a, #f0b657)',
  b: '#2b1a33',
  c: '#fff1d2',
  d: 'var(--icon-d, #8bd8e6)',
};

export const ICONS: Record<string, string[]> = {
  whale: [
    '............',
    '....aaaa....',
    '..aaaaaaaa..',
    '.aaaaaaaaa..',
    '.aaaacaaaaa.',
    '.aaaaaaaaaa.',
    '.aaaaaaaaaa.',
    '..aaaaaaaa..',
    '...bbbbbaa..',
    '....bbbbb...',
    '..c......c..',
    '............',
  ],
  bot: [
    '............',
    '....aa......',
    '...aaaa.....',
    '..aaaaaaaa..',
    '.abaaaaabaa.',
    '.acaaaaacaa.',
    '.aaaaaaaaaa.',
    '.aaaddddaaa.',
    '.aaaaaaaaaa.',
    '..aa....aa..',
    '..bb....bb..',
    '............',
  ],
  scroll: [
    '............',
    '.bbbbbbbbbb.',
    '.bccccccccb.',
    '.bcaaacaacb.',
    '.bccccccccb.',
    '.bcaaaaaacb.',
    '.bccccccccb.',
    '.bcaaacaacb.',
    '.bccccccccb.',
    '.bbbbbbbbbb.',
    '..b......b..',
    '............',
  ],
  film: [
    '............',
    '.bbbbbbbbbb.',
    '.bdbdbdbdbd.',
    '.bccccccccb.',
    '.bcaaacaacb.',
    '.bcaaacaacb.',
    '.bccccccccb.',
    '.bcaaacaacb.',
    '.bccccccccb.',
    '.bdbdbdbdbd.',
    '.bbbbbbbbbb.',
    '............',
  ],
  chart: [
    '............',
    '.b.......aa.',
    '.b.....aa...',
    '.b...aaa....',
    '.b.aaa......',
    '.baa........',
    '.b..........',
    '.b..........',
    '.b..........',
    '.bbbbbbbbbbb',
    '............',
    '............',
  ],
  radar: [
    '............',
    '.....aa.....',
    '...aaaaaa...',
    '..aabbbbaa..',
    '.aabccccbaa.',
    '.aabcacbcaa.',
    '.aabcddcbaa.',
    '.aabcacbcaa.',
    '.aabccccbaa.',
    '..aabbbbaa..',
    '...aaaaaa...',
    '.....aa.....',
  ],
  flask: [
    '............',
    '.....bb.....',
    '.....aa.....',
    '....aaaa....',
    '....abba....',
    '...aabbaa...',
    '..aaddddaa..',
    '.aaddddddaa.',
    '.aaddddddaa.',
    '..aaaaaaaa..',
    '...bbbbbb...',
    '............',
  ],
  shield: [
    '............',
    '..aaaaaaaa..',
    '.aabbbbbbaa.',
    '.aabccccbaa.',
    '.aabcddcbaa.',
    '.aabcddcbaa.',
    '.aabccccbaa.',
    '..aabbbbaa..',
    '...aabbaa...',
    '....aaaa....',
    '.....aa.....',
    '............',
  ],
  mug: [
    '............',
    '..aaaaaaaa..',
    '..acccccca..',
    '..acddddca..',
    '..acddddcaa.',
    '..acddddcbb.',
    '..acddddcaa.',
    '..accccccaa.',
    '...aaaaaaaa.',
    '....bbbbbb..',
    '............',
    '............',
  ],
  github: [
    '............',
    '....aaaa....',
    '..aaaaaaaa..',
    '.aaaaaaaaaa.',
    '.aaabbbbaaa.',
    '.aaaccccaaa.',
    '.aaaaaaaaaa.',
    '..aaaaaaaa..',
    '...a....a...',
    '..bb....bb..',
    '............',
    '............',
  ],
  x: [
    '............',
    '.aa......aa.',
    '..aa....aa..',
    '...aa..aa...',
    '....aaaa....',
    '....aaaa....',
    '...aa..aa...',
    '..aa....aa..',
    '.aa......aa.',
    '............',
    '............',
    '............',
  ],
  cat: [
    '............',
    '.aa......aa.',
    '.aaa....aaa.',
    '.aaaaaaaaaa.',
    '.aacaaaaaca.',
    '.aaaaaaaaaa.',
    '.aaaddddaaa.',
    '.aaaaaaaaaa.',
    '..aaaaaaaa..',
    '...aaaaaa...',
    '....aaaa....',
    '............',
  ],
  star: [
    '............',
    '.....aa.....',
    '.....aa.....',
    '....aaaa....',
    '.aaaaaaaaaa.',
    '..aaaaaaaa..',
    '...aaaaaa...',
    '...aaaaaa...',
    '..aa....aa..',
    '.aa......aa.',
    '............',
    '............',
  ],
  moon: [
    '............',
    '...aaaa.....',
    '..aaaaaa....',
    '.aaaaaa.....',
    '.aaaaa......',
    '.aaaa.......',
    '.aaaa.......',
    '.aaaaa......',
    '.aaaaaa.....',
    '..aaaaaa....',
    '...aaaa.....',
    '............',
  ],
  portal: [
    '............',
    '...aaaaaa...',
    '..aabbbbaa..',
    '.aabccccbaa.',
    '.aabcddcbaa.',
    '.aabcddcbaa.',
    '.aabcddcbaa.',
    '.aabcddcbaa.',
    '.aabccccbaa.',
    '..aabbbbaa..',
    '...aaaaaa...',
    '............',
  ],
  music: [
    '............',
    '......aaa...',
    '......aaa...',
    '......a.a...',
    '......a.a...',
    '......a.a...',
    '......a.a...',
    '..aaaaa.a...',
    '.aaaaaaaa...',
    '.aaaaaaa....',
    '..aaaa......',
    '............',
  ],
};

export type IconName = keyof typeof ICONS;

/** Throws during `astro build` if a sprite is malformed. */
export function validateIcons(): void {
  for (const [name, rows] of Object.entries(ICONS)) {
    if (rows.length !== GRID) {
      throw new Error(`Sprite "${name}" has ${rows.length} rows, expected ${GRID}`);
    }
    rows.forEach((row, y) => {
      if (row.length !== GRID) {
        throw new Error(`Sprite "${name}" row ${y} has ${row.length} columns, expected ${GRID}`);
      }
      if (/[^.abcd]/.test(row)) {
        throw new Error(`Sprite "${name}" row ${y} contains an unknown colour`);
      }
    });
  }
}
