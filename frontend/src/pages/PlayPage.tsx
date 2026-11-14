import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { AppShell } from '@/components/AppShell'
import { ControlsLegend } from '@/components/ControlsLegend'
import { DefeatOverlay } from '@/components/DefeatOverlay'
import { FullscreenButton } from '@/components/FullscreenButton'
import { GuestBanner, GUEST_BANNER_MS } from '@/components/GuestBanner'
import { Hud } from '@/components/Hud'
import { Panel } from '@/components/Panel'
import { PauseMenu } from '@/components/PauseMenu'
import { Spinner } from '@/components/Spinner'
import { EncounterPopup } from '@/encounter/EncounterPopup'
import { REVENANT_KIND } from '@/encounter/revenants'
import { GameCanvas } from '@/game/GameCanvas'
import { hudMode } from '@/game/viewport'
import { ExamTimer } from '@/haunt/ExamTimer'
import { HauntFinale } from '@/haunt/HauntFinale'
import type { ExamMinutes } from '@/haunt/modes'
import '../styles/haunt.css'
import { Scorecard } from '@/scorecard/Scorecard'
import { ChestOverlay } from '@/rewards/ChestOverlay'
import { chestView } from '@/rewards/chestView'
import type { RunSummary } from '@/types/api'
import { useFullscreen } from '@/shell/useFullscreen'
import { useViewportHeight, useViewportWidth } from '@/shell/useViewportWidth'
import { RotateHint } from '@/touch/RotateHint'
import { TouchControls } from '@/touch/TouchControls'
import { useTouchMode } from '@/touch/useTouchMode'
import { PauseButton } from '@/components/PauseButton'
import { damageReceived, isCombatActive } from '@/state/combatMachine'
import { displayHandle } from '@/identity/handle'
import { useSession } from '@/state/SessionContext'
import { usePackContinue } from '@/packs/usePackContinue'
import { campaignPath, usePlaySession, type PlayScope } from './usePlaySession'

export interface PlayPageProps {
  /** Campaign play: only this Floor's rooms. Absent means the whole dungeon (the legacy `/play` route). */
  scope?: PlayScope
  /** Exam only: timer length in minutes. Absent or null means no timer (the default). */
  examMinutes?: ExamMinutes | null
}

