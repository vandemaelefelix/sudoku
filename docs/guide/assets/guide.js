// Shared behaviour for every guide page. Each widget reads data attributes, so a page needs no script of its own.
;(function () {
  const CHAPTERS = [
    { file: 'index.html', num: '0', title: 'Start here' },
    { file: '01-big-picture.html', num: '1', title: 'The big picture' },
    { file: '02-sudoku-engine.html', num: '2', title: 'The sudoku engine' },
    { file: '03-the-app.html', num: '3', title: 'The app and the game screen' },
    { file: '04-scan-pipeline.html', num: '4', title: 'Scanning a paper sudoku' },
    { file: '05-machine-learning.html', num: '5', title: 'The digit model' },
    { file: '06-backend-and-sync.html', num: '6', title: 'Backend, accounts and sync' },
    { file: '07-how-we-work.html', num: '7', title: 'Quality and how we work' },
  ]
  const READ_KEY = 'sudoku-guide-read'
  const THEME_KEY = 'sudoku-guide-theme'

  // Storage can throw in a private window or on a file:// page with blocked site data.
  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key)
      return value === null ? fallback : JSON.parse(value)
    } catch {
      return fallback
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // The page works without storage. Only the read marks and the theme are lost.
    }
  }

  const here = location.pathname.split('/').pop() || 'index.html'
  const theme = load(THEME_KEY, null)
  if (theme) document.documentElement.dataset.theme = theme

  function el(tag, attrs, children) {
    const node = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key === 'text') node.textContent = value
      else if (key === 'html') node.innerHTML = value
      else node.setAttribute(key, value)
    }
    for (const child of children || []) node.append(child)
    return node
  }

  function buildSidebar() {
    const nav = document.getElementById('guide-nav')
    if (!nav) return
    const read = load(READ_KEY, [])
    const brand = el('a', { class: 'brand', href: 'index.html' }, [
      el(
        'span',
        { class: 'brand-grid', 'aria-hidden': 'true' },
        Array.from({ length: 9 }, () => el('span')),
      ),
      'Sudoku, inside out',
    ])
    const list = el('ol')
    for (const chapter of CHAPTERS) {
      const link = el('a', { href: chapter.file }, [
        el('span', { class: 'num', text: chapter.num }),
        el('span', { text: chapter.title }),
      ])
      if (read.includes(chapter.file)) link.append(el('span', { class: 'done-mark', text: '✓', title: 'Read' }))
      const item = el('li', {}, [link])
      if (chapter.file === here) {
        link.classList.add('current')
        link.setAttribute('aria-current', 'page')
        const headings = document.querySelectorAll('.content h2[id]')
        if (headings.length) {
          const toc = el('ol', { class: 'toc' })
          for (const h of headings) toc.append(el('li', {}, [el('a', { href: '#' + h.id, text: h.textContent })]))
          item.append(toc)
        }
      }
      list.append(item)
    }
    const themeButton = el('button', { class: 'btn', type: 'button', text: '◐ Theme' })
    themeButton.addEventListener('click', () => {
      const dark =
        document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
      const next = dark ? 'light' : 'dark'
      document.documentElement.dataset.theme = next
      save(THEME_KEY, next)
    })
    nav.append(
      brand,
      el('p', { class: 'tagline', text: 'A guided tour of the sudoku project' }),
      list,
      el('div', { class: 'sidebar-foot' }, [themeButton]),
    )

    const menu = el('button', { class: 'btn menu-toggle', type: 'button', text: '☰ Chapters' })
    menu.addEventListener('click', () => document.body.classList.toggle('nav-open'))
    document.body.append(menu)
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) document.body.classList.remove('nav-open')
    })

    const tocLinks = nav.querySelectorAll('.toc a')
    if (tocLinks.length && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            for (const a of tocLinks) a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id)
          }
        },
        { rootMargin: '0px 0px -70% 0px' },
      )
      for (const h of document.querySelectorAll('.content h2[id]')) observer.observe(h)
    }
  }

  function buildPager() {
    const content = document.querySelector('.content')
    const index = CHAPTERS.findIndex((c) => c.file === here)
    if (!content || index < 0) return
    if (index > 0) {
      const button = el('button', { class: 'btn primary', type: 'button' })
      const label = el('span', { class: 'step-count' })
      const render = () => {
        const done = load(READ_KEY, []).includes(here)
        button.textContent = done ? '✓ Chapter read' : 'Mark this chapter as read'
        label.textContent = done ? 'Saved in this browser only.' : ''
      }
      button.addEventListener('click', () => {
        const now = load(READ_KEY, [])
        save(READ_KEY, now.includes(here) ? now.filter((f) => f !== here) : [...now, here])
        render()
      })
      render()
      content.append(el('div', { class: 'mark-read' }, [button, label]))
    }
    const pager = el('nav', { class: 'pager', 'aria-label': 'Chapters' })
    const prev = CHAPTERS[index - 1]
    const next = CHAPTERS[index + 1]
    pager.append(
      prev
        ? el('a', { href: prev.file }, [
            el('div', { class: 'dir', text: '← Previous' }),
            el('div', { text: prev.num + '. ' + prev.title }),
          ])
        : el('span'),
    )
    pager.append(
      next
        ? el('a', { href: next.file, class: 'next' }, [
            el('div', { class: 'dir', text: 'Next →' }),
            el('div', { text: next.num + '. ' + next.title }),
          ])
        : el('span'),
    )
    content.append(pager)
  }

  function parseSteps(value) {
    return value.split(',').map((s) => Number(s.trim()))
  }

  // <div class="stepper" data-stepper> holds a figure and .step children, numbered from 1.
  // Any element with data-steps="1,2" inside it gets .is-active on those steps.
  function initSteppers() {
    for (const stepper of document.querySelectorAll('[data-stepper]')) {
      const steps = [...stepper.querySelectorAll(':scope .step')]
      if (!steps.length) continue
      let current = 1
      const prev = el('button', { class: 'btn', type: 'button', text: '← Back' })
      const next = el('button', { class: 'btn primary', type: 'button', text: 'Next →' })
      const dots = el('div', { class: 'stepper-dots' })
      steps.forEach((_, i) => {
        const dot = el('button', { type: 'button', 'aria-label': 'Step ' + (i + 1) })
        dot.addEventListener('click', () => show(i + 1))
        dots.append(dot)
      })
      const counter = el('span', { class: 'step-count' })
      const controls = el('div', { class: 'stepper-controls' }, [prev, dots, counter, next])
      const after = stepper.querySelector('.stepper-controls-slot')
      if (after) after.replaceWith(controls)
      else stepper.append(controls)

      function show(n) {
        current = Math.max(1, Math.min(steps.length, n))
        steps.forEach((s, i) => s.classList.toggle('is-current', i + 1 === current))
        ;[...dots.children].forEach((d, i) => d.classList.toggle('on', i + 1 === current))
        for (const node of stepper.querySelectorAll('[data-steps]')) {
          node.classList.toggle('is-active', parseSteps(node.dataset.steps).includes(current))
        }
        prev.disabled = current === 1
        next.disabled = current === steps.length
        counter.textContent = current + ' / ' + steps.length
        stepper.dispatchEvent(new CustomEvent('stepchange', { detail: { step: current } }))
      }
      prev.addEventListener('click', () => show(current - 1))
      next.addEventListener('click', () => show(current + 1))
      stepper.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowRight') show(current + 1)
        if (event.key === 'ArrowLeft') show(current - 1)
      })
      show(1)
    }
  }

  // <div class="explorer" data-explorer>: clicking [data-node="x"] shows [data-panel="x"].
  function initExplorers() {
    for (const explorer of document.querySelectorAll('[data-explorer]')) {
      const nodes = explorer.querySelectorAll('[data-node]')
      const panels = explorer.querySelectorAll('[data-panel]')
      const hint = explorer.querySelector('.hint')
      function select(id) {
        for (const n of nodes) n.classList.toggle('selected', n.dataset.node === id)
        for (const p of panels) p.classList.toggle('is-current', p.dataset.panel === id)
        if (hint) hint.hidden = true
      }
      for (const node of nodes) {
        node.setAttribute('tabindex', '0')
        node.setAttribute('role', 'button')
        node.addEventListener('click', () => select(node.dataset.node))
        node.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            select(node.dataset.node)
          }
        })
      }
      if (explorer.dataset.explorer) select(explorer.dataset.explorer)
    }
  }

  // <div class="tabs" data-tabs> with <section data-tab="Label"> children.
  function initTabs() {
    for (const tabs of document.querySelectorAll('[data-tabs]')) {
      const sections = [...tabs.querySelectorAll(':scope > section[data-tab]')]
      const list = el('div', { class: 'tab-list', role: 'tablist' })
      const buttons = sections.map((section, i) => {
        const button = el('button', { type: 'button', role: 'tab', text: section.dataset.tab })
        button.addEventListener('click', () => select(i))
        list.append(button)
        return button
      })
      tabs.prepend(list)
      function select(n) {
        sections.forEach((s, i) => (s.hidden = i !== n))
        buttons.forEach((b, i) => b.setAttribute('aria-selected', String(i === n)))
      }
      select(0)
    }
  }

  // <div class="quiz" data-quiz>: a .q, an .options list of buttons (one with data-correct) and an .explain.
  function initQuizzes() {
    for (const quiz of document.querySelectorAll('[data-quiz]')) {
      const buttons = quiz.querySelectorAll('.options button')
      for (const button of buttons) {
        button.type = 'button'
        button.addEventListener('click', () => {
          for (const b of buttons) {
            b.disabled = true
            if (b.hasAttribute('data-correct')) b.classList.add('right')
          }
          if (!button.hasAttribute('data-correct')) button.classList.add('wrong')
          quiz.classList.add('answered')
        })
      }
    }
  }

  // A .term gets a tooltip from CSS. tabindex lets a keyboard reach it.
  function initTerms() {
    for (const term of document.querySelectorAll('.term[data-def]')) term.setAttribute('tabindex', '0')
  }

  // Draws a 9 × 9 board into <div class="board" data-board="530070000...">. '0' or '.' is an empty cell.
  function initBoards() {
    for (const board of document.querySelectorAll('[data-board]')) {
      const digits = board.dataset.board.replace(/\s/g, '')
      board.innerHTML = ''
      for (let i = 0; i < 81; i++) {
        const ch = digits[i] || '0'
        const cell = el('div', { class: 'cell', 'data-index': String(i) })
        if (ch !== '0' && ch !== '.') {
          cell.textContent = ch
          cell.classList.add('given')
        }
        board.append(cell)
      }
    }
  }

  window.SudokuGuide = { el, load, save, chapters: CHAPTERS }

  document.addEventListener('DOMContentLoaded', () => {
    buildSidebar()
    buildPager()
    initBoards()
    initSteppers()
    initExplorers()
    initTabs()
    initQuizzes()
    initTerms()
  })
})()
