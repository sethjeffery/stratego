import { nanoid } from "nanoid";

export type StoredDeviceIdentity = {
  deviceId: string;
};

const DEVICE_KEY = "stratego:device:v2";

const canUseStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const parseJson = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const repairStoredDeviceIdentity = (
  identity: Partial<StoredDeviceIdentity> | null,
): StoredDeviceIdentity | null => {
  if (!identity?.deviceId) return null;

  return {
    deviceId: identity.deviceId,
  };
};

export const getOrCreateStoredDeviceIdentity = (): StoredDeviceIdentity => {
  if (!canUseStorage()) {
    return { deviceId: nanoid() };
  }

  const existing = parseJson<StoredDeviceIdentity | null>(
    window.localStorage.getItem(DEVICE_KEY),
    null,
  );
  const repaired = repairStoredDeviceIdentity(existing);
  if (repaired) {
    if (repaired.deviceId !== existing?.deviceId) {
      window.localStorage.setItem(DEVICE_KEY, JSON.stringify(repaired));
    }
    return repaired;
  }

  const identity = { deviceId: nanoid() };
  window.localStorage.setItem(DEVICE_KEY, JSON.stringify(identity));
  return identity;
};
