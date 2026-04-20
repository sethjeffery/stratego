import { Button } from "../../components/Button";
import styles from "./GameSurface.module.css";

type GameSetupActionsProps = {
  canMarkReady: boolean;
  onMarkReady: () => Promise<void> | void;
};

export function GameSetupActions({ canMarkReady, onMarkReady }: GameSetupActionsProps) {
  if (!canMarkReady) return null;

  return (
    <Button className={styles.gameReadyButton} onClick={() => void onMarkReady()}>
      Ready
    </Button>
  );
}