export default function PlayPage({ scope, examMinutes = null }: PlayPageProps = {}) {
  const { user } = useSession()
  const navigate = useNavigate()
  const [s, gameWrapRef] = usePlaySession(scope)
  const { state, room } = s
  const [confirmingExit, setConfirmingExit] = useState(false)
  // The summary whose Chest was collected (a new run brings a new summary, so its Chest shows again).
  const [chestSeen, setChestSeen] = useState<RunSummary | null>(null)
  // Lives here (not in the banner) so it survives restart / Play again within one page visit.
  const [guestBannerDone, setGuestBannerDone] = useState(false)
  const fullscreen = useFullscreen()
  const touch = useTouchMode()
  const [rotateDismissed, setRotateDismissed] = useState(false)
  const viewportHeight = useViewportHeight()
  // A short landscape phone also gets the compact HUD, so the top bar leaves room for the stage.
  const compact = hudMode(useViewportWidth()) === 'compact' || (touch && viewportHeight < 480)
  const bridge = s.bridge
  const packContinue = usePackContinue(state.summary, s.campaign?.isFinal === true && s.campaign.unit === 'floor', s.exit)
  useEffect(() => {
    // In-world prompts say "Tap Engage" instead of "Press E". Only sent in touch mode (desktop is unchanged).
    if (touch) bridge.send({ type: 'set-touch-mode', value: true })
  }, [touch, bridge])

  if (s.loadError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-ink">
        <p role="alert">{s.loadError}</p>
        <Link to={scope ? campaignPath(scope.dungeonId) : '/'} className="underline">
          {scope ? 'Back to the map' : 'Back to start'}
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

  // The run ends with its last room (the boss, the last topic of a practice run, the last hall); the timer can end it early.
  const bossCleared = state.bossRoomId !== null && s.clearedRoomIds.includes(state.bossRoomId)
  const showVictory =
    state.phase === 'victory' || s.timeUp || (bossCleared && state.phase === 'cleared' && !state.summary)
  const haunt = s.hall !== null
  const showTopicCleared = state.phase === 'cleared' && !room.is_boss && s.clearedXp !== null && !bossCleared
  const showHallRest = haunt && state.phase === 'cleared' && !bossCleared && !showVictory
  // The Chest shows once per summary, only when the Backend sent rewards (empty or missing: skipped).
  const chestVisible = state.summary !== null && state.summary !== chestSeen && chestView(state.summary.chest_rewards) !== null
  const combatActive = isCombatActive(state.combat)
  const panelVisible = combatActive && s.question !== null
  // Touch controls show only while exploring: not during a fight, pause, defeat, victory or error banner.
  const controlsVisible =
    state.phase === 'exploring' && !combatActive && !showVictory && !confirmingExit && !s.clearError && !chestVisible
  const pauseVisible = (state.phase === 'exploring' || state.phase === 'encounter') && !showVictory

  return (
    <AppShell announcement={fullscreen.message} className="sd-shell--play">
      {/* The canvas fills the whole shell; the backdrop shows through its transparent clear colour. */}
      <div ref={gameWrapRef} className="sd-game-area absolute inset-0 z-[1]">
        <GameCanvas bridge={s.bridge} className="absolute inset-0 size-full" />
      </div>

      {haunt && <div className="sd-hall-veil" aria-hidden="true" data-testid="hall-veil" />}

      {haunt && !showVictory && (
        <div className="sd-hall-banner">
          <Panel tone="gold" className="sd-hall-banner__chip" role={showHallRest ? 'status' : undefined}>
            {showHallRest
              ? 'This hall is at rest. The gate opens.'
              : touch
                ? 'Haunted Hall: walk up to a ghost and tap Engage to face the memory'
                : 'Haunted Hall: walk up to a ghost and press E to face the memory'}
          </Panel>
        </div>
      )}

      {examMinutes !== null && scope?.mode === 'exam' && !showVictory && state.phase !== 'defeated' && (
        <ExamTimer minutes={examMinutes} onExpire={s.finishExam} />
      )}

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
              // A Revenant encounter never shows the (defeated) room monster's bar.
              showMonster={(combatActive && !state.revenantActive) || state.monsterHp > 0}
              xp={state.xp}
              streak={state.streak}
              combo={s.combo}
              level={s.progress?.level}
              xpToNext={s.progress?.xp_to_next}
              totalXp={s.progress?.total_xp}
              rooms={s.rooms}
              currentRoomId={s.currentRoomId}
              clearedRoomIds={s.clearedRoomIds}
              hauntedDue={s.hauntedDue}
              roomNoun={haunt ? 'Hall' : undefined}
              playerName={user ? displayHandle(user) : undefined}
            />
            {!compact && !guestBannerDone && (
              <GuestBanner
                isGuest={user?.is_guest ?? false}
                handle={user ? displayHandle(user) : undefined}
                autoHideMs={GUEST_BANNER_MS}
                onDone={() => setGuestBannerDone(true)}
              />
            )}
          </div>
          {touch && pauseVisible && <PauseButton onPause={s.togglePause} />}
          {/* iOS has no Fullscreen API: on touch devices the button is hidden when unsupported. */}
          {(!touch || fullscreen.supported) && (
            <FullscreenButton isFullscreen={fullscreen.isFullscreen} onToggle={() => void fullscreen.toggle()} />
          )}
        </div>
      </div>

      {/* In touch mode the legend sits above the controls, so it hides with them (never over the popup). */}
      {(!touch || controlsVisible) && <ControlsLegend compact={compact} touch={touch} />}
      {touch && controlsVisible && !rotateDismissed && <RotateHint onDismiss={() => setRotateDismissed(true)} />}
      {/* Hidden while the popup, pause or any overlay is open, so it never covers them. */}
      {touch && controlsVisible && <TouchControls bridge={s.bridge} />}

      {/* Character-led encounter: scrim, sliding portrait and speech panel over the full-viewport canvas. */}
      <EncounterPopup
        question={panelVisible ? s.question : null}
        combat={state.combat}
        monsterName={room.monster.name}
        monsterKind={s.revenantView ? REVENANT_KIND : room.monster.kind}
        isRevenant={s.revenantView}
        isBoss={room.is_boss && !s.revenantView}
        roomOrder={room.order}
        error={s.answerError}
        result={state.lastResult}
        damageReceived={state.lastResult ? damageReceived(state.prevPlayerHp, state.lastResult) : undefined}
        onAnswer={(sel) => void s.onAnswer(sel)}
        onNext={s.skipWait}
        secondChance={s.secondChance}
        requeueRemaining={s.requeueRemaining}
        onQuickRetry={s.quickRetry}
        onRetreat={s.retreat}
        keysEnabled={state.phase !== 'paused' && state.phase !== 'defeated' && !showVictory}
      />

      {state.phase === 'paused' && !confirmingExit && (
        <PauseMenu
          onResume={s.resume}
          onRetreat={state.combat === 'question' ? s.retreat : undefined}
          onRestart={() => void s.restart()}
          muted={s.muted}
          onToggleMute={s.toggleMute}
          onExit={() => setConfirmingExit(true)}
          weapons={s.progress?.weapons}
          level={s.progress?.level}
        />
      )}
      {state.phase === 'paused' && confirmingExit && (
        <ConfirmDialog
          title={s.campaign ? `Leave this ${s.campaign.unit}?` : 'Leave the dungeon?'}
          message={
            s.campaign
              ? `Your progress ${s.campaign.unit === 'floor' ? 'on' : 'in'} this ${s.campaign.unit} will be lost. You return to the map.`
              : 'Your run progress will be lost.'
          }
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
      {haunt && showVictory && state.summary && (
        <HauntFinale
          laidToRest={state.summary.correct}
          dailyStreak={s.hauntOutcome?.dailyStreak ?? null}
          dueLeft={s.hauntOutcome?.dueLeft ?? null}
          onDashboard={() => navigate('/dashboard')}
          onMap={s.exit}
        />
      )}
      {haunt && showVictory && !state.summary && (
        <div className="sd-hall-banner">
          <Panel tone={s.finishError ? 'danger' : 'gold'} role={s.finishError ? 'alert' : 'status'} className="sd-hall-banner__chip">
            {s.finishError ?? 'Counting the memories laid to rest...'}
            {s.finishError && (
              <Button variant="secondary" onClick={() => void s.retryFinish()}>
                Retry
              </Button>
            )}
          </Panel>
        </div>
      )}
      {!haunt && showVictory && !s.bossDeathHold && (
        <Scorecard
          summary={state.summary}
          pending={!state.summary && !s.finishError}
          error={s.finishError}
          received={{ score: state.score, xp: state.xp }}
          progress={s.progress}
          isGuest={user?.is_guest ?? false}
          {...(s.dungeonName ? { dungeonName: s.dungeonName } : {})}
          leaderboardEnabled={s.leaderboardEnabled}
          onViewLeaderboard={() => navigate('/leaderboard')}
          onCreateAccount={() => navigate('/register')}
          onUpgrade={() => navigate('/register?upgrade=1')}
          onRetry={() => void s.retryFinish()}
          onPlayAgain={() => void s.playAgain()}
          onExit={s.exit}
          {...(packContinue ? { onContinue: packContinue } : {})}
          {...(s.campaign
            ? {
                title: s.campaign.scorecard.title,
                subtitle: s.campaign.scorecard.subtitle,
                playAgainLabel: s.campaign.scorecard.playAgainLabel,
                exitLabel: 'Back to the map',
              }
            : {})}
        />
      )}
      {/* After the Scorecard in the tree so the Chest, mounted last, takes focus; it sits above it (z-60). */}
      {!haunt && showVictory && !s.bossDeathHold && chestVisible && (
        <ChestOverlay rewards={state.summary?.chest_rewards} onClose={() => setChestSeen(state.summary)} />
      )}
    </AppShell>
  )
}
