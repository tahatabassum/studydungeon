import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGameBridge, type FromGameEvent, type GameBridge, type ToGameEvent } from '@/game/events'
import { ControlsLegend } from '@/components/ControlsLegend'
import { PauseButton } from '@/components/PauseButton'
import { TouchControls } from './TouchControls'
import { engageLabel } from './EngageButton'
import { TOUCH_OVERRIDE_KEY, touchOverride, useTouchMode } from './useTouchMode'

afterEach(() => {
  cleanup()
  sessionStorage.removeItem(TOUCH_OVERRIDE_KEY)
  vi.unstubAllGlobals()
  delete document.documentElement.dataset.touch
})

function readyBridge(): { bridge: GameBridge; sent: ToGameEvent[] } {
  const bridge = createGameBridge()
  const sent: ToGameEvent[] = []
  bridge.onToGame((e) => sent.push(e))
  bridge.markReady()
  return { bridge, sent }
}

function Probe() {
  return <p data-testid="mode">{useTouchMode() ? 'touch' : 'desktop'}</p>
}

describe('useTouchMode', () => {
  it('is off for a mouse, on for ?touch=1 and remembered for the tab', () => {
    render(<Probe />)
    expect(screen.getByTestId('mode').textContent).toBe('desktop')
    cleanup()
    expect(touchOverride('?touch=1')).toBe(true)
    render(<Probe />)
    expect(screen.getByTestId('mode').textContent).toBe('touch')
    expect(document.documentElement.dataset.touch).toBe('true')
  })

  it('turns on for a coarse pointer', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('coarse'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    render(<Probe />)
    expect(screen.getByTestId('mode').textContent).toBe('touch')
  })

  it('turns on at the first touchstart', () => {
    render(<Probe />)
    expect(screen.getByTestId('mode').textContent).toBe('desktop')
    act(() => {
      window.dispatchEvent(new Event('touchstart'))
    })
    expect(screen.getByTestId('mode').textContent).toBe('touch')
  })
})

describe('virtual joystick', () => {
  let bridgeBits: ReturnType<typeof readyBridge>
  beforeEach(() => {
    bridgeBits = readyBridge()
    render(<TouchControls bridge={bridgeBits.bridge} />)
    const stick = screen.getByTestId('virtual-joystick')
    // jsdom has no layout: a 100px stick at the origin.
    stick.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
  })
  const moves = () => bridgeBits.sent.filter((e) => e.type === 'set-move-input')

  it('sends an analog vector only when it changes, and zero on release', () => {
    const stick = screen.getByTestId('virtual-joystick')
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 50, clientY: 50 })
    expect(moves()).toHaveLength(0) // centre: still inside the dead zone, nothing to send
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(moves()).toEqual([{ type: 'set-move-input', x: 1, y: 0 }])
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 101, clientY: 50 })
    expect(moves()).toHaveLength(1)
    fireEvent.pointerUp(stick, { pointerId: 1 })
    expect(moves()[moves().length - 1]).toEqual({ type: 'set-move-input', x: 0, y: 0 })
    fireEvent.pointerUp(stick, { pointerId: 1 })
    expect(moves()).toHaveLength(2)
  })

  it('ignores a second finger and sends zero on cancel and on blur', () => {
    const stick = screen.getByTestId('virtual-joystick')
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 0, clientY: 50 })
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 100, clientY: 50 })
    expect(moves()).toEqual([{ type: 'set-move-input', x: -1, y: 0 }])
    fireEvent.pointerCancel(stick, { pointerId: 1 })
    expect(moves()[moves().length - 1]).toEqual({ type: 'set-move-input', x: 0, y: 0 })

    fireEvent.pointerDown(stick, { pointerId: 3, clientX: 50, clientY: 0 })
    expect(moves()[moves().length - 1]).toEqual({ type: 'set-move-input', x: 0, y: -1 })
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(moves()[moves().length - 1]).toEqual({ type: 'set-move-input', x: 0, y: 0 })
  })

  it('sends zero when it unmounts while held', () => {
    const stick = screen.getByTestId('virtual-joystick')
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 100, clientY: 50 })
    cleanup()
    expect(moves()[moves().length - 1]).toEqual({ type: 'set-move-input', x: 0, y: 0 })
  })
})

describe('engage button', () => {
  it('is disabled until Phaser says something is in range, then names the target', () => {
    const { bridge, sent } = readyBridge()
    render(<TouchControls bridge={bridge} />)
    const button = screen.getByTestId('engage-button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Engage')

    act(() => bridge.emit({ type: 'engage-available', kind: 'monster', name: 'Paper Wraith' } satisfies FromGameEvent))
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe('Fight Paper Wraith')
    fireEvent.click(button)
    expect(sent).toContainEqual({ type: 'engage-request' })

    act(() => bridge.emit({ type: 'engage-available', kind: 'revenant' }))
    expect(button.textContent).toBe('Face the memory')
    act(() => bridge.emit({ type: 'engage-available', kind: null }))
    expect(button.disabled).toBe(true)
  })

  it('labels', () => {
    expect(engageLabel({ kind: 'monster', name: 'Toxic Slime' })).toBe('Fight Toxic Slime')
    expect(engageLabel({ kind: 'revenant' })).toBe('Face the memory')
    expect(engageLabel({ kind: null })).toBe('Engage')
  })
})

describe('pause button and legend', () => {
  it('Pause calls the handler', async () => {
    const onPause = vi.fn()
    render(<PauseButton onPause={onPause} />)
    await userEvent.click(screen.getByRole('button', { name: 'Pause game' }))
    expect(onPause).toHaveBeenCalledTimes(1)
  })

  it('the legend shows touch wording in touch mode and keys otherwise', () => {
    const { rerender } = render(<ControlsLegend compact={false} touch />)
    expect(screen.getByText('Use the stick to move, tap Engage')).toBeTruthy()
    expect(screen.queryByText('WASD')).toBeNull()
    expect(screen.queryByText('Esc')).toBeNull()
    rerender(<ControlsLegend compact={false} />)
    expect(screen.getByText('WASD')).toBeTruthy()
    expect(screen.queryByText('Use the stick to move, tap Engage')).toBeNull()
  })

  it('touch wording replaces the collapsed toggle in compact mode', () => {
    render(<ControlsLegend compact touch />)
    expect(screen.getByText('Use the stick to move, tap Engage')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Controls' })).toBeNull()
  })
})
