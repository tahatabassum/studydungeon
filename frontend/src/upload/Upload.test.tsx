/**
 * Upload wizard with the Mock_Adapter: drag and drop and the picker, the five steps, the rejection reason,
 * the topics, "Summon dungeon" to the floor result, request errors, the guest gate and keyboard use.
 * **Validates: Requirements 16.1, 16.2, 16.3, 16.4**
 */
import { useEffect, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import { createMockAdapter } from '@/api/mock/mockAdapter'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})

import { SessionProvider, useSession } from '@/state/SessionContext'
import UploadPage, { GUEST_UPLOAD_TEXT } from './UploadPage'
import { announcementFor, stepStates } from './steps'
import { fileHint } from './limits'

const WAIT = { timeout: 4000 }

function Seed({ guest, children }: { guest: boolean; children: ReactNode }) {
  const { setUser } = useSession()
  useEffect(() => {
    setUser({ id: 'u1', username: 'sam', is_guest: guest })
  }, [guest, setUser])
  return <>{children}</>
}
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderUpload(guest = false) {
  return render(
    <MemoryRouter initialEntries={['/upload']}>
      <SessionProvider>
        <Seed guest={guest}>
          <Where />
          <Routes>
            <Route path="/upload" element={<UploadPage pollMs={15} />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
        </Seed>
      </SessionProvider>
    </MemoryRouter>,
  )
}

const txt = (name: string, bytes = 800) => new File(['a'.repeat(bytes)], name, { type: 'text/plain' })
const picker = () => screen.findByLabelText(/choose a file/i)

let adapter: ApiClient
beforeEach(async () => {
  adapter = createMockAdapter({ upload: { processingMs: 40, stepMs: 30 } })
  await adapter.register({ username: 'upload_user', password: 'correct-horse-9' })
  h.api = adapter
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('upload wizard flow', () => {
  it('uploads, reads, lists the topics, summons the floors and links to the map', async () => {
    const user = userEvent.setup()
    renderUpload()
    expect(await screen.findByText(/Accepted formats: PDF, DOCX, PPTX, TXT, PNG, JPEG\./)).toBeTruthy()
    expect(screen.getByText(/Up to 15 MB and 30 pages, with at least 500 characters of text\./)).toBeTruthy()

    await user.upload(await picker(), txt('Cell biology.txt'))
    // Choosing the file starts the upload; there is no second click and no manual button.
    expect(screen.queryByRole('button', { name: 'Upload notes' })).toBeNull()

    const topics = await screen.findByTestId('upload-topics', undefined, WAIT)
    const items = within(topics).getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(3)
    expect(items[0].textContent).toContain('Cell biology')
    const states = within(screen.getByTestId('upload-steps')).getAllByRole('listitem').map((li) => li.getAttribute('data-state'))
    expect(states).toEqual(['done', 'done', 'done', 'done', 'pending'])

    await user.click(screen.getByRole('button', { name: 'Summon dungeon' }))
    const result = await screen.findByTestId('upload-result', undefined, WAIT)
    const floors = within(result).getAllByRole('listitem')
    expect(within(result).getByRole('heading').textContent).toBe(
      `Your notes became ${floors.length} ${floors.length === 1 ? 'floor' : 'floors'}`,
    )
    expect(floors[0].textContent).toContain('Summoning')
    expect(floors[floors.length - 1].textContent).toContain('Locked')
    expect(within(result).getByTestId('open-map').getAttribute('href')).toMatch(/^\/campaign\/gen-doc-1$/)
    await waitFor(() => expect(screen.getByTestId('upload-live').textContent).toBe(`Your notes became ${floors.length} floors.`))
  })

  it('the generated dungeon opens as a map with the same floors', async () => {
    const sent = await adapter.uploadDocument(txt('Physics.txt'))
    await waitFor(async () => expect((await adapter.getDocumentStatus(sent.id)).status).toBe('accepted'), WAIT)
    const dungeon = await adapter.generateDungeon(sent.id)
    const map = await adapter.getDungeon(dungeon.id)
    expect(map.floors!.map((f) => f.id)).toEqual(dungeon.floors!.map((f) => f.id))
    expect(map.name).toBe('Physics Dungeon')
  })

  it('starts uploading a dropped file at once and keeps only the first of several', async () => {
    const send = vi.spyOn(adapter, 'uploadDocument')
    renderUpload()
    const zone = await screen.findByTestId('dropzone')
    fireEvent.dragOver(zone)
    expect(zone.getAttribute('data-over')).toBe('true')
    fireEvent.drop(zone, { dataTransfer: { files: [txt('first.txt'), txt('second.txt')] } })
    const staged = await screen.findByTestId('staged-file')
    expect(within(staged).getByText('first.txt')).toBeTruthy()
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect((send.mock.calls[0][0] as File).name).toBe('first.txt')
    expect(within(staged).queryByText('second.txt')).toBeNull()
    expect(within(staged).getByText(/Only one file at a time/)).toBeTruthy()
  })

  it('shows the rejection reason and stops at the relevance check', async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.upload(await picker(), txt('lunch receipt.txt'))
    const verdict = await screen.findByTestId('upload-verdict', undefined, WAIT)
    expect(within(verdict).getByRole('heading').textContent).toBe('These notes were rejected')
    expect(within(verdict).getByTestId('rejection-reason').textContent).toMatch(/does not look like study material/)
    const states = within(screen.getByTestId('upload-steps')).getAllByRole('listitem').map((li) => li.getAttribute('data-state'))
    expect(states).toEqual(['done', 'done', 'stopped', 'pending', 'pending'])
    expect(screen.queryByRole('button', { name: 'Summon dungeon' })).toBeNull()
    await waitFor(() => expect(screen.getByTestId('upload-live').textContent).toMatch(/^Your notes were rejected\. This does not look/))

    await user.click(within(verdict).getByRole('button', { name: 'Choose another file' }))
    expect(await picker()).toBeTruthy()
  })

  it('a failed read shows its reason and Check again re-queues the document', async () => {
    const user = userEvent.setup()
    renderUpload()
    await user.upload(await picker(), txt('broken scan.txt'))
    const verdict = await screen.findByTestId('upload-verdict', undefined, WAIT)
    expect(within(verdict).getByRole('heading').textContent).toBe('These notes could not be read')
    await user.click(within(verdict).getByRole('button', { name: 'Check again' }))
    expect(await screen.findByTestId('upload-topics', undefined, WAIT)).toBeTruthy()
  })
})

describe('upload errors and hints', () => {
  it('hints at an unsupported type before sending, then shows the server answer', async () => {
    const spy = vi.spyOn(adapter, 'uploadDocument')
    const user = userEvent.setup()
    renderUpload()
    // The picker filters by extension; a drop does not, so the hint and the server are what stop it.
    fireEvent.drop(await screen.findByTestId('dropzone'), { dataTransfer: { files: [new File(['MZ'], 'virus.exe')] } })
    expect(screen.getByTestId('file-hint').textContent).toMatch(/not on the list/)
    // A hinted file is not sent on its own; the player can still send it and the server decides.
    expect(spy).not.toHaveBeenCalled()
    const send = screen.getByRole('button', { name: 'Upload notes' }) as HTMLButtonElement
    expect(send.disabled).toBe(false)
    await user.click(send)
    expect(spy).toHaveBeenCalledTimes(1)
    expect((await screen.findByTestId('upload-error')).textContent).toMatch(/not supported/)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('reports an oversize file from the server', async () => {
    const user = userEvent.setup()
    renderUpload()
    const big = txt('huge.pdf', 10)
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })
    await user.upload(await picker(), big)
    expect(screen.getByTestId('file-hint').textContent).toMatch(/larger than 15 MB/)
    await user.click(screen.getByRole('button', { name: 'Upload notes' }))
    expect((await screen.findByTestId('upload-error')).textContent).toMatch(/larger than 15 MB/)
  })

  it('reports the 5 document quota', async () => {
    for (let i = 0; i < 5; i += 1) await adapter.uploadDocument(txt(`old ${i}.txt`))
    const user = userEvent.setup()
    renderUpload()
    await user.upload(await picker(), txt('sixth.txt'))
    expect((await screen.findByTestId('upload-error')).textContent).toMatch(/already have 5 documents/)
  })

  it('says so when the offline demo cannot upload', async () => {
    h.api = Object.assign({}, adapter, { capabilities: { roomRevenants: false, floors: true, modes: true, dailyHaunt: false, leaderboard: true, uploads: false } })
    renderUpload()
    expect((await screen.findByTestId('upload-unavailable')).textContent).toMatch(/needs a connection/)
    expect(screen.queryByTestId('upload-wizard')).toBeNull()
  })
})

describe('guest gate', () => {
  it('hides the wizard and links a guest to /register', async () => {
    await adapter.startDemoSession()
    renderUpload(true)
    const gate = await screen.findByTestId('upload-guest')
    expect(within(gate).getByText(GUEST_UPLOAD_TEXT)).toBeTruthy()
    expect(within(gate).getByRole('link', { name: /Create an account/ }).getAttribute('href')).toBe('/register')
    expect(screen.queryByTestId('upload-wizard')).toBeNull()
    expect(screen.queryByTestId('dropzone')).toBeNull()
  })

  it('the mock refuses a guest upload with GUEST_FORBIDDEN', async () => {
    await adapter.startDemoSession()
    await expect(adapter.uploadDocument(txt('notes.txt'))).rejects.toMatchObject({ status: 403, code: 'GUEST_FORBIDDEN' })
  })
})

describe('keyboard and announcements', () => {
  it('reaches the picker with Tab and runs the whole flow with the keyboard', async () => {
    const user = userEvent.setup()
    renderUpload()
    const input = (await picker()) as HTMLInputElement
    for (let i = 0; i < 6 && document.activeElement !== input; i += 1) await user.tab()
    expect(document.activeElement).toBe(input)

    await user.upload(input, txt('Algebra.txt'))
    const live = screen.getByTestId('upload-live')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.getAttribute('role')).toBe('status')
    await screen.findByTestId('upload-topics', undefined, WAIT)
    await waitFor(() => expect(live.textContent).toMatch(/^Your notes passed the check\. \d topics were found\.$/))

    const summon = screen.getByRole('button', { name: 'Summon dungeon' })
    summon.focus()
    await user.keyboard(' ')
    expect(await screen.findByTestId('upload-result', undefined, WAIT)).toBeTruthy()
  })

  it('is static under reduced motion', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }))
    renderUpload()
    const wizard = await screen.findByTestId('upload-wizard')
    expect(wizard.getAttribute('data-reduced')).toBe('true')
  })
})

