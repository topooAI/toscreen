export interface ModifierSnapshot { meta: boolean; ctrl: boolean; alt: boolean; shift: boolean }

const MODIFIER_CODES = {
  shift: new Set([16, 42, 54]),
  ctrl: new Set([17, 29, 3613]),
  alt: new Set([18, 56, 3640]),
  meta: new Set([91, 92, 93, 3675, 3676]),
} as const;

export function updateHeldKeyState(held: Set<number>, type: 'keydown' | 'keyup', keycode: number): ModifierSnapshot {
  if (type === 'keydown') held.add(keycode); else held.delete(keycode);
  const has = (codes: ReadonlySet<number>) => [...held].some(code => codes.has(code));
  return { meta: has(MODIFIER_CODES.meta), ctrl: has(MODIFIER_CODES.ctrl), alt: has(MODIFIER_CODES.alt), shift: has(MODIFIER_CODES.shift) };
}
