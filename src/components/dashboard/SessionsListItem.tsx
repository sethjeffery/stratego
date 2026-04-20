import type { GameSession } from "../../lib/supabaseGameService";

import { useProfile, useSessionMemberships } from "../../hooks/useGameService";
import { useCurrentUser } from "../../hooks/useProfile";
import { getMemberByRole, resolveAvatarUrl } from "../../lib/playerProfile";
import Avatar from "../Avatar";
import { Button } from "../Button";
import { getCompletionLabel } from "./sessionHelpers";
import styles from "./SessionsList.module.css";

export function SessionsListItem({
  onArchive,
  onJoin,
  onResume,
  session,
}: {
  onArchive?: () => void;
  onJoin?: () => void;
  onResume?: () => void;
  session: GameSession;
}) {
  const { data: currentUser } = useCurrentUser();
  const { data: memberships, isLoading } = useSessionMemberships(session.session_id);
  const { data: initiator, isLoading: isLoadingInitiator } = useProfile(
    getMemberByRole(memberships, "initiator")?.device_id,
  );
  const { data: challenger, isLoading: isLoadingChallenger } = useProfile(
    getMemberByRole(memberships, "challenger")?.device_id,
  );

  const isFinished =
    session.state?.phase === "finished" || session.state?.phase === "closed";
  const isWaitingForChallenger = !session.state;
  const hasOpenSeat = !challenger;
  const completionLabel = getCompletionLabel(session, currentUser!);
  const isCurrentHost = initiator?.device_id === currentUser?.device_id;

  if (isLoading || isLoadingChallenger || isLoadingInitiator) {
    return null;
  }

  return (
    <article className={styles.sessionCard} key={session.session_id}>
      <div className={styles.sessionSummary}>
        <div className={styles.playerStrip}>
          {[initiator, challenger].filter(Boolean).map((profile, index) => (
            <Avatar
              alt={profile!.player_name}
              avatarUrl={resolveAvatarUrl(profile!.avatar_id)}
              className={styles.playerAvatar}
              color={index === 0 ? "red" : "blue"}
              key={`${session.session_id}-${profile!.device_id}`}
              title={profile!.player_name}
            />
          ))}
        </div>
        <div>
          <strong>{session.session_id}</strong>
          <p>
            {isFinished
              ? completionLabel
              : isWaitingForChallenger
                ? "Waiting for challenger"
                : "In progress"}
          </p>
        </div>
      </div>
      <div className={styles.inlineActions}>
        {onResume && (
          <Button onClick={onResume} variant="secondary">
            Continue
          </Button>
        )}
        {hasOpenSeat && !isCurrentHost && onJoin && (
          <Button onClick={onJoin} variant="secondary">
            Join
          </Button>
        )}
        {onArchive && (
          <Button onClick={onArchive} variant="secondary">
            Archive
          </Button>
        )}
      </div>
    </article>
  );
}
