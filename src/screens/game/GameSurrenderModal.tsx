import { useState } from "react";

import { Button } from "../../components/ui";
import { Modal } from "../../components/ui";

type GameSurrenderModalProps = {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};

export function GameSurrenderModal({ onCancel, onConfirm }: GameSurrenderModalProps) {
  const [actionPending, setActionPending] = useState(false);

  return (
    <Modal
      actions={
        <>
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
        </>
      }
      description="This ends the game immediately for both players."
      title="Surrender match?"
    ></Modal>
  );
}
