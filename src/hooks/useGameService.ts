import useSWR, { mutate, useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import {
  archiveSession,
  createInitiatedSession,
  getCurrentUser,
  getSession,
  joinSessionAsCurrentUser,
  listMySessions,
  listOpenSessions,
  type SessionAccess,
  type SessionSummary,
  touchSessionMembership,
} from "../lib/supabaseGameService";
import { useCurrentUser } from "./useProfile";

const MY_SESSIONS_KEY = "/api/my-sessions";
const OPEN_SESSIONS_KEY = "/api/open-sessions";
const SESSION_ACCESS_KEY = "/api/session-access";

const mySessionsKey = (deviceId: string) => [MY_SESSIONS_KEY, deviceId] as const;
const openSessionsKey = (limit: number) => [OPEN_SESSIONS_KEY, limit] as const;
const sessionAccessKey = (sessionId: string, deviceId: string) =>
  [SESSION_ACCESS_KEY, sessionId, deviceId] as const;

const revalidateSessionCaches = async (
  mutate: ReturnType<typeof useSWRConfig>["mutate"],
  deviceId: string,
  sessionId?: string,
) => {
  await Promise.all([
    mutate((key) => Array.isArray(key) && key[0] === MY_SESSIONS_KEY),
    mutate((key) => Array.isArray(key) && key[0] === OPEN_SESSIONS_KEY),
    sessionId
      ? mutate(
          (key) =>
            Array.isArray(key) &&
            key[0] === SESSION_ACCESS_KEY &&
            key[1] === sessionId &&
            key[2] === deviceId,
        )
      : Promise.resolve(undefined),
  ]);
};

export function useMySessions() {
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? mySessionsKey(currentUser.device_id) : null;

  return useSWR(key, ([, deviceId]) => listMySessions(deviceId));
}

export function useOpenSessions(limit = 5) {
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? openSessionsKey(limit) : null;

  return useSWR(key, ([, nextLimit]) => listOpenSessions(nextLimit));
}

export function useSession(sessionId: string | null) {
  return useSWR(sessionId && `/api/session/${sessionId}`, () =>
    getSession(sessionId ?? ""),
  );
}

export function useCreateSession() {
  const { mutate } = useSWRConfig();

  return useSWRMutation("/api/create-session", async () => {
    const currentUser = await getCurrentUser();
    const session = await createInitiatedSession(currentUser);
    await revalidateSessionCaches(mutate, currentUser.device_id, session.session_id);
    return session;
  });
}

export function useArchiveSession() {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    "/api/archive-session",
    async (_url, { arg: { sessionId } }: { arg: { sessionId: string } }) => {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error("Current player profile is not ready.");

      const myKey = mySessionsKey(currentUser.device_id);
      const accessKey = sessionAccessKey(sessionId, currentUser.device_id);
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
        await revalidateSessionCaches(mutate, currentUser.device_id, sessionId);
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
  return useSWRMutation(
    `/api/session`,
    async (_url, { arg: { sessionId } }: { arg: { sessionId: string } }) => {
      const sessionRow = await joinSessionAsCurrentUser(sessionId);
      await mutate(`/api/session/${sessionId}`, sessionRow);
    },
  );
}

export function useTouchSessionMembership() {
  const { mutate } = useSWRConfig();

  return useSWRMutation(
    "/api/touch-session-membership",
    async (_url, { arg: sessionId }: { arg: string }) => {
      const currentUser = await getCurrentUser();
      if (!currentUser) return;

      await touchSessionMembership(sessionId, currentUser.device_id);
      await mutate(mySessionsKey(currentUser.device_id));
    },
  );
}
