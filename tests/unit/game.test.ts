import { analyzeBoard, getStatus, normalizeBoardSize, playGroup } from "@/lib/game";

describe("game helpers", () => {
  it("clamps board sizes into the supported range", () => {
    expect(normalizeBoardSize({ columns: 4, rows: 200 })).toEqual({
      columns: 10,
      rows: 60,
    });
  });

  it("counts removable groups and solitary tiles", () => {
    const board = [
      [0, 1, null],
      [0, 1, 2],
      [3, 4, 2],
    ];

    expect(analyzeBoard(board)).toEqual({
      remainingCells: 8,
      removableGroups: 3,
      solitaryCells: 2,
      largestGroup: 2,
      emptyColumns: 0,
    });
  });

  it("removes a group and shifts empty columns left", () => {
    const board = [
      [0, 1, 1],
      [0, 2, 2],
      [0, 2, 2],
    ];

    const move = playGroup(board, 0, 0);

    expect(move).not.toBeNull();
    expect(move?.board).toEqual([
      [1, 1, null],
      [2, 2, null],
      [2, 2, null],
    ]);
    expect(move?.transition.removed).toHaveLength(3);
    expect(move?.metrics.emptyColumns).toBe(1);
  });

  it("reports a cleared board as a win", () => {
    expect(
      getStatus({
        remainingCells: 0,
        removableGroups: 0,
        solitaryCells: 0,
        largestGroup: 0,
        emptyColumns: 4,
      }),
    ).toEqual({
      status: "board-cleared",
      message: "Board cleared. You win.",
    });
  });
});
