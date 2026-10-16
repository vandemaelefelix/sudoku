// ADR-015, point 7: only mobile/src/theme/ holds raw colour values.
// Anywhere in the string, so a boxShadow or border string with a colour also fails.
const HEX = /(?:^|[\s(,])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])/i
const FUNCTION = /\b(?:rgba?|hsla?)\(/i
// Only these names: the other CSS names (red, ...) are also ordinary words.
const NAMED = new Set(['white', 'black', 'transparent'])
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
