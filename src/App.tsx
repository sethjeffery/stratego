import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { DASHBOARD_ROUTE } from "./app/constants";
import { getDebugSessionSelection } from "./app/runtimeConfig";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardScreen } from "./screens/DashboardScreen";
import { DebugSessionScreen } from "./screens/DebugSessionScreen";
import { SessionAccessScreen } from "./screens/SessionAccessScreen";

export function App() {
  const location = useLocation();

  if (getDebugSessionSelection(location.search)) {
    return (
      <AppLayout>
        <DebugSessionScreen />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Routes>
        <Route path={DASHBOARD_ROUTE} element={<DashboardScreen />} />
        <Route path="/game/:sessionId" element={<SessionAccessScreen />} />
        <Route path="*" element={<Navigate to={DASHBOARD_ROUTE} replace />} />
      </Routes>
    </AppLayout>
  );
}
