export type PlayerProfile = {
  playerName: string;
  avatarId: string;
};

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

const avatarUrlById = new Map(
  avatarCatalog.map((avatar) => [avatar.id, avatar.url]),
);

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

const pickRandom = <T>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

export const DEFAULT_AVATAR_ID = avatarCatalog[0]?.id ?? "char01";

export const resolveAvatarUrl = (avatarId?: string) =>
  avatarUrlById.get(avatarId ?? "") ?? avatarCatalog[0]?.url ?? "";

export const pickRandomAvatarId = (exceptId?: string) => {
  if (avatarCatalog.length === 0) return DEFAULT_AVATAR_ID;
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

export const createRandomPlayerProfile = (
  currentProfile?: Partial<PlayerProfile>,
): PlayerProfile => ({
  playerName: generatePlayerName(currentProfile?.playerName),
  avatarId: pickRandomAvatarId(currentProfile?.avatarId),
});
