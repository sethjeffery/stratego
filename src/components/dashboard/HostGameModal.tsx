import { useState } from "react";

import { defaultGameSetupId, gameSetups } from "../../lib/gameConfig";
import { Modal } from "../../screens/game/Modal";
import { Button } from "../Button";
import styles from "./HostGameModal.module.css";

type HostGameModalProps = {
  onCancel: () => void;
  onConfirm: (setupId: string) => Promise<void>;
};

export function HostGameModal({ onCancel, onConfirm }: HostGameModalProps) {
  const [selectedSetupId, setSelectedSetupId] = useState(defaultGameSetupId);
  const [submitting, setSubmitting] = useState(false);

  const selectedSetup = gameSetups.find((setup) => setup.id === selectedSetupId);

  return (
    <Modal
      actions={
        <>
          <Button disabled={submitting} onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={submitting || !selectedSetup}
            onClick={() => {
              if (!selectedSetup || submitting) return;
              setSubmitting(true);
              void onConfirm(selectedSetup.id).finally(() => setSubmitting(false));
            }}
            variant="primary"
          >
            {submitting ? "Hosting..." : "Host game"}
          </Button>
        </>
      }
      description="Choose the battle setup for this lobby."
      title="Host game"
    >
      <div className={styles.optionList}>
        {gameSetups.map((setup) => (
          <button
            className={styles.optionCard}
            data-selected={setup.id === selectedSetupId}
            key={setup.id}
            onClick={() => setSelectedSetupId(setup.id)}
            type="button"
          >
            <div className={styles.optionHeader}>
              <strong>{setup.name}</strong>
            </div>
            <p>{setup.description}</p>
          </button>
        ))}
      </div>
    </Modal>
  );
}
