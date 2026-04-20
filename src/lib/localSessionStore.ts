import { nanoid } from "nanoid";

import { getConfiguredPlayerSessionStorageMode } from "../app/runtimeConfig";

export type StoredDeviceIdentity = {
  deviceId: string;
};

const DEVICE_KEY = "stratego:device:v2";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const memoryStorage = (() => {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  } satisfies StorageLike;
})();

const getConfiguredStorage = (): StorageLike => {
  const mode = getConfiguredPlayerSessionStorageMode();

  if (typeof window === "undefined") {
    return memoryStorage;
  }

  if (mode === "memory") {
    return memoryStorage;
  }

  if (mode === "sessionStorage") {
    return typeof window.sessionStorage !== "undefined"
      ? window.sessionStorage
      : memoryStorage;
  }

  return typeof window.localStorage !== "undefined"
    ? window.localStorage
    : memoryStorage;
};

const parseJson = <T>(raw: null | string, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const repairStoredDeviceIdentity = (
  identity: null | Partial<StoredDeviceIdentity>,
): null | StoredDeviceIdentity => {
  if (!identity?.deviceId) return null;

  return {
    deviceId: identity.deviceId,
  };
};

export const getOrCreateStoredDeviceIdentity = (): StoredDeviceIdentity => {
  const storage = getConfiguredStorage();

  const existing = parseJson<null | StoredDeviceIdentity>(
    storage.getItem(DEVICE_KEY),
    null,
  );
  const repaired = repairStoredDeviceIdentity(existing);
  if (repaired) {
    if (repaired.deviceId !== existing?.deviceId) {
      storage.setItem(DEVICE_KEY, JSON.stringify(repaired));
    }
    return repaired;
  }

  const identity = { deviceId: nanoid() };
  storage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
};
