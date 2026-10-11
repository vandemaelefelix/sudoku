import { GRID_UV_SKSL } from '../common/gridUv'

// Prototype section 1c, "Ripples" (AMB_BG, uBg == 3), ported from GLSL to SkSL.
// The uniforms and the grid helpers come from GRID_UV_SKSL. uVis carries the detection fade (uDet in the prototype).
// uScale (view points per prototype point) comes after them. rippleUniforms builds the uniforms in that order.
export const RIPPLES_SKSL = `${GRID_UV_SKSL}
uniform float uScale;

float sdBox(float2 p, float2 b) {
  float2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

half4 main(float2 pos) {
  float2 px = pos / uScale;
  float2 uv = gridUv(pos);
  float2 fw = gridPixel(pos);
  float pxs = max(fw.x, fw.y);
  float sd = sdBox(uv - 0.5, float2(0.5));
  float edPx = -sd / pxs;
  float outside = 1.0 - smoothstep(-1.0, 1.0, edPx);
  float dimA = mix(0.3, outside * (0.5 + 0.1 * uP), uVis);
  float hide = 1.0 - uVis * (1.0 - outside);
  float S = 10.0;
  float d = length(fract(px / S) - 0.5) * S;
  float dout = max(-edPx, 0.0);
  float w = 0.5 + 0.5 * sin(dout * 0.22 - uTime * (13.0 + 13.0 * uP));
  float env = exp(-dout / 110.0) * uVis;
  float burst = 0.0;
  if (uLockT >= 0.0) {
    float rb = (dout - uLockT * 320.0) / 14.0;
    burst = exp(-rb * rb) * exp(-uLockT * 1.5);
  }
  float k = max(w * env, burst);
  float r = 0.7 + 1.9 * k;
  float dots = (1.0 - smoothstep(r - 0.5, r + 0.5, d)) * (0.22 + 0.55 * k) * hide;
  float A = clamp(dots, 0.0, 1.0);
  return half4(half3(A), A + dimA * (1.0 - A));
}
`
