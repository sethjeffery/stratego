import { useState } from "react";

import { Modal } from "../../screens/game/Modal";
import { Button } from "../Button";

export function ArchiveSessionModal({
  onCancel,
  onConfirm,
  sessionId,
}: {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  sessionId: string;
}) {
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
          >
            Archive
          </Button>
        </>
      }
      description={`This will remove ${sessionId} from your lobby.`}
      title="Archive session?"
    />
  );
}
