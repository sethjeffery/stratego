import clsx from "clsx";
import { useState } from "react";

import playerVsAi from "../../assets/player_vs_ai.png";
import playerVsPlayer from "../../assets/player_vs_player.png";
import { Modal } from "../../components/ui";
import {
  type CreateSessionOptions,
  DEFAULT_AI_INTELLIGENCE,
  type HostedGameMode,
} from "../../lib/ai";
import { defaultGameSetupId, gameSetups } from "../../lib/gameConfig";
import { Button } from "../ui";
import styles from "./HostGameModal.module.css";

type HostGameModalProps = {
  onCancel: () => void;
  onConfirm: (options: CreateSessionOptions) => Promise<void>;
};

export function HostGameModal({ onCancel, onConfirm }: HostGameModalProps) {
  const [selectedSetupId, setSelectedSetupId] = useState(defaultGameSetupId);
  const [matchup, setMatchup] = useState<HostedGameMode>("human_vs_human");
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
              void onConfirm({
                challengerAiIntelligence: DEFAULT_AI_INTELLIGENCE,
                matchup,
                setupId: selectedSetup.id,
              }).finally(() => setSubmitting(false));
            }}
            variant="primary"
          >
            {submitting ? "Hosting..." : "Host game"}
          </Button>
        </>
      }
      title="Host game"
    >
      <div className={styles.section}>
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
      </div>

      <div className={styles.section}>
        <div className={clsx(styles.optionList, styles.optionPlayers)}>
          <div>
            <div className={styles.optionHeader}>PvP</div>
            <button
              className={styles.optionCard}
              data-selected={matchup === "human_vs_human"}
              key={"human_vs_human"}
              onClick={() => setMatchup("human_vs_human")}
              type="button"
            >
              <img alt="Player vs Player" src={playerVsPlayer} />
            </button>
          </div>
          <div>
            <div className={styles.optionHeader}>You vs AI</div>
            <button
              className={styles.optionCard}
              data-selected={matchup === "human_vs_ai"}
              key={"human_vs_ai"}
              onClick={() => setMatchup("human_vs_ai")}
              type="button"
            >
              <img alt="Player vs AI" src={playerVsAi} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
