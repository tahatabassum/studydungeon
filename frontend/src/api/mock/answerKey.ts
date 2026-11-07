/**
 * Private answer table for the Mock_Adapter. Never part of the public
 * Dungeon/Question shape. Placeholder content only.
 */
export interface AnswerKeyEntry {
  correct: string
  explanation?: string
  page: number
  chunk_id: string
}

export const answerKey: Readonly<Record<string, AnswerKeyEntry>> = {
  q1: {
    correct: 'CPU',
    explanation: 'The CPU fetches, decodes and executes instructions.',
    page: 3,
    chunk_id: 'chunk-cpu',
  },
  q2: {
    correct: 'RAM',
    explanation: 'RAM is volatile working memory.',
    page: 5,
    chunk_id: 'chunk-ram',
  },
  q3: {
    correct: 'Arithmetic and logic operations',
    page: 4,
    chunk_id: 'chunk-alu',
  },
  q4: {
    correct: 'Binary',
    explanation: 'Digital circuits represent data with two states, 0 and 1.',
    page: 7,
    chunk_id: 'chunk-binary',
  },
  m1: {
    correct: 'Registers',
    explanation: 'Registers sit inside the CPU and have the lowest latency.',
    page: 12,
    chunk_id: 'chunk-mem-registers',
  },
  m2: {
    correct: 'Reduce average memory access time',
    page: 13,
    chunk_id: 'chunk-mem-cache',
  },
  m3: {
    correct: 'Increases',
    explanation: 'Lower levels are slower but larger and cheaper per byte.',
    page: 14,
    chunk_id: 'chunk-mem-capacity',
  },
  m4: {
    correct: 'It keeps data without power',
    explanation: 'SSDs use non-volatile flash cells.',
    page: 15,
    chunk_id: 'chunk-mem-ssd',
  },
  n1: {
    correct: 'A device on a network',
    explanation: 'Each network interface is addressed so packets can be routed.',
    page: 21,
    chunk_id: 'chunk-net-ip',
  },
  n2: {
    correct: 'Router',
    page: 22,
    chunk_id: 'chunk-net-router',
  },
  n3: {
    correct: 'HTTP',
    explanation: 'HTTP is the request and response protocol of the web.',
    page: 23,
    chunk_id: 'chunk-net-http',
  },
  n4: {
    correct: 'Translate names to IP addresses',
    explanation: 'DNS maps readable names to numeric addresses.',
    page: 24,
    chunk_id: 'chunk-net-dns',
  },
  a1: {
    correct: 'O(log n)',
    explanation: 'Each step halves the remaining search range.',
    page: 31,
    chunk_id: 'chunk-alg-binsearch',
  },
  a2: {
    correct: 'Stack',
    page: 32,
    chunk_id: 'chunk-alg-stack',
  },
  a3: {
    correct: 'Bubble sort',
    explanation: 'Bubble sort compares and swaps neighbours until sorted.',
    page: 33,
    chunk_id: 'chunk-alg-bubble',
  },
  a4: {
    correct: 'Finite steps that solve the problem',
    explanation: 'An algorithm is a finite, well-defined procedure.',
    page: 34,
    chunk_id: 'chunk-alg-def',
  },
  b1: {
    correct: 'CPU',
    explanation: 'Boss recall: processor basics.',
    page: 3,
    chunk_id: 'chunk-cpu',
  },
  b2: {
    correct: 'Two',
    page: 7,
    chunk_id: 'chunk-binary',
  },
  b3: {
    correct: 'Registers',
    explanation: 'Boss recall: memory hierarchy.',
    page: 12,
    chunk_id: 'chunk-mem-registers',
  },
  b4: {
    correct: 'Found in the cache',
    explanation: 'A hit avoids a slower trip to lower levels.',
    page: 13,
    chunk_id: 'chunk-mem-cache',
  },
  b5: {
    correct: 'DNS',
    page: 24,
    chunk_id: 'chunk-net-dns',
  },
  b6: {
    correct: 'Forwards it toward its destination',
    explanation: 'Routers choose the next hop for each packet.',
    page: 22,
    chunk_id: 'chunk-net-router',
  },
  b7: {
    correct: 'Binary search',
    explanation: 'Boss recall: algorithms.',
    page: 31,
    chunk_id: 'chunk-alg-binsearch',
  },
  b8: {
    correct: 'Stack',
    explanation: 'Push and pop operate on the top of a stack.',
    page: 32,
    chunk_id: 'chunk-alg-stack',
  },
}
