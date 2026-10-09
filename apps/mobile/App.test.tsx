import { render, screen } from '@testing-library/react-native'
import App from './App'

describe('App', () => {
  it('shows the title', () => {
    render(<App />)
    expect(screen.getByText('Sudoku')).toBeTruthy()
  })

  it('reads the grid size from @sudoku/core', () => {
    render(<App />)
    expect(screen.getByText('81 cells')).toBeTruthy()
  })
})
