import { useCallback } from "react";
import useSWRMutation from "swr/mutation";

import type { UserProfile } from "../lib/supabaseGameService";

import { getProfileCacheKey } from "../lib/gameServiceCache";
import { getOrCreateStoredDeviceIdentity } from "../lib/localSessionStore";
import { updateCurrentUserProfile } from "../lib/supabaseGameService";
import { useProfile } from "./useGameService";

export function useCurrentUser() {
  const { deviceId } = getOrCreateStoredDeviceIdentity();
  const currentUser = useProfile(deviceId, true);

  const { trigger } = useSWRMutation(
    getProfileCacheKey(deviceId),
    async (_key, { arg }: { arg: UserProfile }) => updateCurrentUserProfile(arg),
  );

  const updateProfile = useCallback(
    async (profile: UserProfile) => {
      await trigger(
        { ...currentUser.data, ...profile },
        {
          optimisticData: { ...currentUser.data, ...profile },
          revalidate: false,
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
