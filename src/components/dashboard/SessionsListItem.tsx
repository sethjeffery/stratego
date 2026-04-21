import {
  ArchiveIcon,
  FlagIcon,
  MedalIcon,
  PlayIcon,
  SkullIcon,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";
import { Link } from "react-router-dom";

import type { SessionSummary } from "../../lib/supabaseGameService";

import { resolveAvatarUrl } from "../../lib/playerProfile";
import Avatar from "../Avatar";
import { IconButton } from "../IconButton";
import { ArchiveSessionModal } from "./ArchiveSessionModal";
import {
  canArchiveSession,
  getCompletionSummary,
  getSessionPlayerName,
  type SessionOutcomeIcon,
} from "./sessionHelpers";
import styles from "./SessionsList.module.css";

const renderOutcomeIcon = (icon: null | SessionOutcomeIcon) => {
  switch (icon) {
    case "active":
      return <PlayIcon size={16} weight="fill" />;
    case "flag":
      return <FlagIcon size={16} />;
    case "medal":
      return <MedalIcon size={16} />;
    case "skull":
      return <SkullIcon size={16} />;
    default:
      return null;
  }
};

export function SessionsListItem({
  onArchive,
  openPath,
  session,
}: {
  onArchive?: () => Promise<void>;
  openPath?: null | string;
  session: SessionSummary;
}) {
  const [archiveConfirmVisible, setArchiveConfirmVisible] = useState(false);
  const isFinished =
    session.state?.phase === "finished" || session.state?.phase === "closed";
  const isWaitingForChallenger =
    !session.challenger || !session.state || session.state.phase === "open";
  const initiator = session.initiator;
  const challenger = session.challenger;
  const isCurrentHost = session.currentMembership?.role === "initiator";
  const completionSummary = getCompletionSummary(
    session,
    session.currentMembership?.device_id,
  );
  const statusLabel = isFinished
    ? completionSummary.text
    : isWaitingForChallenger
      ? isCurrentHost
        ? "Waiting for challenger"
        : "Open for a challenger"
      : "In progress";
  const statusIcon = isFinished ? completionSummary.icon : "active";
  const playerLabel = `${getSessionPlayerName(initiator)} vs ${
    challenger ? getSessionPlayerName(challenger) : "Open seat"
  }`;
  const archiveAllowed = Boolean(onArchive) && canArchiveSession(session);
  const isOpenable = Boolean(openPath);

  return (
    <article
      className={clsx(styles.sessionCard, isOpenable && styles.sessionCardOpenable)}
      key={session.session_id}
    >
      {openPath ? (
        <Link
          aria-label={`Open session ${session.session_id}`}
          className={styles.sessionCardLink}
          to={openPath}
        />
      ) : null}

      <div className={styles.sessionSummary}>
        <div className={styles.playerStrip}>
          {[initiator, challenger].map((profile, index) => (
            <Avatar
              alt={profile ? getSessionPlayerName(profile) : "Open seat"}
              avatarUrl={profile ? resolveAvatarUrl(profile.avatar_id) : undefined}
              className={styles.playerAvatar}
              color={index === 0 ? "red" : "blue"}
              key={`${session.session_id}-${profile?.device_id ?? `open-${index}`}`}
              shadow
              title={profile ? getSessionPlayerName(profile) : "Open seat"}
            />
          ))}
        </div>

        <div className={styles.sessionText}>
          <p className={styles.playerNames}>{playerLabel}</p>
          <p className={styles.sessionStatus}>
            {statusIcon ? (
              <span className={styles.sessionStatusIcon}>
                {renderOutcomeIcon(statusIcon)}
              </span>
            ) : null}
            <span>{statusLabel}</span>
          </p>
        </div>
      </div>

      <div className={styles.inlineActions}>
        {archiveAllowed && (
          <IconButton
            aria-label={`Archive session ${session.session_id}`}
            className={styles.archiveButton}
            onClick={() => setArchiveConfirmVisible(true)}
            title="Archive session"
            type="button"
          >
            <ArchiveIcon />
          </IconButton>
        )}
      </div>

      {archiveConfirmVisible && onArchive ? (
        <ArchiveSessionModal
          onCancel={() => setArchiveConfirmVisible(false)}
          onConfirm={() =>
            onArchive().then(() => {
              setArchiveConfirmVisible(false);
            })
          }
          sessionId={session.session_id}
        />
      ) : null}
    </article>
  );
}
