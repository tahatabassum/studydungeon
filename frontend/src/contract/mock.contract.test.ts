import { answerKey } from '../api/mock/answerKey'
import { createMockAdapter } from '../api/mock/mockAdapter'
import { defineContractSuite } from './suite'

defineContractSuite({
  label: 'Mock_Adapter',
  makeClient: () => createMockAdapter(),
  correctAnswer: (qid) => answerKey[qid]?.correct,
})
