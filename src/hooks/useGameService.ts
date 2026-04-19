import useSWR, { mutate, useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import {
  archiveSession,
  createInitiatedSession,
  getCurrentUser,
  getGameServiceCacheScope,
  getSession,
  joinSessionAsCurrentUser,
  listMySessions,
  listOpenSessions,
  type SessionAccess,
  type SessionSummary,
} from "../lib/supabaseGameService";
import { useCurrentUser } from "./useProfile";

const MY_SESSIONS_KEY = "/api/my-sessions";
const OPEN_SESSIONS_KEY = "/api/open-sessions";
const SESSION_ACCESS_KEY = "/api/session-access";

const SESSION_KEY = "/api/session";

const mySessionsKey = (cacheScope: string, deviceId: string) =>
  [MY_SESSIONS_KEY, cacheScope, deviceId] as const;
const openSessionsKey = (cacheScope: string, limit: number) =>
  [OPEN_SESSIONS_KEY, cacheScope, limit] as const;
const sessionAccessKey = (
  cacheScope: string,
  sessionId: string,
  deviceId: string,
) => [SESSION_ACCESS_KEY, cacheScope, sessionId, deviceId] as const;
export const getSessionCacheKey = (sessionId: string, cacheScope?: string) =>
  [SESSION_KEY, cacheScope ?? getGameServiceCacheScope(), sessionId] as const;

const revalidateSessionCaches = async (
  mutate: ReturnType<typeof useSWRConfig>["mutate"],
  cacheScope: string,
  deviceId: string,
  sessionId?: string,
) => {
  await Promise.all([
    mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === MY_SESSIONS_KEY &&
        key[1] === cacheScope,
    ),
    mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === OPEN_SESSIONS_KEY &&
        key[1] === cacheScope,
    ),
    sessionId
      ? mutate(
          (key) =>
            Array.isArray(key) &&
            key[0] === SESSION_ACCESS_KEY &&
            key[1] === cacheScope &&
            key[2] === sessionId &&
            key[3] === deviceId,
        )
      : Promise.resolve(undefined),
  ]);
};

export function useMySessions() {
  const cacheScope = getGameServiceCacheScope();
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? mySessionsKey(cacheScope, currentUser.device_id) : null;

  return useSWR(key, ([, , deviceId]) => listMySessions(deviceId));
}

export function useOpenSessions(limit = 5) {
  const cacheScope = getGameServiceCacheScope();
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? openSessionsKey(cacheScope, limit) : null;

  return useSWR(key, ([, , nextLimit]) => listOpenSessions(nextLimit));
}

export function useSession(sessionId: string | null) {
  const cacheScope = getGameServiceCacheScope();
  return useSWR(sessionId && getSessionCacheKey(sessionId, cacheScope), () =>
    getSession(sessionId ?? ""),
  );
}

export function useCreateSession() {
  const { mutate } = useSWRConfig();
  const cacheScope = getGameServiceCacheScope();

  return useSWRMutation("/api/create-session", async () => {
    const currentUser = await getCurrentUser();
    const session = await createInitiatedSession(currentUser);
    await revalidateSessionCaches(
      mutate,
      cacheScope,
      currentUser.device_id,
      session.session_id,
    );
    return session;
  });
}

export function useArchiveSession() {
  const { mutate } = useSWRConfig();
  const cacheScope = getGameServiceCacheScope();

  return useSWRMutation(
    "/api/archive-session",
    async (_url, { arg: { sessionId } }: { arg: { sessionId: string } }) => {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error("Current player profile is not ready.");

      const myKey = mySessionsKey(cacheScope, currentUser.device_id);
      const accessKey = sessionAccessKey(
        cacheScope,
        sessionId,
        currentUser.device_id,
      );
      const previousSessions = await mutate(myKey, (sessions?: SessionSummary[]) =>
        sessions?.filter((session) => session.session_id !== sessionId),
      );

      const previousAccess = await mutate(
        accessKey,
        (currentAccess?: SessionAccess) =>
          currentAccess
            ? {
                ...currentAccess,
                membership: currentAccess.membership
                  ? {
                      ...currentAccess.membership,
                      archived_at: new Date().toISOString(),
                    }
                  : null,
                session: currentAccess.session.currentMembership
                  ? {
                      ...currentAccess.session,
                      currentMembership: {
                        ...currentAccess.session.currentMembership,
                        archived_at: new Date().toISOString(),
                      },
                    }
                  : currentAccess.session,
              }
            : currentAccess,
        {
          revalidate: false,
        },
      );

      try {
        const archived = await archiveSession(sessionId, currentUser.device_id);
        await revalidateSessionCaches(
          mutate,
          cacheScope,
          currentUser.device_id,
          sessionId,
        );
        return archived;
      } catch (error) {
        await mutate(myKey, previousSessions, { revalidate: false });
        await mutate(accessKey, previousAccess, { revalidate: false });
        throw error;
      }
    },
  );
}

export function useResignSession() {
  return useArchiveSession();
}

export function useJoinSession() {
  const cacheScope = getGameServiceCacheScope();

  return useSWRMutation(
    `/api/session`,
    async (_url, { arg: { sessionId } }: { arg: { sessionId: string } }) => {
      const sessionRow = await joinSessionAsCurrentUser(sessionId);
      await mutate(getSessionCacheKey(sessionId, cacheScope), sessionRow);
    },
  );
}
