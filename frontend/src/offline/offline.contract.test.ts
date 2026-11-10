import { describe, expect, it } from 'vitest'
import { createOfflineAdapter } from '@/offline'
import { defineContractSuite } from '../contract/suite'
import bundle from './demoDungeon.json'

const answers = bundle.answers as Record<string, { correct_option: number }>
const options = new Map(bundle.questions.map((q) => [q.id, q.options]))

// The Offline_Adapter answers the same contract as the mock and the real client (no accounts, so no auth cases).
defineContractSuite({
  label: 'Offline_Adapter',
  makeClient: () => createOfflineAdapter({ now: () => 1_700_000_000_000 }),
  correctAnswer: (qid) => {
    const list = options.get(qid)
    const entry = answers[qid]
    return list && entry ? list[entry.correct_option] : undefined
  },
  auth: false,
})

describe('Offline_Adapter accounts', () => {
  it('has no accounts: register and login say so, getMe is null, logout is harmless', async () => {
    const api = createOfflineAdapter()
    await expect(api.register({ username: 'abc', password: '12345678' })).rejects.toMatchObject({ status: 503 })
    await expect(api.login({ username: 'abc', password: '12345678' })).rejects.toMatchObject({ status: 503 })
    expect(await api.getMe()).toBeNull()
    await expect(api.logout()).resolves.toBeUndefined()
  })
})
