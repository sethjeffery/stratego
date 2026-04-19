import { useCallback } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import type { UserProfile } from "../lib/supabaseGameService";
import {
  getCurrentUser,
  getGameServiceCacheScope,
  updateCurrentUserProfile,
} from "../lib/supabaseGameService";

const CURRENT_USER_KEY = "/api/current-user";

export function useCurrentUser() {
  const cacheScope = getGameServiceCacheScope();
  const currentUser = useSWR([CURRENT_USER_KEY, cacheScope] as const, getCurrentUser);
  const { trigger } = useSWRMutation(
    [CURRENT_USER_KEY, cacheScope] as const,
    async (_key, { arg }: { arg: UserProfile }) => updateCurrentUserProfile(arg),
  );

  const updateProfile = useCallback(
    async (profile: UserProfile) => {
      await trigger(
        { ...currentUser.data, ...profile },
        {
          optimisticData: { ...currentUser.data, ...profile },
        },
      );
    },
    [currentUser.data, trigger],
  );

  return {
    ...currentUser,
    updateProfile,
  };
}
