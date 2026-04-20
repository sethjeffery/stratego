import { useState } from "react";

import { Button } from "../../components/Button";
import styles from "./GameSurface.module.css";

type GameSurrenderModalProps = {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function GameSurrenderModal({ onCancel, onConfirm }: GameSurrenderModalProps) {
  const [actionPending, setActionPending] = useState(false);

  return (
    <div className={styles.completionModalBackdrop} role="presentation">
      <section aria-modal="true" className={styles.completionModal} role="dialog">
        <h2>Surrender match?</h2>
        <p>This ends the game immediately for both players.</p>
        <div className={styles.completionActions}>
          <Button disabled={actionPending} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={actionPending}
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onConfirm().finally(() => setActionPending(false));
            }}
            variant="primary"
          >
            Surrender
          </Button>
        </div>
      </section>
    </div>
  );
}
