import { useState } from "react";

type GameSurrenderModalProps = {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function GameSurrenderModal({
  onCancel,
  onConfirm,
}: GameSurrenderModalProps) {
  const [actionPending, setActionPending] = useState(false);

  return (
    <div className="completion-modal-backdrop" role="presentation">
      <section className="completion-modal" role="dialog" aria-modal="true">
        <h2>Surrender match?</h2>
        <p>This ends the game immediately for both players.</p>
        <div className="completion-actions">
          <button
            className="secondary-button"
            onClick={onCancel}
            disabled={actionPending}
          >
            Cancel
          </button>
          <button
            className="primary-cta"
            onClick={() => {
              if (actionPending) return;
              setActionPending(true);
              void onConfirm().finally(() => setActionPending(false));
            }}
            disabled={actionPending}
          >
            Surrender
          </button>
        </div>
      </section>
    </div>
  );
}
