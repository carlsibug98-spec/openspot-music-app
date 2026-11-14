// Immersive Art v2 (spec Part 2): deterministic per-track gradient pairs for the
// now-playing background. RN can't sample remote image pixels without a native
// module, so every track gets a stable mood gradient keyed by its id (FNV-1a).
export const GRADIENT_PAIRS: Array<{ colors: [string, string, string]; ring: string }> = [
  { colors: ['#7b2ff7', '#3a1a8f', '#0a0514'], ring: 'rgba(123,47,247,0.35)' },
  { colors: ['#ff512f', '#8f1d3f', '#140508'], ring: 'rgba(255,81,47,0.3)' },
  { colors: ['#396afc', '#1a2f8f', '#050a14'], ring: 'rgba(57,106,252,0.3)' },
  { colors: ['#f7971e', '#8f5a0e', '#140b02'], ring: 'rgba(247,151,30,0.3)' },
  { colors: ['#00c2a8', '#0a6b5f', '#02120f'], ring: 'rgba(0,194,168,0.3)' },
  { colors: ['#dd2476', '#6b1240', '#14030a'], ring: 'rgba(221,36,118,0.3)' },
];

export function gradientPairFor(id: string | number): { colors: [string, string, string]; ring: string } {
  const str = String(id);
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return GRADIENT_PAIRS[hash % GRADIENT_PAIRS.length];
}
