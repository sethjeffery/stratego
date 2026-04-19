type GameToolbarProps = {
  canSurrender: boolean;
  isMyTurn: boolean;
  mainStatus: string;
  onLeave: () => void;
  onRequestSurrender: () => void;
};

export function GameToolbar({
  canSurrender,
  isMyTurn,
  mainStatus,
  onLeave,
  onRequestSurrender,
}: GameToolbarProps) {
  return (
    <div className="arena-toolbar">
      <button
        className="icon-button exit-button"
        onClick={onLeave}
        aria-label="Leave session"
        title="Leave session"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 6l-6 6 6 6M21 12H9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={`game-status-lozenge ${isMyTurn ? "is-active" : ""}`}>
        {mainStatus}
      </div>
      <div className="toolbar-actions">
        <button
          className="icon-button surrender-button"
          onClick={onRequestSurrender}
          aria-label="Surrender"
          title="Surrender"
          disabled={!canSurrender}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 4v16M7 5c5.5-2.3 8.4 1.8 12 0v9c-3.6 1.8-6.5-2.3-12 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
