/** Colours over the live camera and in the effect lab. They stay the same in every theme (ADR-015, Consequences). */
export const FIXED_COLORS = {
  flash: '#ffffff',
  shutterRing: '#ffffff',
  shutterFill: 'rgba(255,255,255,0.3)',
  dim: '#000000',
  bracket: '#ffffff',
  starCore: 'rgba(255,255,255,1)',
  starHalo: 'rgba(255,255,255,0.3)',
  starEdge: 'rgba(255,255,255,0)',
  labPill: 'rgba(0,0,0,0.6)',
  labList: 'rgba(0,0,0,0.8)',
  labText: '#ffffff',
  labFamily: 'rgba(255,255,255,0.6)',
  labActive: '#ffd60a',
} as const
