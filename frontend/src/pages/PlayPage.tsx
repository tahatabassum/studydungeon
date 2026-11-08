import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AppShell } from '@/components/AppShell'
import { ControlsLegend } from '@/components/ControlsLegend'
import { DefeatOverlay } from '@/components/DefeatOverlay'
import { FullscreenButton } from '@/components/FullscreenButton'
import { GuestBanner } from '@/components/GuestBanner'
import { Hud } from '@/components/Hud'
import { Panel } from '@/components/Panel'
import { PauseMenu } from '@/components/PauseMenu'
import { QuestionPanel } from '@/components/QuestionPanel'
import { Spinner } from '@/components/Spinner'
import { VictoryOverlay } from '@/components/VictoryOverlay'
import { GameCanvas } from '@/game/GameCanvas'
import { hudMode } from '@/game/viewport'
import { useFullscreen } from '@/shell/useFullscreen'
import { useViewportWidth } from '@/shell/useViewportWidth'
import { damageReceived, isCombatActive } from '@/state/combatMachine'
import { useSession } from '@/state/SessionContext'
import { usePlaySession } from './usePlaySession'

export default function PlayPage() {
  const { user } = useSession()
  const [s, gameWrapRef] = usePlaySession()
  const { state, room } = s
  const [confirmingExit, setConfirmingExit] = useState(false)
  const fullscreen = useFullscreen()
  const compact = hudMode(useViewportWidth()) === 'compact'

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
    <AppShell announcement={fullscreen.message}>
      {/* The canvas fills the whole shell; the backdrop shows through its transparent clear colour. */}
      <div ref={gameWrapRef} className="absolute inset-0 z-[1]">
        <GameCanvas bridge={s.bridge} className="absolute inset-0 size-full" />
      </div>

      {showTopicCleared && !s.clearError && (
        <div className="pointer-events-none absolute inset-x-0 top-28 z-10 flex justify-center">
          <Panel tone="gold" role="status" className="px-6 py-3 text-lg font-bold text-accent">
            Room cleared! +{s.clearedXp} XP — the gate opens
          </Panel>
        </div>
      )}

      {s.clearError && (
        <div className="absolute inset-x-0 top-28 z-10 flex justify-center">
          <Panel tone="danger" role="alert" className="flex items-center gap-3 px-6 py-3">
            <span>{s.clearError}</span>
            <Button variant="secondary" onClick={() => void s.retryClear()}>
              Retry
            </Button>
          </Panel>
        </div>
      )}

      {/* Floating HUD: top bar over the stage, kept out of the hudSafeBand. */}
      <div className="sd-hud-top">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Hud
              compact={compact}
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
            {!compact && <GuestBanner isGuest={user?.is_guest ?? false} />}
          </div>
          <FullscreenButton isFullscreen={fullscreen.isFullscreen} onToggle={() => void fullscreen.toggle()} />
        </div>
      </div>

      <ControlsLegend compact={compact} />

      {/* Until the Phase 2 pop-up, the question panel is a bottom sheet over the stage. */}
      {panelVisible && s.question && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--sd-hud-bottom)+0.5rem)] z-30 flex justify-center px-3">
          <div className="@container pointer-events-auto max-h-[min(60dvh,32rem)] w-full max-w-3xl overflow-y-auto overflow-x-hidden">
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
        </div>
      )}

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
    </AppShell>
  )
}
