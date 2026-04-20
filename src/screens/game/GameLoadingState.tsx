import clsx from "clsx";

import { Button } from "../../components/Button";
import styles from "../SessionAccessScreen.module.css";

type GameLoadingStateProps = {
  onLeave: () => void;
  sessionId: string;
};

export function GameLoadingState({ onLeave, sessionId }: GameLoadingStateProps) {
  return (
    <main className={styles.sessionAccess}>
      <section className={clsx("card", styles.statusCard)}>
        <p className="eyebrow">Preparing Match</p>
        <h1>Session {sessionId}</h1>
        <p>Waiting for both players to be ready.</p>
        <Button onClick={onLeave} variant="secondary">
          Back To Dashboard
        </Button>
      </section>
    </main>
  );
}
