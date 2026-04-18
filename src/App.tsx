import { Navigate, Route, Routes } from "react-router-dom";

import { DASHBOARD_ROUTE } from "./app/constants";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardScreen } from "./screens/DashboardScreen";
import { SessionAccessScreen } from "./screens/SessionAccessScreen";

export function App() {
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
