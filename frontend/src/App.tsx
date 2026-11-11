import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import CampaignPage from './campaign/CampaignPage';
import CampaignPlayPage from './campaign/CampaignPlayPage';
import { devFloorsRoute } from './campaign/devRoute';
import NameScreen from './identity/NameScreen';
import PathChoicePage from './identity/PathChoice';
import { DashboardHaunt } from './haunt/DashboardHaunt';
import HauntPage from './haunt/HauntPage';
import ModePlayPage from './haunt/ModePlayPage';
import { devScorecardRoute } from './scorecard/devRoute';
import LeaderboardPage from './leaderboard/LeaderboardPage';
import DashboardPage from './pages/DashboardPage';
import LandingPage from './pages/LandingPage';
import { OfflineLabel } from './components/OfflineLabel';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import PlayPage from './pages/PlayPage';
import SettingsPage from './pages/SettingsPage';
import UploadPage from './upload/UploadPage';
import PacksPage from './packs/PacksPage';
import PackUnlockedPage from './packs/PackUnlockedPage';
import AllPacksCompletePage from './packs/AllPacksCompletePage';
import { useSession } from './state/SessionContext';
import { useTouchMode } from './touch/useTouchMode';

function RequireSession({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  // Sets html[data-touch] on touch devices (or ?touch=1) so every screen gets 44px targets.
  useTouchMode();
  return (
    <>
      <OfflineLabel />
      <AppRoutes />
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/play-as-guest" element={<NameScreen />} />
      <Route
        path="/choose"
        element={
          <RequireSession>
            <PathChoicePage />
          </RequireSession>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Readable by guests: both screens work without a session. */}
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/dashboard" element={<DashboardPage dailyHauntSlot={<DashboardHaunt />} />} />
      {/* Signed-in players upload here; guests see a sign-up prompt on the page itself. */}
      <Route path="/packs" element={<RequireSession><PacksPage /></RequireSession>} />
      <Route path="/packs/unlocked/:packId" element={<RequireSession><PackUnlockedPage /></RequireSession>} />
      <Route path="/packs/complete" element={<RequireSession><AllPacksCompletePage /></RequireSession>} />
      <Route path="/upload" element={<UploadPage />} />
      <Route
        path="/settings"
        element={
          <RequireSession>
            <SettingsPage />
          </RequireSession>
        }
      />
      {devFloorsRoute()}
      {devScorecardRoute()}
      <Route
        path="/campaign/:dungeonId"
        element={
          <RequireSession>
            <CampaignPage />
          </RequireSession>
        }
      />
      <Route
        path="/campaign/:dungeonId/play/:floorId"
        element={
          <RequireSession>
            <CampaignPlayPage />
          </RequireSession>
        }
      />
      <Route
        path="/campaign/:dungeonId/mode/:mode/:floorId?"
        element={
          <RequireSession>
            <ModePlayPage />
          </RequireSession>
        }
      />
      <Route
        path="/haunt/:dungeonId"
        element={
          <RequireSession>
            <HauntPage />
          </RequireSession>
        }
      />
      {/* Legacy: the whole dungeon in one run, without the floor map. */}
      <Route
        path="/play"
        element={
          <RequireSession>
            <PlayPage />
          </RequireSession>
        }
      />
    </Routes>
  );
}
