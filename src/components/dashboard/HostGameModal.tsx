import { useState } from "react";

import { Modal } from "../../components/ui";
import {
  AI_INTELLIGENCE_OPTIONS,
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
  const [challengerAiIntelligence, setChallengerAiIntelligence] = useState(
    DEFAULT_AI_INTELLIGENCE,
  );
  const [initiatorAiIntelligence, setInitiatorAiIntelligence] = useState(
    DEFAULT_AI_INTELLIGENCE,
  );
  const [submitting, setSubmitting] = useState(false);

  const selectedSetup = gameSetups.find((setup) => setup.id === selectedSetupId);
  const needsChallengerAi = matchup === "human_vs_ai" || matchup === "ai_vs_ai";
  const needsInitiatorAi = matchup === "ai_vs_ai";

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
                challengerAiIntelligence,
                initiatorAiIntelligence,
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
        <div className={styles.sectionLabel}>Game options</div>
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
        <div className={styles.sectionLabel}>Players</div>
        <div className={styles.matchupGrid}>
          {[
            {
              description: "Create an open lobby for another player to join.",
              id: "human_vs_human",
              title: "Human vs Human",
            },
            {
              description: "Start immediately against a locally hosted AI opponent.",
              id: "human_vs_ai",
              title: "Human vs AI",
            },
            {
              description: "Run both armies as AIs on this device for debugging.",
              id: "ai_vs_ai",
              title: "AI vs AI",
            },
          ].map((option) => (
            <button
              className={styles.matchupCard}
              data-selected={option.id === matchup}
              key={option.id}
              onClick={() => setMatchup(option.id as HostedGameMode)}
              type="button"
            >
              <div className={styles.optionHeader}>
                <strong>{option.title}</strong>
              </div>
              <p>{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {(needsInitiatorAi || needsChallengerAi) && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>AI intelligence</div>
          <div className={styles.aiSettings}>
            {needsInitiatorAi ? (
              <label className={styles.aiField}>
                <span>Red AI intelligence</span>
                <select
                  onChange={(event) =>
                    setInitiatorAiIntelligence(Number(event.target.value))
                  }
                  value={initiatorAiIntelligence}
                >
                  {AI_INTELLIGENCE_OPTIONS.map((level) => (
                    <option key={`initiator-ai-${level}`} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {needsChallengerAi ? (
              <label className={styles.aiField}>
                <span>Blue AI intelligence</span>
                <select
                  onChange={(event) =>
                    setChallengerAiIntelligence(Number(event.target.value))
                  }
                  value={challengerAiIntelligence}
                >
                  {AI_INTELLIGENCE_OPTIONS.map((level) => (
                    <option key={`challenger-ai-${level}`} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </div>
      )}
    </Modal>
  );
}
