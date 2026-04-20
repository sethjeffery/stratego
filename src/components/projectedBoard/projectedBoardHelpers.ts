import type { CSSProperties } from "react";

import type { PieceColor } from "./types";

export const colorForOwner = (
  ownerId: string,
  playerOneId: null | string,
): PieceColor => (ownerId === playerOneId ? "player-one" : "player-two");

export const shouldShowRank = (pieceId: string) =>
  pieceId !== "flag" && pieceId !== "bomb";

export const getCellStyle = (
  x: number,
  y: number,
  boardColumns: number,
  boardRows: number,
): CSSProperties => ({
  height: `${(1 / boardRows) * 100}%`,
  left: `${(x / boardColumns) * 100}%`,
  top: `${(y / boardRows) * 100}%`,
  width: `${(1 / boardColumns) * 100}%`,
  zIndex: 1,
});

export const getPieceStyle = (
  x: number,
  y: number,
  boardColumns: number,
  boardRows: number,
  zIndex: number,
): CSSProperties => ({
  height: `${(1 / boardRows) * 100}%`,
  left: `${((x + 0.5) / boardColumns) * 100}%`,
  top: `${((y + 1) / boardRows) * 100}%`,
  width: `${(0.76 / boardColumns) * 100}%`,
  zIndex,
});
