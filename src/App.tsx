import { Navigate, Route, Routes } from "react-router-dom";

import { DASHBOARD_ROUTE } from "./app/constants";
import { AppLayout } from "./layouts/AppLayout";
import { DashboardScreen } from "./screens/DashboardScreen";
import { SessionAccessScreen } from "./screens/SessionAccessScreen";

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route element={<DashboardScreen />} path={DASHBOARD_ROUTE} />
        <Route element={<SessionAccessScreen />} path="/game/:sessionId" />
        <Route element={<Navigate replace to={DASHBOARD_ROUTE} />} path="*" />
      </Routes>
    </AppLayout>
  );
}
