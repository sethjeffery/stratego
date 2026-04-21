import { useEffect, useRef, useState } from "react";

import type { BattleChatMessage } from "../../shared/schema";

const ATTACK_ANIMATION_DURATION_MS = 3000;

export function useAttackAnimationPlayback() {
  const [attackAnimationBattle, setAttackAnimationBattle] =
    useState<BattleChatMessage | null>(null);
  const timeoutRef = useRef<null | number>(null);
  const playAttackAnimationRef = useRef<((battle: BattleChatMessage) => void) | null>(
    null,
  );

  if (playAttackAnimationRef.current === null) {
    playAttackAnimationRef.current = (battle) => {
      setAttackAnimationBattle(battle);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setAttackAnimationBattle(null);
        timeoutRef.current = null;
      }, ATTACK_ANIMATION_DURATION_MS);
    };
  }

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return {
    attackAnimationBattle,
    playAttackAnimation: playAttackAnimationRef.current,
  };
}
