type GameLoadingStateProps = {
  onLeave: () => void;
  sessionId: string;
};

export function GameLoadingState({
  onLeave,
  sessionId,
}: GameLoadingStateProps) {
  return (
    <main className="session-access">
      <section className="session-status-card card">
        <p className="eyebrow">Preparing Match</p>
        <h1>Session {sessionId}</h1>
        <p>Waiting for both players to be ready.</p>
        <button className="secondary-button" onClick={onLeave}>
          Back To Dashboard
        </button>
      </section>
    </main>
  );
}
