import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPlaceholder from './pages/LoginPlaceholder';
import PlayPage from './pages/PlayPage';
import { useSession } from './state/SessionContext';

function RequireSession({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return user ? <>{children}</> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPlaceholder />} />
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
