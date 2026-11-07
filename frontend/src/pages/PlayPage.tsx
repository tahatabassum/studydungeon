import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ControlsHint } from '@/components/ControlsHint'
import { DefeatOverlay } from '@/components/DefeatOverlay'
import { GuestBanner } from '@/components/GuestBanner'
import { Hud } from '@/components/Hud'
import { Panel } from '@/components/Panel'
import { PauseMenu } from '@/components/PauseMenu'
import { QuestionPanel } from '@/components/QuestionPanel'
import { Spinner } from '@/components/Spinner'
import { VictoryOverlay } from '@/components/VictoryOverlay'
import { GameCanvas } from '@/game/GameCanvas'
import { damageReceived, isCombatActive } from '@/state/combatMachine'
import { useSession } from '@/state/SessionContext'
import { usePlaySession } from './usePlaySession'

export default function PlayPage() {
  const { user } = useSession()
  const [s, gameWrapRef] = usePlaySession()
  const { state, room } = s
  const [confirmingExit, setConfirmingExit] = useState(false)

  if (s.loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <p role="alert">{s.loadError}</p>
        <Link to="/" className="underline">
          Back to start
        </Link>
      </main>
    )
  }

  if (s.loading || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 bg-bg text-ink">
        <Spinner label="Summoning the dungeon..." />
        <span aria-hidden="true">Summoning the dungeon...</span>
      </main>
    )
  }

  const bossCleared = s.rooms.some((r) => r.is_boss && s.clearedRoomIds.includes(r.id))
  const showVictory =
    state.phase === 'victory' || (bossCleared && state.phase === 'cleared' && !state.summary)
  const showTopicCleared = state.phase === 'cleared' && !room.is_boss && s.clearedXp !== null
  const combatActive = isCombatActive(state.combat)
  const panelVisible = combatActive && s.question !== null

  return (
    <main className="grid h-screen h-dvh w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg px-3 py-1.5 text-ink">
      <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-1">
        <GuestBanner isGuest={user?.is_guest ?? false} />
        <Hud
          playerHp={state.playerHp}
          maxPlayerHp={state.maxPlayerHp}
          monsterHp={state.monsterHp}
          maxMonsterHp={state.maxMonsterHp}
          monsterName={room.monster.name}
          monsterKind={room.monster.kind}
          isBoss={room.is_boss}
          showMonster={combatActive || state.monsterHp > 0}
          xp={state.xp}
          streak={state.streak}
          level={s.progress?.level}
          xpToNext={s.progress?.xp_to_next}
          totalXp={s.progress?.total_xp}
          rooms={s.rooms}
          currentRoomId={s.currentRoomId}
          clearedRoomIds={s.clearedRoomIds}
        />
      </div>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[90rem] flex-col items-center gap-2 overflow-hidden pt-1 min-[900px]:flex-row min-[900px]:items-stretch">
        {/* Definite-size slot: container-type:size makes cqw/cqh the real available space. */}
        <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center [container-type:size]">
          <div
            ref={gameWrapRef}
            className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] max-h-full max-w-full overflow-hidden"
          >
            <GameCanvas bridge={s.bridge} className="absolute inset-0 size-full" />
          {showTopicCleared && !s.clearError && (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
              <Panel tone="gold" role="status" className="px-6 py-3 text-lg font-bold text-accent">
                Room cleared! +{s.clearedXp} XP — the gate opens
              </Panel>
            </div>
          )}

          {s.clearError && (
            <div className="absolute inset-x-0 top-3 z-10 flex justify-center">
              <Panel tone="danger" role="alert" className="flex items-center gap-3 px-6 py-3">
                <span>{s.clearError}</span>
                <Button variant="secondary" onClick={() => void s.retryClear()}>
                  Retry
                </Button>
              </Panel>
            </div>
          )}
          </div>
        </div>

        {panelVisible && s.question && (
          <div className="@container w-full max-w-3xl shrink-0 overflow-hidden min-[900px]:max-w-none min-[900px]:w-[clamp(300px,34vw,420px)] min-[900px]:min-h-0 min-[900px]:self-center min-[900px]:overflow-y-auto min-[900px]:overflow-x-hidden">
            <QuestionPanel
              question={s.question}
              combat={state.combat}
              monsterName={room.monster.name}
              error={s.answerError}
              result={state.lastResult}
              damageReceived={
                state.lastResult ? damageReceived(state.prevPlayerHp, state.lastResult) : undefined
              }
              onAnswer={(sel) => void s.onAnswer(sel)}
              onNext={s.skipWait}
              onRetreat={s.retreat}
              keysEnabled={state.phase !== 'paused' && state.phase !== 'defeated' && !showVictory}
            />
          </div>
        )}
      </div>

      <ControlsHint className="justify-center" />

      {state.phase === 'paused' && !confirmingExit && (
        <PauseMenu
          onResume={s.resume}
          onRetreat={state.combat === 'question' ? s.retreat : undefined}
          onRestart={() => void s.restart()}
          muted={s.muted}
          onToggleMute={s.toggleMute}
          onExit={() => setConfirmingExit(true)}
        />
      )}
      {state.phase === 'paused' && confirmingExit && (
        <ConfirmDialog
          title="Leave the dungeon?"
          message="Your run progress will be lost."
          confirmLabel="Leave"
          cancelLabel="Stay"
          onConfirm={() => {
            setConfirmingExit(false)
            s.exit()
          }}
          onCancel={() => setConfirmingExit(false)}
        />
      )}
      {state.phase === 'defeated' && (
        <DefeatOverlay onRetry={() => void s.restart()} xp={state.xp} score={state.score} />
      )}
      {showVictory && (
        <VictoryOverlay
          summary={state.summary}
          pending={!state.summary && !s.finishError}
          error={s.finishError}
          onRetry={() => void s.retryFinish()}
          onPlayAgain={() => void s.playAgain()}
          onExit={s.exit}
        />
      )}
    </main>
  )
}
