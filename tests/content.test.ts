import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const curriculum = JSON.parse(readFileSync(resolve(process.cwd(), "content/a1-curriculum.json"), "utf8")) as {
  version: string;
  units: Array<{ n: number; lessons: Array<{ id: string; lessonNumber: number; itemIds: string[]; questionTypes: string[] }> }>;
};
const combined = JSON.parse(readFileSync(resolve(process.cwd(), "content/a1-a2-curriculum.json"), "utf8")) as {
  version: string;
  track: string;
  units: Array<{ id: string; unitNumber: number; level: string; lessons: Array<{ id: string; lessonNumber: number; itemIds: string[]; questionTypes: string[]; missionId: string; candoIds: string[] }> }>;
};
const stagedTypes = ["multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input"];
const a2Types = [
  "multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input",
  "multiple_choice", "multiple_choice", "cloze", "unscramble", "free_input",
  "free_input", "free_input", "free_input", "free_input",
];

describe("A1 curriculum contract", () => {
  it("contains ten units and six lessons per unit", () => {
    expect(curriculum.version).toBe("a1-2026.2");
    expect(curriculum.units).toHaveLength(10);
    expect(curriculum.units.flatMap((unit) => unit.lessons)).toHaveLength(60);
    for (const unit of curriculum.units) {
      expect(unit.lessons).toHaveLength(6);
      for (const lesson of unit.lessons) {
        expect(lesson.id).toBe(`a1-u${unit.n}-l${lesson.lessonNumber}`);
        expect(lesson.questionTypes).toEqual(stagedTypes);
      }
    }
  });

  it("uses real item ids and keeps lesson item references within the unit", () => {
    for (const unit of curriculum.units) for (const lesson of unit.lessons) {
      expect(lesson.itemIds).toHaveLength(unit.n === 1 ? 5 : 2);
      for (const itemId of lesson.itemIds) expect(itemId.startsWith(`a1-u${unit.n}-`)).toBe(true);
    }
  });
});

describe("A2 curriculum contract", () => {
  const a2Units = combined.units.filter((unit) => unit.level === "A2");
  const a2Lessons = a2Units.flatMap((unit) => unit.lessons);

  it("adds ten Units and sixty lessons without changing A1 metadata", () => {
    expect(combined.version).toBe("a1-a2-2026.1");
    expect(combined.track).toBe("A1+A2");
    expect(combined.units).toHaveLength(20);
    expect(a2Units).toHaveLength(10);
    expect(a2Lessons).toHaveLength(60);
    expect(a2Lessons.flatMap((lesson) => lesson.itemIds)).toHaveLength(360);
    expect(new Set(a2Lessons.flatMap((lesson) => lesson.itemIds)).size).toBe(360);
  });

  it("references all six authored expressions through the fourteen-step staged loop", () => {
    for (const [unitIndex, unit] of a2Units.entries()) {
      expect(unit.id).toBe(`a2-unit-${unitIndex + 1}`);
      expect(unit.unitNumber).toBe(unitIndex + 1);
      expect(unit.lessons).toHaveLength(6);
      for (const lesson of unit.lessons) {
        expect(lesson.id).toBe(`a2-u${unitIndex + 1}-l${lesson.lessonNumber}`);
        expect(lesson.itemIds).toHaveLength(6);
        expect(lesson.questionTypes).toEqual(a2Types);
        expect(lesson.missionId).toBe(`${lesson.id}-mission`);
        expect(lesson.candoIds).toHaveLength(3);
      }
    }
    expect(JSON.stringify(combined)).not.toContain("porque");
    expect(JSON.stringify(combined)).not.toMatch(/TODO|placeholder|仮データ/iu);
  });
});
