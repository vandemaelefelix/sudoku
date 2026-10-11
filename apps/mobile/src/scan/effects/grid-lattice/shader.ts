import { GRID_UV_SKSL } from '../common/gridUv'

// Prototype section 1b, "Grid lattice" (FRAG, uKind == 0), ported from GLSL to SkSL.
// The uniforms and the grid helpers come from GRID_UV_SKSL. latticeUniforms builds the uniforms in that order.
export const LATTICE_SKSL = `${GRID_UV_SKSL}
half4 main(float2 pos) {
  float2 uv = gridUv(pos);
  float2 fw = gridPixel(pos);
  float pxs = max(fw.x, fw.y);
  float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float inside = step(0.0, e);
  float ed = e / pxs;
  float outside = 1.0 - smoothstep(-1.0, 1.0, ed);
  float lockF = uLockT < 0.0 ? 0.0 : exp(-uLockT * 3.0);
  float2 d9 = abs(fract(uv * 9.0 + 0.5) - 0.5) / (fw * 9.0);
  float2 d3 = abs(fract(uv * 3.0 + 0.5) - 0.5) / (fw * 3.0);
  float border = 1.0 - smoothstep(0.5, 1.6, abs(ed));
  float dim = outside * (0.28 + 0.22 * uP);
  float thin = 1.0 - smoothstep(0.35, 1.3, min(d9.x, d9.y));
  float thick = 1.0 - smoothstep(0.8, 1.9, min(d3.x, d3.y));
  float lines = max(thin * 0.5, thick) * inside;
  float w = fract(uTime * 0.42) * 1.6 - 0.3;
  float bd = ((uv.x + uv.y) * 0.5 - w) / 0.07;
  float band = exp(-bd * bd);
  float la = lines * (0.1 + 0.35 * uP + 0.85 * band * (1.0 - 0.5 * uP) + 0.9 * lockF);
  la += inside * (0.05 * band + 0.12 * lockF);
  la = max(la, border * (0.45 + 0.55 * uP));
  float A = clamp(la, 0.0, 1.0) * uVis;
  float D = clamp(dim, 0.0, 1.0) * uVis;
  return half4(half3(0.88, 0.94, 1.0) * A, A + D * (1.0 - A));
}
`
