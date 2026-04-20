import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import type { GameChatMessage } from "../../shared/schema";

import { GameBattleMessage } from "./GameBattleMessage";
import styles from "./GameSurface.module.css";

type GameChatDockProps = {
  canSendChat: boolean;
  messages: GameChatMessage[];
  myId: null | string;
  onSendMessage: (message: string) => Promise<void>;
  playerOneId: null | string;
  roomCode: string;
};

export function GameChatDock({
  canSendChat,
  messages,
  myId,
  onSendMessage,
  playerOneId,
  roomCode,
}: GameChatDockProps) {
  const [draft, setDraft] = useState("");
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const chatStackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraft("");
  }, [roomCode]);

  useEffect(() => {
    const chatStack = chatStackRef.current;
    if (!chatStack) return;

    chatStack.scrollTop = chatStack.scrollHeight;
  }, [messages]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDraft = draft.trim();
    if (!trimmedDraft || !canSendChat) return;

    setDraft("");
    chatInputRef.current?.focus();

    void (async () => {
      try {
        await onSendMessage(trimmedDraft);
        chatInputRef.current?.focus();
      } catch {
        setDraft((current) => (current.trim().length === 0 ? trimmedDraft : current));
        chatInputRef.current?.focus();
      }
    })();
  };

  return (
    <section aria-label="Match chat" className={styles.gameChatDock}>
      <div aria-live="polite" className={styles.gameChatStack} ref={chatStackRef}>
        {messages.length === 0 ? (
          <p className={styles.gameChatPlaceholder}>
            Open channel. Keep it brief and tactical.
          </p>
        ) : (
          messages.map((message) => {
            if (message.type === "battle") {
              return (
                <GameBattleMessage
                  key={message.id}
                  message={message}
                  myId={myId}
                  playerOneId={playerOneId}
                />
              );
            }

            const isOwnMessage = message.playerId === myId;

            return (
              <article
                className={clsx(
                  styles.gameChatMessage,
                  isOwnMessage && styles.gameChatMessageOwn,
                )}
                key={message.id}
              >
                <span className={styles.gameChatAuthor}>
                  {isOwnMessage ? "You" : message.senderName}
                </span>
                <p>{message.text}</p>
              </article>
            );
          })
        )}
      </div>

      <form className={styles.gameChatForm} onSubmit={handleSubmit}>
        <input
          autoComplete="off"
          className={styles.gameChatInput}
          disabled={!myId}
          maxLength={180}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canSendChat ? "Send a message…" : "Join a seat to chat"}
          ref={chatInputRef}
          type="text"
          value={draft}
        />
      </form>
    </section>
  );
}
