import { useEffect, useRef, useState } from "react";

import type { GameChatMessage } from "../../shared/schema";
import { GameBattleMessage } from "./GameBattleMessage";

type GameChatDockProps = {
  canSendChat: boolean;
  messages: GameChatMessage[];
  myId: string | null;
  onSendMessage: (message: string) => Promise<void>;
  playerOneId: string | null;
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
    <section className="game-chat-dock" aria-label="Match chat">
      <div ref={chatStackRef} className="game-chat-stack" aria-live="polite">
        {messages.length === 0 ? (
          <p className="game-chat-placeholder">
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
                key={message.id}
                className={`game-chat-message ${isOwnMessage ? "is-own" : ""}`}
              >
                <span className="game-chat-author">
                  {isOwnMessage ? "You" : message.senderName}
                </span>
                <p>{message.text}</p>
              </article>
            );
          })
        )}
      </div>

      <form className="game-chat-form" onSubmit={handleSubmit}>
        <input
          ref={chatInputRef}
          className="game-chat-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={canSendChat ? "Send a message…" : "Join a seat to chat"}
          autoComplete="off"
          maxLength={180}
          disabled={!myId}
        />
      </form>
    </section>
  );
}
