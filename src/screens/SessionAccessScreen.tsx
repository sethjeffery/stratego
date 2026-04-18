import clsx from "clsx";
import { Link, useParams } from "react-router";

import { buildSessionUrl } from "../app/sessionRouting";
import { useJoinSession, useSession } from "../hooks/useGameService";
import { useCurrentUser } from "../hooks/useProfile";
import { resolveAvatarUrl } from "../lib/playerProfile";
import { GameScreen } from "./GameScreen";
import styles from "./SessionAccessScreen.module.css";

const formatUpdatedAt = (timestamp?: string) => {
  if (!timestamp) return "Unknown";
  return new Date(timestamp).toLocaleString();
};

export function SessionAccessScreen() {
  const { sessionId: rawSessionId } = useParams();
  const sessionId = rawSessionId ? rawSessionId.toUpperCase() : "";
  const { data: session, isLoading: isLoadingSession } = useSession(sessionId);
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { trigger: joinSession } = useJoinSession();

  const handleJoinSession = async () => {
    await joinSession({ sessionId });
  };

  // const [error, setError] = useState<string | null>(null);

  // const {
  //   data: routeAccess,
  //   error: routeAccessError,
  //   isLoading,
  // } = useSessionAccess(sessionId);

  // const {
  //   disabled,
  //   finishGame,
  //   isCurrentSessionArchived: isArchived,
  //   legalTargets,
  //   markReady,
  //   myId,
  //   onCellClick,
  //   pendingBoardAction,
  //   playAgain,
  //   reset,
  //   selectablePieceKeys,
  //   selected,
  //   sendChatMessage,
  //   state,
  //   surrenderGame,
  // } = useSessionGameState({
  //   debugBoardEnabled: isDebugBoardEnabled(location.search),
  //   routeSessionId: sessionId,
  //   sessionAccess: routeAccess,
  //   setError,
  // });

  const copySessionLink = async (sessionId: string) => {
    // if (typeof navigator === "undefined" || !navigator.clipboard) {
    // setUiError(`Share this link: ${buildSessionUrl(sessionId)}`);
    // return;
    // }

    // try {
    await navigator.clipboard.writeText(buildSessionUrl(sessionId));
    // setUiError("Session link copied.");
    // } catch {
    // setUiError(`Share this link: ${buildSessionUrl(sessionId)}`);
    // }
  };

  const isLoading = isLoadingSession || isLoadingUser;
  if (isLoading) {
    return (
      <main className={styles.sessionAccess}>
        <section className={clsx("card", styles.statusCard)}>
          <p className="eyebrow">Loading Session</p>
          <h1>Resolving {sessionId}</h1>
          <p>Checking the latest session status and your device membership.</p>
        </section>
      </main>
    );
  }

  const isMissing = !session;
  if (isMissing) {
    return (
      <main className={styles.sessionAccess}>
        <section className={clsx("card", styles.statusCard)}>
          <p className="eyebrow">Session Unavailable</p>
          <h1>{sessionId}</h1>
          <p>
            This session could not be found. It may have expired, or the link may be
            incorrect.
          </p>
          <div className={styles.statusActions}>
            <Link to="/">
              <button className="secondary-button">Back To Dashboard</button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { initiator, challenger } = session;
  const isHost = Boolean(initiator?.device_id === currentUser?.device_id);
  const isMember = [challenger?.device_id, initiator?.device_id].includes(
    currentUser?.device_id,
  );
  const isReady = Boolean(challenger?.device_id && initiator?.device_id);

  if (session.challenger && session.initiator && isMember) {
    return <GameScreen session={session} />;
  }

  const hasOpenSlot = !challenger;
  const isFull = !isMember && isReady;
  const isClosed = session.state?.phase === "closed";
  const isArchived = Boolean(
    session.memberships?.some(
      ({ archived_at, device_id }) =>
        archived_at && device_id === currentUser?.device_id,
    ),
  );

  let eyebrow = "Session Access";
  let title = `Session ${session.session_id}`;
  let description =
    "This session is available from a link, but your device does not control a seat in it.";

  if (isClosed) {
    eyebrow = "Match Closed";
    description = "This match has been finished and permanently closed by a player.";
  } else if (isArchived && isMember) {
    eyebrow = "Session Archived";
    description =
      "This device is already a participant, but the session is archived for now. Reopen it to keep playing.";
  } else if (isMember && hasOpenSlot && isHost) {
    eyebrow = "Waiting For Opponent";
    description = `You are hosting this session as ${initiator?.player_name}. Share the link and wait for a challenger to join.`;
  } else if (!isMember && hasOpenSlot) {
    eyebrow = "Open Seat";
    title = `${initiator?.player_name} is waiting`;
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
    <main className={styles.sessionAccess}>
      <section className={clsx("card", styles.statusCard)}>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>

        <div className={styles.meta}>
          <span className={`status-pill ${hasOpenSlot ? "is-open" : "is-full"}`}>
            {isClosed ? "Closed" : hasOpenSlot ? "Open Seat" : "Two Players Joined"}
          </span>
          <small>Updated {formatUpdatedAt(session.updated_at)}</small>
        </div>

        <div className={styles.playerList}>
          {initiator ? (
            <article className={styles.playerRow}>
              <img
                className="player-avatar"
                src={resolveAvatarUrl(initiator.avatar_id)}
                alt={initiator.player_name}
              />
              <div>
                <strong>{initiator.player_name}</strong>
                <p>Host</p>
              </div>
            </article>
          ) : null}

          {challenger ? (
            <article className={styles.playerRow}>
              <img
                className="player-avatar"
                src={resolveAvatarUrl(challenger.avatar_id)}
                alt={challenger.player_name}
              />
              <div>
                <strong>{challenger.player_name}</strong>
                <p>Challenger</p>
              </div>
            </article>
          ) : (
            <article className={clsx(styles.playerRow, styles.playerRowEmpty)}>
              <div className={styles.emptyAvatar}>?</div>
              <div>
                <strong>Open Challenger Seat</strong>
                <p>Waiting for a challenger</p>
              </div>
            </article>
          )}
        </div>

        <div className={styles.linkBlock}>
          <small>Share link</small>
          <code>{buildSessionUrl(session.session_id)}</code>
        </div>

        <div className={styles.statusActions}>
          {((hasOpenSlot && !isMember) || isArchived) && !isClosed && (
            <button className="primary-cta" onClick={() => handleJoinSession}>
              {isArchived ? "Reopen Session" : "Join Session"}
            </button>
          )}
          {isMember && hasOpenSlot && !isClosed && !isArchived && (
            <button
              className="secondary-button"
              onClick={() => void copySessionLink(session.session_id)}
            >
              Copy Session Link
            </button>
          )}
          <Link to="/">
            <button className="secondary-button">Back To Dashboard</button>
          </Link>
        </div>
      </section>
    </main>
  );
}
