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

// ADR-033, point 10: the text that the player sees or hears comes from a catalogue.
const LETTER = /\p{L}/u
const TEXT_PROPS = new Set(['label', 'title', 'accessibilityLabel', 'accessibilityHint', 'placeholder'])
const TEXT_MESSAGE = 'Player text belongs in the catalogues of src/i18n/messages/ (ADR-033). Use intl.formatMessage.'

function hasLetters(node) {
  if (node == null) return false
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && LETTER.test(node.value)
    case 'TemplateLiteral':
      return node.quasis.some((quasi) => LETTER.test(quasi.value.cooked ?? ''))
    case 'JSXExpressionContainer':
      return hasLetters(node.expression)
    case 'ConditionalExpression':
      return hasLetters(node.consequent) || hasLetters(node.alternate)
    case 'LogicalExpression':
      return hasLetters(node.left) || hasLetters(node.right)
    default:
      return false
  }
}

// The buttons of an alert: [{ text: 'Cancel', style: 'cancel' }]. Only the text of a button is player text.
function hasButtonText(node) {
  if (node?.type !== 'ArrayExpression') return false
  return node.elements.some(
    (element) =>
      element?.type === 'ObjectExpression' &&
      element.properties.some((property) => property.key?.name === 'text' && hasLetters(property.value)),
  )
}

function isAlert(callee) {
  return (
    callee?.type === 'MemberExpression' &&
    callee.object?.type === 'Identifier' &&
    callee.object.name === 'Alert' &&
    callee.property?.name === 'alert'
  )
}

// A constants file holds keys and ids. A string that starts with a capital and has a space is a sentence for the player.
const SENTENCE = /^\p{Lu}\p{Ll}*[ ,]/u

function isSentence(text) {
  return typeof text === 'string' && SENTENCE.test(text)
}

export default {
  meta: { name: 'sudoku' },
  rules: {
    'no-constant-text': {
      create(context) {
        return {
          Literal(node) {
            if (isSentence(node.value)) context.report({ node, message: TEXT_MESSAGE })
          },
          TemplateLiteral(node) {
            if (isSentence(node.quasis[0]?.value.cooked)) context.report({ node, message: TEXT_MESSAGE })
          },
        }
      },
    },
    'no-literal-text': {
      create(context) {
        return {
          JSXText(node) {
            if (LETTER.test(node.value)) context.report({ node, message: TEXT_MESSAGE })
          },
          JSXAttribute(node) {
            if (TEXT_PROPS.has(node.name?.name) && hasLetters(node.value))
              context.report({ node, message: TEXT_MESSAGE })
          },
          JSXExpressionContainer(node) {
            const parent = node.parent?.type
            if ((parent === 'JSXElement' || parent === 'JSXFragment') && hasLetters(node.expression)) {
              context.report({ node, message: TEXT_MESSAGE })
            }
          },
          CallExpression(node) {
            if (isAlert(node.callee) && node.arguments.some((arg) => hasLetters(arg) || hasButtonText(arg))) {
              context.report({ node, message: TEXT_MESSAGE })
            }
          },
        }
      },
    },
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
