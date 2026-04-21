import type { Database } from "../types/database.types";

const avatarModules = import.meta.glob("../assets/avatars/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const avatarCatalog = Object.entries(avatarModules)
  .map(([path, url]) => {
    const match = path.match(/\/(char\d+)\.jpg$/);
    return {
      id: match?.[1] ?? path,
      url,
    };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const avatarUrlById = new Map(avatarCatalog.map((avatar) => [avatar.id, avatar.url]));

const titles = [
  "Commander",
  "Captain",
  "Agent",
  "Marshal",
  "Major",
  "Colonel",
  "Lieutenant",
];

const surnames = [
  "Rothford",
  "Smith",
  "Manning",
  "Hollis",
  "Mercer",
  "Sterling",
  "Avery",
  "Calder",
  "Sloane",
  "Thorne",
  "Ashford",
  "Rowan",
  "Sinclair",
  "Bennett",
  "Tolland",
  "Ward",
  "Voss",
  "Harrow",
  "Quill",
  "West",
  "Fenwick",
  "Marlowe",
  "Vale",
  "Pryor",
  "Locke",
  "Redgrave",
  "Caldwell",
  "Monroe",
  "Hale",
  "Kestrel",
];

const pickRandom = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

export const resolveAvatarUrl = (avatarId?: string) =>
  avatarUrlById.get(avatarId ?? "") ?? avatarCatalog[0]?.url ?? "";

export const pickRandomAvatarId = (exceptId?: string) => {
  if (avatarCatalog.length === 0) return "";
  if (avatarCatalog.length === 1) return avatarCatalog[0].id;

  let nextId = pickRandom(avatarCatalog).id;
  while (nextId === exceptId) {
    nextId = pickRandom(avatarCatalog).id;
  }

  return nextId;
};

export const generatePlayerName = (exceptName?: string) => {
  if (titles.length === 0 || surnames.length === 0) {
    return "Commander Nova";
  }

  let nextName = `${pickRandom(titles)} ${pickRandom(surnames)}`;
  while (nextName === exceptName) {
    nextName = `${pickRandom(titles)} ${pickRandom(surnames)}`;
  }

  return nextName;
};

export function getMemberById<
  T extends Pick<Database["public"]["Tables"]["session_memberships"]["Row"], "device_id">,
>(memberships?: null | T[], id?: null | string): null | T {
  return (id && memberships?.find((membership) => membership.device_id === id)) || null;
}

export function getMemberByRole<
  T extends Pick<Database["public"]["Tables"]["session_memberships"]["Row"], "role">,
>(
  memberships?: null | T[],
  role?: Database["public"]["Enums"]["session_role"],
): null | T {
  return memberships?.find((membership) => membership.role === role) ?? null;
}
