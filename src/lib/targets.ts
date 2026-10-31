import { fmt, r0, r1 } from './nutrition';
import type { Profile } from './types';

/* The target calculator: calories from a standard formula, then protein, fat
   and carbs, each step written out with why. The wording was checked against
   the original and is deliberate. */

/** Activity levels: id, multiplier on BMR, name, description. */
export const ACTIVITY: Array<[string, number, string, string]> = [
  ['sedentary', 1.2, 'Sedentary', 'Desk job, little or no exercise'],
  ['light', 1.375, 'Lightly active', 'Exercise 1–3 days a week, or on your feet part of the day'],
  ['moderate', 1.55, 'Moderately active', 'Exercise 3–5 days a week'],
  ['very', 1.725, 'Very active', 'Hard exercise 6–7 days a week'],
  ['extra', 1.9, 'Extremely active', 'Physical job plus training, or training twice a day'],
];

/** Pace choices per goal, in kg a week. */
export const RATES: Record<string, Array<[number, string]>> = {
  lose: [
    [0.25, 'Gentle'],
    [0.5, 'Steady'],
    [0.75, 'Faster'],
    [1, 'Aggressive'],
  ],
  gain: [
    [0.1, 'Slow'],
    [0.25, 'Steady'],
    [0.5, 'Faster'],
  ],
};
export const DEFAULT_RATE: Record<string, number> = { lose: 0.5, gain: 0.25, maintain: 0 };

/** Energy in a kilogram of body fat. */
const KCAL_PER_KG = 7700;
const KG_PER_LB = 1 / 2.20462;
const CM_PER_INCH = 2.54;

export const DEFAULT_PROFILE: Profile = {
  units: 'metric',
  sex: 'male',
  age: '',
  heightCm: '',
  weightKg: '',
  bf: '',
  activity: 'moderate',
  goal: 'lose',
  rate: 0.5,
  goalKg: '',
};

/** NaN for an empty field. */
export const fieldNumber = (value: unknown): number =>
  value === '' || value === null || value === undefined ? NaN : Number(value);
export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;
export const inchesToCm = (inches: number): number => inches * CM_PER_INCH;
export const cmToInches = (cm: number): number => cm / CM_PER_INCH;

export function showWeight(kg: number, profile: Profile): string {
  return profile.units === 'imperial' ? `${r1(kgToLb(kg))} lb` : `${r1(kg)} kg`;
}

export interface Step {
  /** the step's title */
  t: string;
  /** the formulas, worked out */
  f: string[];
  why: string;
}

export type CalcResult =
  | { ok: false; missing: string[] }
  | {
      ok: true;
      kcal: number;
      p: number;
      c: number;
      f: number;
      bmr: number;
      tdee: number;
      bmi: number;
      warn: string[];
      steps: Step[];
      eta: { weeks: number; date: string; gk: number } | null;
      method: string;
    };

/* sensible input ranges */
const AGE = [14, 100];
const HEIGHT_CM = [120, 230];
const WEIGHT_KG = [30, 300];
const BODY_FAT = [3, 60];
const ADULT_AGE = 18;
const OBESE_BMI = 30;
const UNDERWEIGHT_BMI = 18.5;
const REFERENCE_BMI = 25;
const MAX_DEFICIT_SHARE = 0.25;
const MAX_WEEKLY_LOSS_PERCENT = 1;
const MIN_KCAL = { male: 1500, female: 1200 };
const FAT_SHARE = 0.25;
const MIN_FAT_PER_KG = 0.6;
const MIN_CARBS = 130;
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

const inRange = (value: number, [low, high]: number[]): boolean => value >= low && value <= high;

/** "Standard" for vegetarians, "Higher" for everyone else, unless chosen. */
export function proteinLevel(profile: Profile, vegetarian: boolean): 'standard' | 'higher' {
  return profile.pLevel ?? (vegetarian ? 'standard' : 'higher');
}

function proteinWhy(
  profile: Profile,
  level: 'standard' | 'higher',
  vegetarian: boolean,
  bmi: number,
): string {
  let choice: string;
  if (level === 'standard') {
    choice = 'You chose Standard, 1.6 g/kg: enough for nearly everyone, and easier to reach.';
  } else if (profile.goal === 'lose') {
    choice =
      'You chose Higher. In a deficit, 2.0 g/kg adds a safety margin for keeping muscle and helps you feel full.';
  } else {
    choice = 'You chose Higher, 1.8 g/kg: a margin above the point where benefits level off.';
  }
  const veg = vegetarian
    ? ' As a vegetarian who eats eggs and dairy, you need the same amount as a meat-eater: eggs, dairy and soy are complete, well-digested proteins. Protein per 100 g: seitan 25, tvorog 17, tofu 17, tempeh 20, skyr 11, eggs 13, cooked lentils 9.'
    : '';
  const obese =
    bmi >= OBESE_BMI
      ? ` Your BMI is ${r1(bmi)}, so protein is based on the weight you'd have at BMI 25. Using full body weight would overestimate what you need, because fat tissue needs little protein.`
      : '';
  return `A 2018 meta-analysis of 49 trials (Morton et al.) found the muscle benefit of protein levels off around 1.6 g per kg, and the International Society of Sports Nutrition recommends 1.4–2.0 g/kg for active people. ${choice}${veg}${obese}`;
}

