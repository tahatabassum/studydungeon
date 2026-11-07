import { Link } from 'react-router-dom'
import { DefeatOverlay } from '@/components/DefeatOverlay'
import { GuestBanner } from '@/components/GuestBanner'
import { Hud } from '@/components/Hud'
import { PauseMenu } from '@/components/PauseMenu'
import { QuestionPanel } from '@/components/QuestionPanel'
import { Spinner } from '@/components/Spinner'
import { GameCanvas } from '@/game/GameCanvas'
import { useSession } from '@/state/SessionContext'
import { usePlaySession } from './usePlaySession'

export default function PlayPage() {
  const { user } = useSession()
  const [s, gameWrapRef] = usePlaySession()
  const { state, room } = s

  if (s.loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-parchment">
        <p role="alert">{s.loadError}</p>
        <Link to="/" className="underline">
          Back to start
        </Link>
      </main>
    )
  }

  if (s.loading || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-background text-parchment">
        <Spinner label="Summoning the dungeon..." />
        <span aria-hidden="true">Summoning the dungeon...</span>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col items-center gap-2 overflow-hidden bg-background p-3 text-parchment">
      <div className="flex w-full max-w-5xl flex-col gap-2">
        <GuestBanner isGuest={user?.is_guest ?? false} />
        <Hud
          playerHp={state.playerHp}
          maxPlayerHp={state.maxPlayerHp}
          monsterHp={state.monsterHp}
          maxMonsterHp={state.maxMonsterHp}
          monsterName={room.monster.name}
          xp={state.xp}
          streak={state.streak}
        />
      </div>

      <div
        ref={gameWrapRef}
        className="relative aspect-video w-full min-h-0 max-w-[min(64rem,calc((100vh-12rem)*16/9))]"
      >
        <GameCanvas bridge={s.bridge} className="size-full" />

        {s.question && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 p-2">
            <QuestionPanel
              question={s.question}
              monsterName={room.monster.name}
              pending={s.pending}
              error={s.answerError}
              result={s.animDone ? state.lastResult : null}
              onAnswer={(sel) => void s.onAnswer(sel)}
              onContinue={() => void s.onContinue()}
            />
          </div>
        )}

        {state.phase === 'cleared' && s.clearedXp !== null && (
          <div className="absolute inset-x-0 top-4 z-10 flex justify-center">
            <p
              role="status"
              className="rounded-lg border-2 border-amber bg-panel px-6 py-3 text-lg font-bold text-amber"
            >
              Room cleared! +{s.clearedXp} XP
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted">WASD / Arrows to move · E to fight · Esc to pause</p>

      {state.phase === 'paused' && (
        <PauseMenu onResume={s.resume} onRestart={() => void s.restart()} />
      )}
      {state.phase === 'defeated' && (
        <DefeatOverlay onRetry={() => void s.restart()} xp={state.xp} score={state.score} />
      )}
    </main>
  )
}
