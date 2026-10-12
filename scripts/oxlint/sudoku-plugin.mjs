// ADR-015, point 7: only apps/mobile/src/theme/ holds raw colour values.
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNCTION = /^(?:rgba?|hsla?)\(/i
const NAMED = new Set(['white', 'black'])
const MESSAGE = 'A colour literal belongs in src/theme/ (ADR-015). Use a theme token.'

function isColour(value) {
  if (typeof value !== 'string') return false
  const text = value.trim()
  return HEX.test(text) || FUNCTION.test(text) || NAMED.has(text.toLowerCase())
}

export default {
  meta: { name: 'sudoku' },
  rules: {
    'no-colour-literal': {
      create(context) {
        return {
          Literal(node) {
            if (isColour(node.value)) context.report({ node, message: MESSAGE })
          },
          TemplateLiteral(node) {
            if (node.quasis.some((quasi) => isColour(quasi.value.cooked))) context.report({ node, message: MESSAGE })
          },
        }
      },
    },
  },
}
