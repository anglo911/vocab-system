export type SrsInput = {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  quality: number; // 0-5
};

export function applySm2(input: SrsInput) {
  let { easeFactor, intervalDays, repetitions, quality } = input;

  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  return {
    easeFactor,
    intervalDays,
    repetitions,
    mastered: repetitions >= 6 && quality >= 4
  };
}
