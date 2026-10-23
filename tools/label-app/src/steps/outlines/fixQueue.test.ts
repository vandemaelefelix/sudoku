import { describe, expect, it, vi } from 'vitest'

import { createFixQueue } from './fixQueue'

describe('fixQueue', () => {
  it('hands out the photos in the order of the list', () => {
    const queue = createFixQueue()
    queue.replace(['a', 'b'])
    expect(queue.take()).toBe('a')
    expect(queue.size()).toBe(1)
    expect(queue.take()).toBe('b')
    expect(queue.take()).toBeUndefined()
  })

  it('does not change when the caller changes the list', () => {
    const queue = createFixQueue()
    const photos = ['a']
    queue.replace(photos)
    photos.push('b')
    expect(queue.size()).toBe(1)
  })

  it('clears the photos', () => {
    const queue = createFixQueue()
    queue.replace(['a', 'b'])
    queue.clear()
    expect(queue.size()).toBe(0)
  })

  it('returns a carried note once', () => {
    const queue = createFixQueue()
    queue.carry('Saved.')
    expect(queue.takeNote()).toBe('Saved.')
    expect(queue.takeNote()).toBeUndefined()
  })

  it('tells a listener about each change until it unsubscribes', () => {
    const queue = createFixQueue()
    const listener = vi.fn<() => void>()
    const unsubscribe = queue.subscribe(listener)
    queue.replace(['a'])
    queue.take()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    queue.clear()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('keeps the queues of two stores apart', () => {
    const one = createFixQueue()
    const two = createFixQueue()
    one.replace(['a'])
    expect(two.size()).toBe(0)
  })
})
