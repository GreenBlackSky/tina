/* Tina's eye on Today: which of the six drawings fits how much of the day's
   calories is eaten (`fraction` = eaten / target). */

export interface EyeState {
  id: 'hungry' | 'peckish' | 'settling' | 'content' | 'drowsy' | 'asleep';
  /** Her mood, shown under the number. */
  mood: string;
  /** Half the pupil's width, in the eye's 120 × 72 drawing. */
  pupil: number;
  /** A small highlight in a wide pupil. */
  glint: boolean;
  /** The upper lid half down. */
  lid: boolean;
}

const STATES: Array<EyeState & { upTo: number }> = [
  { upTo: 0.25, id: 'hungry', mood: "Tina's hungry", pupil: 20, glint: true, lid: false },
  { upTo: 0.6, id: 'peckish', mood: "Tina's peckish", pupil: 15, glint: true, lid: false },
  { upTo: 0.9, id: 'settling', mood: "Tina's settling", pupil: 11, glint: false, lid: false },
  { upTo: 1, id: 'content', mood: "Tina's content", pupil: 8, glint: false, lid: false },
  { upTo: 1.1, id: 'drowsy', mood: "Tina's drowsy", pupil: 7, glint: false, lid: true },
  { upTo: Infinity, id: 'asleep', mood: 'Food coma', pupil: 0, glint: false, lid: false },
];

export function eyeState(fraction: number): EyeState {
  const value = Number.isFinite(fraction) ? fraction : 0;
  return STATES.find((s) => value <= s.upTo) ?? STATES[0];
}
