import clsx from "clsx";
import { Link, useParams } from "react-router";

import { buildSessionUrl } from "../app/sessionRouting";
import imageDead from "../assets/dead.png";
import Avatar from "../components/Avatar";
import { Button } from "../components/Button";
import { useJoinSession, useSessionDetails } from "../hooks/useGameService";
import { useCurrentUser } from "../hooks/useProfile";
import { resolveAvatarUrl } from "../lib/playerProfile";
import { GameScreen } from "./GameScreen";
import styles from "./SessionAccessScreen.module.css";

export function SessionAccessScreen() {
  const { sessionId: rawSessionId } = useParams();
  const sessionId = rawSessionId ? rawSessionId.toUpperCase() : "";
  const { data: session, isLoading: isLoadingSession } = useSessionDetails(sessionId);
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { trigger: joinSession } = useJoinSession();

  const handleJoinSession = async () => {
    await joinSession({ sessionId });
  };

  const copySessionLink = async (sessionId: string) => {
    await navigator.clipboard.writeText(buildSessionUrl(sessionId));
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
        <section className={styles.statusCard}>
          <h1>{sessionId} ?</h1>
          <img alt="Dead soldier" className={styles.statusImage} src={imageDead} />
          <p>
            This session could not be found. It may have expired, or the link may be
            incorrect.
          </p>
          <div className={styles.statusActions}>
            <Link to="/">
              <Button>Back To Dashboard</Button>
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { challenger, initiator } = session;
  const isMember = [challenger?.device_id, initiator?.device_id].includes(
    currentUser?.device_id,
  );

  if (session.challenger && session.initiator && isMember) {
    return <GameScreen session={session} />;
  }

  const hasOpenSlot = !challenger;
  const isClosed = session.state?.phase === "closed";
  const isArchived = Boolean(
    session.memberships?.some(
      ({ archived_at, device_id }) =>
        archived_at && device_id === currentUser?.device_id,
    ),
  );

  let title = `Session ${session.session_id}`;

  if (!isClosed && !isArchived && !isMember && hasOpenSlot) {
    title = `${initiator?.player_name} is waiting`;
  }

  return (
    <main className={styles.sessionAccess}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.playerList}>
        {initiator ? (
          <article className={styles.playerRow}>
            <Avatar
              avatarUrl={resolveAvatarUrl(initiator.avatar_id)}
              color="red"
              shadow
              width={128}
            />
            <div className={styles.playerName}>{initiator.player_name}</div>
          </article>
        ) : null}
        <span>VS</span>
        {challenger ? (
          <article className={styles.playerRow}>
            <Avatar
              avatarUrl={resolveAvatarUrl(challenger.avatar_id)}
              color="blue"
              shadow
              width={128}
            />
            <div className={styles.playerName}>{challenger.player_name}</div>
          </article>
        ) : (
          <article className={clsx(styles.playerRow)}>
            <Avatar color="blue" shadow width={128} />
          </article>
        )}
      </div>

      <div className={clsx("card", styles.actionsCard)}>
        <div className={styles.linkBlock}>
          <small>Share this link</small>
          <code>{buildSessionUrl(session.session_id)}</code>
        </div>

        <div className={styles.statusActions}>
          {((hasOpenSlot && !isMember) || isArchived) && !isClosed && (
            <Button onClick={() => void handleJoinSession()}>
              {isArchived ? "Reopen Session" : "Join Session"}
            </Button>
          )}
          {isMember && hasOpenSlot && !isClosed && !isArchived && (
            <Button
              onClick={() => void copySessionLink(session.session_id)}
              variant="secondary"
            >
              Copy Link
            </Button>
          )}
          <Link to="/">
            <Button variant="secondary">Back To Lobby</Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