export function calculate(profile: Profile, vegetarian: boolean): CalcResult {
  const weight = fieldNumber(profile.weightKg);
  const height = fieldNumber(profile.heightCm);
  const age = fieldNumber(profile.age);
  const bodyFat = fieldNumber(profile.bf);
  const missing: string[] = [];
  if (!inRange(age, AGE)) {
    missing.push('age');
  }
  if (!inRange(height, HEIGHT_CM)) {
    missing.push('height');
  }
  if (!inRange(weight, WEIGHT_KG)) {
    missing.push('weight');
  }
  if (missing.length) {
    return { ok: false, missing };
  }
  const male = profile.sex === 'male';
  const warn: string[] = [];
  const steps: Step[] = [];
  const heightM = height / 100;
  const bmi = weight / (heightM * heightM);
  const hasBodyFat = inRange(bodyFat, BODY_FAT);
  if (age < ADULT_AGE) {
    warn.push(
      'These formulas are made for adults. Teenagers are still growing, so please check targets with a doctor or dietitian.',
    );
  }

  /* 1. BMR */
  let bmr: number;
  if (hasBodyFat) {
    const leanMass = weight * (1 - bodyFat / 100);
    bmr = 370 + 21.6 * leanMass;
    steps.push({
      t: '1. Energy burned at rest (BMR)',
      f: [
        `Lean mass = ${r1(weight)} kg × (1 − ${r1(bodyFat)}%) = ${r1(leanMass)} kg`,
        `BMR = 370 + 21.6 × ${r1(leanMass)} = ${fmt(bmr)} kcal`,
      ],
      why: "Katch–McArdle equation. You gave your body-fat percentage, so this uses lean mass directly. It's more accurate than weight-based formulas for very muscular people and people with higher body fat, but only as good as the body-fat reading.",
    });
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age + (male ? 5 : -161);
    steps.push({
      t: '1. Energy burned at rest (BMR)',
      f: [
        `BMR = 10 × ${r1(weight)} kg + 6.25 × ${r0(height)} cm − 5 × ${r0(age)} yrs ${male ? '+ 5' : '− 161'}`,
        `= ${fmt(bmr)} kcal`,
      ],
      why: 'Mifflin–St Jeor equation (1990). Reviews by the Academy of Nutrition and Dietetics found it the most accurate of the common formulas for healthy adults, usually within 10% of measured values. The sex term reflects average differences in muscle mass.',
    });
  }

  /* 2. TDEE */
  const activity = ACTIVITY.find((level) => level[0] === profile.activity) ?? ACTIVITY[2];
  const tdee = bmr * activity[1];
  steps.push({
    t: '2. Energy burned per day (maintenance)',
    f: [`Maintenance = BMR × activity factor = ${fmt(bmr)} × ${activity[1]} = ${fmt(tdee)} kcal`],
    why: `You chose “${activity[2]}” (${activity[3].toLowerCase()}), factor ${activity[1]}. The factor adds movement, exercise and digestion on top of BMR. It's the biggest source of error in the whole calculation. People often overestimate their activity, so if you're unsure, pick the lower level.`,
  });

  /* 3. Goal */
  let kcal = tdee;
  const rate = Number(profile.rate) || 0;
  if (profile.goal === 'lose') {
    const deficit = (rate * KCAL_PER_KG) / 7;
    kcal = tdee - deficit;
    steps.push({
      t: '3. Adjust for your goal',
      f: [
        `Daily deficit = ${rate} kg/week × 7,700 kcal ÷ 7 days = ${fmt(deficit)} kcal`,
        `${fmt(tdee)} − ${fmt(deficit)} = ${fmt(kcal)} kcal`,
      ],
      why: 'A kilogram of body fat holds about 7,700 kcal, so each 0.5 kg a week needs roughly 550 kcal a day less than you burn. Losing 0.5–1% of body weight a week is the range usually advised to keep muscle and stay sustainable.',
    });
    if (deficit > tdee * MAX_DEFICIT_SHARE) {
      warn.push(
        `This pace is a ${r0((deficit / tdee) * 100)}% cut from maintenance. Deficits over about 25% make it harder to keep muscle and stick with the plan. A slower pace may work better.`,
      );
    }
    if ((rate / weight) * 100 > MAX_WEEKLY_LOSS_PERCENT) {
      warn.push(
        `${showWeight(rate, profile)} a week is more than 1% of your body weight. That's faster than usually advised.`,
      );
    }
    if (bmi < UNDERWEIGHT_BMI) {
      warn.push(
        `Your BMI is ${r1(bmi)}, which is under the healthy range (18.5). Losing weight isn't recommended. Please talk to a doctor.`,
      );
    }
  } else if (profile.goal === 'gain') {
    const surplus = (rate * KCAL_PER_KG) / 7;
    kcal = tdee + surplus;
    steps.push({
      t: '3. Adjust for your goal',
      f: [
        `Daily surplus = ${rate} kg/week × 7,700 kcal ÷ 7 days = ${fmt(surplus)} kcal`,
        `${fmt(tdee)} + ${fmt(surplus)} = ${fmt(kcal)} kcal`,
      ],
      why: 'A small surplus, combined with strength training, gives your body enough to build muscle. Muscle can only be built slowly, so beyond about 0.25–0.5 kg a week most of the extra weight is fat.',
    });
  } else {
    steps.push({
      t: '3. Adjust for your goal',
      f: [`Maintain: target = maintenance = ${fmt(tdee)} kcal`],
      why: 'No surplus or deficit. Your weight should stay roughly stable from week to week.',
    });
  }
  const floor = male ? MIN_KCAL.male : MIN_KCAL.female;
  if (kcal < floor) {
    warn.push(
      `The math gave ${fmt(kcal)} kcal, below the ${fmt(floor)} kcal minimum usually advised for ${male ? 'men' : 'women'} without medical supervision, so the target was raised to ${fmt(floor)}. Weight loss will be slower than the pace you chose.`,
    );
    kcal = floor;
  }
  const rounded = Math.round(kcal / 10) * 10;
  if (rounded !== kcal) {
    steps[2].f.push(`Rounded to the nearest 10 = ${fmt(rounded)} kcal`);
  }
  kcal = rounded;

  /* 4. Protein */
  const level = proteinLevel(profile, vegetarian);
  let proteinPerKg = 1.8;
  if (level === 'standard') {
    proteinPerKg = 1.6;
  } else if (profile.goal === 'lose') {
    proteinPerKg = 2.0;
  }
  const referenceWeight = bmi >= OBESE_BMI ? REFERENCE_BMI * heightM * heightM : weight;
  const protein = Math.round((proteinPerKg * referenceWeight) / 5) * 5;
  const proteinLine = `Protein = ${proteinPerKg} g × ${r1(referenceWeight)} kg = ${r0(proteinPerKg * referenceWeight)} g → rounded to ${protein} g (${fmt(protein * KCAL_PER_G.protein)} kcal)`;
  steps.push({
    t: '4. Protein',
    f:
      bmi >= OBESE_BMI
        ? [
            `Reference weight (BMI 25 at your height) = 25 × ${r1(heightM)}² = ${r1(referenceWeight)} kg`,
            proteinLine,
          ]
        : [proteinLine],
    why: proteinWhy(profile, level, vegetarian, bmi),
  });

  /* 5. Fat */
  const fatByShare = Math.round((kcal * FAT_SHARE) / KCAL_PER_G.fat);
  const fatMinimum = Math.round(MIN_FAT_PER_KG * referenceWeight);
  const fat = Math.max(fatByShare, fatMinimum);
  steps.push({
    t: '5. Fat',
    f: [
      `25% of calories = ${fmt(kcal)} × 0.25 ÷ 9 kcal/g = ${fatByShare} g`,
      `Minimum 0.6 g × ${r1(referenceWeight)} kg = ${fatMinimum} g → ${fat} g (${fmt(fat * KCAL_PER_G.fat)} kcal)`,
    ],
    why: 'Guidelines put fat at 20–35% of calories. 25% leaves room for carbs, which fuel training. The 0.6 g/kg minimum supports hormones and absorption of vitamins A, D, E and K. Fat has 9 kcal per gram, protein and carbs 4.',
  });

  /* 6. Carbs */
  const carbs = Math.max(
    0,
    Math.round((kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs),
  );
  steps.push({
    t: '6. Carbs (the rest)',
    f: [
      `(${fmt(kcal)} − ${fmt(protein * KCAL_PER_G.protein)} protein − ${fmt(fat * KCAL_PER_G.fat)} fat) ÷ 4 kcal/g = ${carbs} g`,
    ],
    why: "Carbs fill whatever calories are left after protein and fat. They're the most flexible macro and the main fuel for hard exercise.",
  });
  if (carbs < MIN_CARBS) {
    warn.push(
      `Carbs come out at ${carbs} g, under the 130 g a day the RDA sets as a minimum for the brain's glucose needs. That's fine if you eat low-carb on purpose, but you could also choose a slower pace.`,
    );
  }

  /* when the goal weight would be reached */
  let eta: { weeks: number; date: string; gk: number } | null = null;
  const goalKg = fieldNumber(profile.goalKg);
  const towardGoal =
    (profile.goal === 'lose' && goalKg < weight) || (profile.goal === 'gain' && goalKg > weight);
  if (goalKg > 0 && rate > 0 && towardGoal) {
    const weeks = Math.abs(weight - goalKg) / rate;
    const date = new Date();
    date.setDate(date.getDate() + Math.round(weeks * 7));
    eta = {
      weeks: Math.ceil(weeks),
      date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      gk: goalKg,
    };
  }
  return {
    ok: true,
    kcal,
    p: protein,
    c: carbs,
    f: fat,
    bmr,
    tdee,
    bmi,
    warn,
    steps,
    eta,
    method: hasBodyFat ? 'Katch–McArdle' : 'Mifflin–St Jeor',
  };
}
