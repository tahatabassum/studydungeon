import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api'
import type { StoredDocument } from '@/types/api'

const h = vi.hoisted(() => ({ api: null as unknown }))
vi.mock('@/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api')>()
  return { ...actual, getApi: () => Promise.resolve(h.api as ApiClient) }
})
import { MyNotesCard } from './MyNotesCard'

afterEach(cleanup)

const doc = (over: Partial<StoredDocument> = {}): StoredDocument => ({
  id: 'doc-1',
  title: 'Cell biology.txt',
  status: 'accepted',
  created_at: '2026-11-20T10:00:00Z',
  dungeon_id: 'gen-doc-1',
  ...over,
})

function show(api: Partial<ApiClient>) {
  h.api = api
  return render(
    <MemoryRouter>
      <MyNotesCard />
    </MemoryRouter>,
  )
}

describe('MyNotesCard', () => {
  it('lists the notes with their status and a Play link to the summoned dungeon', async () => {
    show({ listDocuments: vi.fn().mockResolvedValue([doc(), doc({ id: 'doc-2', title: 'Receipt.txt', status: 'rejected', dungeon_id: null })]) })
    const items = await screen.findAllByTestId('my-notes-item')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/campaign/gen-doc-1')
    expect(within(items[1]).queryByRole('link', { name: 'Play' })).toBeNull()
    expect(within(items[1]).getByText('Rejected')).toBeTruthy()
  })

  it('shows an upload link when there are no notes', async () => {
    show({ listDocuments: vi.fn().mockResolvedValue([]) })
    const empty = await screen.findByTestId('my-notes-empty')
    expect(within(empty).getByRole('link', { name: 'Upload your notes' }).getAttribute('href')).toBe('/upload')
  })

  it('deletes a note only after confirmation and removes it from the list', async () => {
    const user = userEvent.setup()
    const deleteDocument = vi.fn().mockResolvedValue(undefined)
    show({ listDocuments: vi.fn().mockResolvedValue([doc()]), deleteDocument })
    await user.click(await screen.findByRole('button', { name: 'Delete Cell biology.txt' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(deleteDocument).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Delete Cell biology.txt' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(deleteDocument).toHaveBeenCalledWith('doc-1')
    await waitFor(() => expect(screen.queryAllByTestId('my-notes-item')).toHaveLength(0))
  })

  it('is hidden when the client cannot list documents (offline demo)', async () => {
    const { container } = show({})
    await waitFor(() => expect(container.querySelector('[data-testid="my-notes"]')).toBeNull())
  })
})