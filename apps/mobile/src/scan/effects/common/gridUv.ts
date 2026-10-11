// Prototype section 1b, the start of FRAG, ported from GLSL to SkSL. Shared by the grid shaders.
// Declares the uniforms uInv (view points to the unit square), uPixel (view points per prototype pixel), uTime (s),
// uVis (0..1), uP (0..1) and uLockT (s, or -1), in this order: 14 floats.
// Declares gridUv(pos), the unit-square position of a view point, and gridPixel(pos), the size of one prototype pixel in grid units.
// Runtime SkSL has no fwidth, so gridPixel takes the columns of the Jacobian of gridUv instead.
export const GRID_UV_SKSL = `
uniform float3x3 uInv;
uniform float uPixel;
uniform float uTime;
uniform float uVis;
uniform float uP;
uniform float uLockT;

float2 gridUv(float2 pos) {
  float3 h = uInv * float3(pos, 1.0);
  return h.xy / h.z;
}

float2 gridPixel(float2 pos) {
  float3 h = uInv * float3(pos, 1.0);
  float2 uv = h.xy / h.z;
  float2 ddx = (uInv[0].xy - uv * uInv[0].z) / h.z;
  float2 ddy = (uInv[1].xy - uv * uInv[1].z) / h.z;
  return max((abs(ddx) + abs(ddy)) * uPixel, float2(1e-5));
}
`
