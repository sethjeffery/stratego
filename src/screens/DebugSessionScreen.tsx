import clsx from "clsx";
import { Link, useLocation } from "react-router-dom";

import { getDebugSessionSelection } from "../app/runtimeConfig";
import { Button } from "../components/Button";
import {
  DEFAULT_SESSION_FIXTURE_ID,
  getSessionFixture,
  listSessionFixtureIds,
} from "../fixtures/sessionFixtures";
import { useSession } from "../hooks/useGameService";
import { ensureMemoryFixtureSession } from "../lib/memoryGameService";
import { GameScreen } from "./GameScreen";
import styles from "./SessionAccessScreen.module.css";

export function DebugSessionScreen() {
  const location = useLocation();
  const selection = getDebugSessionSelection(location.search);
  const fixtureId = selection?.fixtureId ?? DEFAULT_SESSION_FIXTURE_ID;
  const fixture = getSessionFixture(fixtureId);
  const sessionId = fixture?.session_id ?? null;

  if (fixture) {
    ensureMemoryFixtureSession(fixtureId);
  }

  const { data: session } = useSession(sessionId);

  if (!fixture) {
    return (
      <main className={styles.sessionAccess}>
        <section className={clsx("card", styles.statusCard)}>
          <p className="eyebrow">Unknown Fixture</p>
          <h1>{fixtureId}</h1>
          <p>
            Choose one of the available session fixtures to boot the in-memory debug
            game.
          </p>
          <code>{listSessionFixtureIds().join(", ")}</code>
          <div className={styles.statusActions}>
            <Link to="/">
              <Button variant="secondary">Back To Dashboard</Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.sessionAccess}>
        <section className={clsx("card", styles.statusCard)}>
          <p className="eyebrow">Loading Fixture</p>
          <h1>{fixtureId}</h1>
          <p>Booting the in-memory session store from the selected fixture.</p>
        </section>
      </main>
    );
  }

  return <GameScreen session={session} />;
}
