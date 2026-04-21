import { Button } from "../../components/ui";
import styles from "./GameSurface.module.css";

type GameSetupActionsProps = {
  canMarkReady: boolean;
  onMarkReady: () => Promise<void> | void;
};

export function GameSetupActions({ canMarkReady, onMarkReady }: GameSetupActionsProps) {
  if (!canMarkReady) return null;

  return (
    <>
      <p>Click your pieces to swap their positions.</p>
      <Button className={styles.gameReadyButton} onClick={() => void onMarkReady()}>
        Ready
      </Button>
    </>
  );
}
