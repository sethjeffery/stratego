import { resolveAvatarUrl } from "../lib/playerProfile";
import { SessionRow } from "../lib/supabaseGameService";

type SessionAccessScreenProps = {
  isLoading: boolean;
  isMissing: boolean;
  isMember: boolean;
  isHost: boolean;
  sessionId: string;
  sessionRow: SessionRow | null;
  buildSessionUrl: (sessionId: string) => string;
  copySessionLink: (sessionId: string) => Promise<void>;
  goToDashboard: () => void;
  joinSession: () => Promise<void>;
};

const formatUpdatedAt = (timestamp?: string) => {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
};

export function SessionAccessScreen({
  buildSessionUrl,
  copySessionLink,
  goToDashboard,
  isHost,
  isLoading,
  isMember,
  isMissing,
  joinSession,
  sessionId,
  sessionRow,
}: SessionAccessScreenProps) {
  if (isLoading) {
    return (
      <main className="session-access">
        <section className="session-status-card card">
          <p className="eyebrow">Loading Session</p>
          <h1>Resolving {sessionId}</h1>
          <p>Checking the latest session status and your device membership.</p>
        </section>
      </main>
    );
  }

  if (isMissing || !sessionRow) {
    return (
      <main className="session-access">
        <section className="session-status-card card">
          <p className="eyebrow">Session Unavailable</p>
          <h1>{sessionId}</h1>
          <p>
            This session could not be found. It may have expired, or the link
            may be incorrect.
          </p>
          <div className="session-status-actions">
            <button className="secondary-button" onClick={goToDashboard}>
              Back To Dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  const hasOpenSlot = !sessionRow.challenger_id;
  const isFull = Boolean(sessionRow.challenger_id);
  const isClosed = sessionRow.state?.phase === "closed";

  let eyebrow = "Session Access";
  let title = `Session ${sessionRow.session_id}`;
  let description =
    "This session is available from a link, but your device does not control a seat in it.";

  if (isClosed) {
    eyebrow = "Match Closed";
    title = `Session ${sessionRow.session_id}`;
    description = "This match has been finished and permanently closed by a player.";
  } else if (isMember && hasOpenSlot && isHost) {
    eyebrow = "Waiting For Opponent";
    description = `You are hosting this session as ${sessionRow.initiator_name}. Share the link and wait for a challenger to join.`;
  } else if (!isMember && hasOpenSlot) {
    eyebrow = "Open Seat";
    title = `${sessionRow.initiator_name} is waiting`;
    description =
      "This session has one open seat. Join from this device to become the challenger.";
  } else if (!isMember && isFull) {
    eyebrow = "Session Full";
    description =
      "This match already has two players, and this device is not part of it.";
  } else if (isMember) {
    eyebrow = "Restoring Session";
    description =
      "This device is part of the session. Restoring the active board state.";
  }

  return (
    <main className="session-access">
      <section className="session-status-card card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className="session-meta">
          <span className={`status-pill ${hasOpenSlot ? "is-open" : "is-full"}`}>
            {isClosed ? "Closed" : hasOpenSlot ? "Open Seat" : "Two Players Joined"}
          </span>
          <small>Updated {formatUpdatedAt(sessionRow.updated_at)}</small>
        </div>

        <div className="session-player-list">
          <article className="session-player-row">
            <img
              className="player-avatar"
              src={resolveAvatarUrl(sessionRow.initiator_avatar ?? undefined)}
              alt={sessionRow.initiator_name}
            />
            <div>
              <strong>{sessionRow.initiator_name}</strong>
              <p>{hasOpenSlot ? "Host" : "Player 1"}</p>
            </div>
          </article>

          {sessionRow.challenger_name ? (
            <article className="session-player-row">
              <img
                className="player-avatar"
                src={resolveAvatarUrl(sessionRow.challenger_avatar ?? undefined)}
                alt={sessionRow.challenger_name}
              />
              <div>
                <strong>{sessionRow.challenger_name}</strong>
                <p>Player 2</p>
              </div>
            </article>
          ) : (
            <article className="session-player-row is-empty">
              <div className="empty-avatar">?</div>
              <div>
                <strong>Open Challenger Seat</strong>
                <p>Waiting for a second player</p>
              </div>
            </article>
          )}
        </div>

        <div className="session-link-block">
          <small>Share link</small>
          <code>{buildSessionUrl(sessionRow.session_id)}</code>
        </div>

        <div className="session-status-actions">
          {hasOpenSlot && !isMember && !isClosed && (
            <button className="primary-cta" onClick={() => void joinSession()}>
              Join Session
            </button>
          )}
          {isMember && hasOpenSlot && !isClosed && (
            <button
              className="secondary-button"
              onClick={() => void copySessionLink(sessionRow.session_id)}
            >
              Copy Session Link
            </button>
          )}
          <button className="secondary-button" onClick={goToDashboard}>
            Back To Dashboard
          </button>
        </div>
      </section>
    </main>
  );
}
