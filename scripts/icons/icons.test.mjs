import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildIcons, renderPng } from './icons.mjs'

const icons = buildIcons()
const byFile = new Map(icons.map((icon) => [icon.file, icon]))

test('builds every file that the app config uses', () => {
  const expected = [
    ...['production', 'development'].flatMap((v) =>
      ['ios-light', 'ios-dark', 'ios-tinted', 'android-foreground', 'android-monochrome'].map((n) => `${v}/${n}.png`),
    ),
    'production/android-background.png',
    'splash/splash-light.png',
    'favicon.png',
  ]
  assert.deepEqual([...byFile.keys()].toSorted(), expected.toSorted())
})

test('the iOS light icon is 1024 px and fully opaque in both variants', () => {
  for (const file of ['production/ios-light.png', 'development/ios-light.png']) {
    const image = renderPng(byFile.get(file))
    assert.equal(image.width, 1024)
    assert.equal(image.height, 1024)
    for (let i = 3; i < image.pixels.length; i += 4) assert.equal(image.pixels[i], 255, `${file} pixel ${(i - 3) / 4}`)
  }
})

test('the dark and tinted icons have a transparent ground', () => {
  for (const file of ['production/ios-dark.png', 'production/ios-tinted.png']) {
    const image = renderPng(byFile.get(file))
    assert.equal(image.pixels[3], 0, `${file} top-left pixel`)
  }
})

test('only the development files carry a ribbon', () => {
  for (const { file, svg } of icons) {
    const ribbon = svg.includes('fill-rule="evenodd"')
    assert.equal(ribbon, file.startsWith('development/'), file)
  }
})

test('the favicon is 48 px', () => {
  assert.equal(byFile.get('favicon.png').size, 48)
})
