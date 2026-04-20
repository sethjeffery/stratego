import { useLocation } from "react-router-dom";

import {
  DEBUG_BOARD_PARAM,
  DEBUG_SESSION_FIXTURE_PARAM,
  DEBUG_SESSION_ROLE_PARAM,
} from "../app/constants";
import { DEFAULT_SESSION_FIXTURE_ID } from "../fixtures/sessionFixtures";
import { DashboardScreen } from "./DashboardScreen";
import { FixtureDebugGameScreen } from "./game/FixtureDebugGameScreen";

export function DashboardOrDebugScreen() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const fixtureId =
    params.get(DEBUG_SESSION_FIXTURE_PARAM) ??
    (params.has(DEBUG_BOARD_PARAM) ? DEFAULT_SESSION_FIXTURE_ID : null);

  if (!fixtureId) {
    return <DashboardScreen />;
  }

  return (
    <FixtureDebugGameScreen
      fixtureId={fixtureId}
      role={
        params.get(DEBUG_SESSION_ROLE_PARAM) === "challenger"
          ? "challenger"
          : "initiator"
      }
    />
  );
}
