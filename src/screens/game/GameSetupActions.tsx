type GameSetupActionsProps = {
  canMarkReady: boolean;
  onMarkReady: () => void | Promise<void>;
};

export function GameSetupActions({
  canMarkReady,
  onMarkReady,
}: GameSetupActionsProps) {
  if (!canMarkReady) return null;

  return (
    <button className="game-ready-button" onClick={() => void onMarkReady()}>
      Ready
    </button>
  );
}