describe('steps, hints and announcements (pure)', () => {
  it('moves the five steps with the phase', () => {
    expect(stepStates('idle')).toEqual(['pending', 'pending', 'pending', 'pending', 'pending'])
    expect(stepStates('processing')).toEqual(['done', 'active', 'pending', 'pending', 'pending'])
    expect(stepStates('failed')[1]).toBe('stopped')
    expect(stepStates('done').every((s) => s === 'done')).toBe(true)
  })

  it('words the announcements with the right plural', () => {
    expect(announcementFor('done', { floors: 1 })).toBe('Your notes became 1 floor.')
    expect(announcementFor('done', { floors: 3 })).toBe('Your notes became 3 floors.')
    expect(announcementFor('accepted', { topics: 1 })).toBe('Your notes passed the check. 1 topic was found.')
    expect(announcementFor('staged', {})).toBe('')
  })

  it('hints only at what the server would refuse', () => {
    expect(fileHint({ name: 'a.pdf', size: 1000 })).toBeNull()
    expect(fileHint({ name: 'a.JPEG', size: 1000 })).toBeNull()
    expect(fileHint({ name: 'a.zip', size: 1000 })).toMatch(/not on the list/)
    expect(fileHint({ name: 'a.pdf', size: 15 * 1024 * 1024 + 1 })).toMatch(/larger than 15 MB/)
    expect(fileHint({ name: 'a.pdf', size: 0 })).toBe('That file is empty.')
  })
})
