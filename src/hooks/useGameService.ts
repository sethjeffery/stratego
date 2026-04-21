import { useCallback, useEffect } from "react";
import useSWR, { mutate, useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import type { CreateSessionOptions } from "../lib/ai";
import type {
  GameSession,
  GameSessionDetails,
  SessionAccess,
  SessionChatMessage,
  SessionMembership,
  SessionSummary,
} from "../lib/supabaseGameService";
import type { GameState } from "../shared/schema";

import {
  getGameServiceCacheScope,
  getProfileCacheKey,
  getSessionCacheKey,
  getSessionMembershipsCacheKey,
} from "../lib/gameServiceCache";
import { getMemberByRole } from "../lib/playerProfile";
import { resolveSessionParticipants } from "../lib/sessionParticipants";
import {
  applyChatMessageToSession,
  archiveSession,
  createInitiatedSession,
  getCurrentUser,
  getProfile,
  getSession,
  getSessionMemberships,
  joinSessionAsCurrentUser,
  listMySessions,
  listOpenSessions,
  removeChatMessageFromSession,
  subscribeToMemberships,
  subscribeToProfile,
  subscribeToProfiles,
  subscribeToSession,
  subscribeToSessionChatMessages,
  subscribeToSessionMemberships,
  subscribeToSessions,
} from "../lib/supabaseGameService";
import { useCurrentUser } from "./useProfile";

const MY_SESSIONS_KEY = "/api/my-sessions";
const OPEN_SESSIONS_KEY = "/api/open-sessions";
const SESSION_ACCESS_KEY = "/api/session-access";

const mySessionsKey = (cacheScope: string, deviceId: string) =>
  [MY_SESSIONS_KEY, cacheScope, deviceId] as const;
const openSessionsKey = (cacheScope: string, limit: number) =>
  [OPEN_SESSIONS_KEY, cacheScope, limit] as const;
const sessionAccessKey = (cacheScope: string, sessionId: string, deviceId: string) =>
  [SESSION_ACCESS_KEY, cacheScope, sessionId, deviceId] as const;

const revalidateSessionCaches = async (
  mutate: ReturnType<typeof useSWRConfig>["mutate"],
  cacheScope: string,
  deviceId: string,
  sessionId?: string,
) => {
  await Promise.all([
    mutate(
      (key) =>
        Array.isArray(key) && key[0] === MY_SESSIONS_KEY && key[1] === cacheScope,
    ),
    mutate(
      (key) =>
        Array.isArray(key) && key[0] === OPEN_SESSIONS_KEY && key[1] === cacheScope,
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

const hasSessionMembershipRole = (
  value: Partial<SessionMembership> | Record<string, never>,
): value is SessionMembership => {
  return typeof value.role === "string";
};

const hasSessionChatMessageId = (
  value: Partial<SessionChatMessage> | Record<string, never>,
): value is Partial<SessionChatMessage> & Pick<SessionChatMessage, "id"> => {
  return typeof value.id === "string";
};

export function useArchiveSession() {
  const { mutate } = useSWRConfig();
  const cacheScope = getGameServiceCacheScope();

  return useSWRMutation(
    "/api/archive-session",
    async (_url, { arg: { sessionId } }: { arg: { sessionId: string } }) => {
      const currentUser = await getCurrentUser();
      if (!currentUser) throw new Error("Current player profile is not ready.");

      const myKey = mySessionsKey(cacheScope, currentUser.device_id);
      const accessKey = sessionAccessKey(cacheScope, sessionId, currentUser.device_id);
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

export function useCreateSession() {
  const { mutate } = useSWRConfig();
  const cacheScope = getGameServiceCacheScope();

  return useSWRMutation(
    "/api/create-session",
    async (_url, { arg }: { arg: CreateSessionOptions }) => {
      const currentUser = await getCurrentUser();
      const session = await createInitiatedSession(currentUser, arg);
      await revalidateSessionCaches(
        mutate,
        cacheScope,
        currentUser.device_id,
        session.session_id,
      );
      return session;
    },
  );
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

export function useMySessions() {
  const cacheScope = getGameServiceCacheScope();
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? mySessionsKey(cacheScope, currentUser.device_id) : null;
  const sessions = useSWR(key, ([, , deviceId]) => listMySessions(deviceId), {
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnMount: true,
  });

  useLobbyListSubscriptions(key);

  return sessions;
}

export function useOpenSessions(limit = 5) {
  const cacheScope = getGameServiceCacheScope();
  const { data: currentUser } = useCurrentUser();
  const key = currentUser ? openSessionsKey(cacheScope, limit) : null;
  const sessions = useSWR(key, ([, , nextLimit]) => listOpenSessions(nextLimit), {
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    revalidateOnMount: true,
  });

  useLobbyListSubscriptions(key);

  return sessions;
}

export function useProfile(deviceId?: null | string, createIfEmpty?: boolean) {
  const { mutate } = useSWRConfig();
  const cacheKey = getProfileCacheKey(deviceId);
  const profile = useModel(
    deviceId,
    cacheKey,
    useCallback((id: string) => getProfile(id, createIfEmpty), [createIfEmpty]),
  );

  useEffect(() => {
    if (!deviceId || !cacheKey) return;

    return subscribeToProfile(deviceId, (payload) => {
      if (payload.new) {
        void mutate(cacheKey, payload.new, {
          revalidate: false,
        });
      }
    });
  }, [cacheKey, deviceId, mutate]);

  return profile;
}

export function useResignSession() {
  return useArchiveSession();
}

export function useSession(sessionId: null | string) {
  const { mutate } = useSWRConfig();
  const cacheKey = getSessionCacheKey(sessionId);
  const session = useModel(sessionId, cacheKey, getSession);

  useEffect(() => {
    if (!sessionId || !cacheKey) return;

    return subscribeToSession(sessionId, (payload) => {
      if (payload.new) {
        void mutate(cacheKey, payload.new, {
          revalidate: false,
        });
      }
    });
  }, [cacheKey, mutate, sessionId]);

  useEffect(() => {
    if (!sessionId || !cacheKey) return;

    return subscribeToSessionChatMessages(sessionId, (payload) => {
      const newEntry = payload.new;
      const oldEntry = payload.old;

      void mutate(
        cacheKey,
        (currentSession?: GameSession | null) => {
          if (!currentSession) return currentSession;

          if (hasSessionChatMessageId(newEntry)) {
            return applyChatMessageToSession(
              currentSession,
              newEntry as SessionChatMessage,
            );
          }

          if (hasSessionChatMessageId(oldEntry)) {
            return removeChatMessageFromSession(currentSession, oldEntry.id);
          }

          return currentSession;
        },
        {
          revalidate: false,
        },
      );
    });
  }, [cacheKey, mutate, sessionId]);

  return session;
}

export function useSessionDetails(sessionId: null | string): {
  data: GameSessionDetails | null;
  isLoading: boolean;
} {
  const { data: session, isLoading: sessionLoading } = useSession(sessionId);
  const { data: memberships, isLoading: membershipsLoading } =
    useSessionMemberships(sessionId);
  const { data: initiator, isLoading: initiatorLoading } = useProfile(
    getMemberByRole(memberships, "initiator")?.device_id ?? null,
  );
  const { data: challenger, isLoading: challengerLoading } = useProfile(
    getMemberByRole(memberships, "challenger")?.device_id ?? null,
  );
  const resolvedProfiles = [initiator, challenger].filter(
    (profile): profile is NonNullable<typeof profile> => Boolean(profile),
  );
  const resolvedMemberships = session
    ? resolveSessionParticipants({
        memberships:
          memberships?.map((membership) => ({
            archived_at: membership.archived_at,
            device_id: membership.device_id,
            role: membership.role,
          })) ?? [],
        profiles: resolvedProfiles,
        state: session.state,
      })
    : null;

  return {
    data: session
      ? {
          ...session,
          challenger:
            resolvedMemberships?.find((participant) => participant.role === "challenger") ??
            null,
          initiator:
            resolvedMemberships?.find((participant) => participant.role === "initiator") ??
            null,
          memberships: resolvedMemberships,
          state: session.state as GameState,
        }
      : null,
    isLoading:
      sessionLoading || membershipsLoading || initiatorLoading || challengerLoading,
  };
}

export function useSessionMemberships(sessionId: null | string) {
  const { mutate } = useSWRConfig();
  const cacheKey = getSessionMembershipsCacheKey(sessionId);
  const memberships = useModel(sessionId, cacheKey, getSessionMemberships);

  useEffect(() => {
    if (!sessionId || !cacheKey) return;

    return subscribeToSessionMemberships(sessionId, (payload) => {
      const newEntry = payload.new;
      const oldEntry = payload.old;

      void mutate(
        cacheKey,
        (currentMemberships?: SessionMembership[]) => {
          if (hasSessionMembershipRole(newEntry)) {
            return [
              ...(currentMemberships ?? []).filter(
                (item) => item.role !== newEntry.role,
              ),
              newEntry,
            ];
          }

          if (hasSessionMembershipRole(oldEntry)) {
            return (currentMemberships ?? []).filter(
              (item) => item.role !== oldEntry.role,
            );
          }

          return currentMemberships;
        },
        {
          revalidate: false,
        },
      );
    });
  }, [cacheKey, mutate, sessionId]);

  return memberships;
}

function useLobbyListSubscriptions(
  cacheKey: null | readonly unknown[] | string | undefined,
) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!cacheKey) return;

    const revalidate = () => {
      void mutate(cacheKey);
    };
    const unsubscribers = [
      subscribeToSessions(revalidate),
      subscribeToMemberships(revalidate),
      subscribeToProfiles(revalidate),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [cacheKey, mutate]);
}

function useModel<T extends Record<string, any>>(
  id: null | string | undefined,
  cacheKey: null | readonly string[] | string | undefined,
  getModel: (id: string) => Promise<null | T>,
) {
  const sessionSwr = useSWR(cacheKey, () => getModel(id ?? ""), {
    keepPreviousData: true,
    revalidateIfStale: false,
    revalidateOnFocus: false,
  });

  return sessionSwr;
}
