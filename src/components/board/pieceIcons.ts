const pieceIconModules = import.meta.glob("../../assets/pieces/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export const pieceIconById = Object.fromEntries(
  Object.entries(pieceIconModules).flatMap(([path, url]) => {
    const match = path.match(/stratego-([a-z]+)\.svg$/);
    return match ? [[match[1], url]] : [];
  }),
) as Record<string, string>;
