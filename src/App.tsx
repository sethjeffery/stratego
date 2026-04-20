import { Navigate, Route, Routes } from "react-router-dom";

import { DASHBOARD_ROUTE } from "./app/constants";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardOrDebugScreen } from "./screens/DashboardOrDebugScreen";
import { SessionAccessScreen } from "./screens/SessionAccessScreen";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route element={<DashboardOrDebugScreen />} path={DASHBOARD_ROUTE} />
        <Route element={<SessionAccessScreen />} path="/game/:sessionId" />
        <Route element={<Navigate replace to={DASHBOARD_ROUTE} />} path="*" />
      </Routes>
    </AppLayout>
  );
}
