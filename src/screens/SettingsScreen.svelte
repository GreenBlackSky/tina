<!--
  Targets: Google sign-in, the calculator (about you → calories and macros, every step
  explained), setting targets by hand, your own foods, the Claude key for
  photo and text estimates, and backups.
-->
<script lang="ts">
  import AccountCard from '../components/AccountCard.svelte';
  import ClaudeCard from '../components/ClaudeCard.svelte';
  import DataCard from '../components/DataCard.svelte';
  import { BASE_FOODS, clampNumber, fmt, r0, r1 } from '../lib/nutrition';
  import {
    arm,
    data,
    deleteFood,
    go,
    isVegetarian,
    saveSettings,
    setDiet,
    ui,
  } from '../lib/state.svelte';
  import {
    ACTIVITY,
    calculate,
    cmToInches,
    DEFAULT_RATE,
    fieldNumber,
    inchesToCm,
    kgToLb,
    lbToKg,
    proteinLevel,
    RATES,
    showWeight,
  } from '../lib/targets';
  import type { Goal } from '../lib/types';
  import { toast } from '../lib/ui/toast.svelte';

  const MIN_KCAL = 500;
  const MAX_KCAL = 10_000;

  const profile = $derived(ui.profile);
  const imperial = $derived(profile.units === 'imperial');
  const goals = $derived(data.settings);
  const result = $derived(calculate(profile, isVegetarian()));
  const rates = $derived(RATES[profile.goal] ?? []);
  const level = $derived(proteinLevel(profile, isVegetarian()));

  /* height and weight as shown in the chosen units */
  const heightInches = $derived(cmToInches(fieldNumber(profile.heightCm)));
  const feet = $derived(Number.isFinite(heightInches) ? Math.floor(heightInches / 12) : '');
  const inches = $derived(
    Number.isFinite(heightInches) ? r0(heightInches - Math.floor(heightInches / 12) * 12) : '',
  );
  const shownWeight = (kg: unknown): number | string => {
    const value = fieldNumber(kg);
    if (!Number.isFinite(value)) {
      return '';
    }
    return r1(imperial ? kgToLb(value) : value);
  };

  const sameAsCurrent = $derived(
    result.ok &&
      goals.method === 'calculated' &&
      goals.kcal === result.kcal &&
      goals.p === result.p &&
      goals.c === result.c &&
      goals.f === result.f,
  );

  /* set by hand */
  let handKcal = $state(String(r0(data.settings.kcal)));
  let handP = $state(String(r0(data.settings.p)));
  let handC = $state(String(r0(data.settings.c)));
  let handF = $state(String(r0(data.settings.f)));
  let handTouched = $state(false);
  const handTotal = $derived(
    clampNumber(handP) * 4 + clampNumber(handC) * 4 + clampNumber(handF) * 9,
  );

  const value = (event: Event): string => (event.currentTarget as HTMLInputElement).value;

  function setWeight(field: 'weightKg' | 'goalKg', text: string): void {
    ui.profile[field] = text === '' ? '' : r1(imperial ? lbToKg(Number(text)) : Number(text));
  }

  let feetInput = $state<HTMLInputElement>();
  let inchInput = $state<HTMLInputElement>();
  function setHeightImperial(): void {
    const ft = Number(feetInput?.value) || 0;
    const inch = Number(inchInput?.value) || 0;
    ui.profile.heightCm = ft || inch ? r1(inchesToCm(ft * 12 + inch)) : '';
  }

  function setGoal(goal: Goal): void {
    ui.profile.goal = goal;
    ui.profile.rate = DEFAULT_RATE[goal];
  }

  function useCalculated(): void {
    if (!result.ok) {
      return;
    }
    void saveSettings({
      kcal: result.kcal,
      p: result.p,
      c: result.c,
      f: result.f,
      method: 'calculated',
      profile: { ...ui.profile },
    });
    toast('Targets saved');
    go('today');
  }

  function saveByHand(): void {
    const kcal = clampNumber(handKcal, MAX_KCAL);
    if (kcal < MIN_KCAL) {
      toast('Calories look too low — check the number.');
      return;
    }
    void saveSettings({
      kcal,
      p: clampNumber(handP, 1000),
      c: clampNumber(handC, 2000),
      f: clampNumber(handF, 1000),
      method: 'custom',
      profile: { ...ui.profile },
    });
    toast('Targets saved');
    go('today');
  }

  const percent = (kcal: number): number => (result.ok ? r0((kcal / result.kcal) * 100) : 0);
  const missingText = (missing: string[]): string =>
    missing.join(', ').replace(/, ([^,]*)$/, ' and $1');
</script>

{#snippet chip(selected: boolean, label: string, onclick: () => void)}
  <button type="button" aria-pressed={selected} {onclick}>{label}</button>
{/snippet}

<div class="datenav" style="margin-top:0">
  <button type="button" data-act="back" aria-label="Back" onclick={() => go('today')}>‹</button><b
    >Your targets</b
  ><span style="width:40px"></span>
</div>
<AccountCard />
{#if goals.isSet}
  <div class="banner num">
    Current: <b>{fmt(goals.kcal)} kcal</b> · P {r0(goals.p)} g · C {r0(goals.c)} g · F {r0(goals.f)}
    g {goals.method === 'custom' ? '(set by hand)' : '(calculated)'}
  </div>
{/if}

<section class="review">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
    <b>About you</b>
    <div class="chips" role="group" aria-label="Units">
      {@render chip(profile.units === 'metric', 'kg / cm', () => (ui.profile.units = 'metric'))}
      {@render chip(imperial, 'lb / ft', () => (ui.profile.units = 'imperial'))}
    </div>
  </div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="fl">Diet</label>
  <div class="chips" role="group" aria-label="Diet">
    {@render chip(!isVegetarian(), 'Everything', () => setDiet(''))}
    {@render chip(isVegetarian(), 'Vegetarian (eggs & dairy)', () => setDiet('vegetarian'))}
  </div>
  <div class="hint">
    Vegetarian hides meat and fish from Search and tells Claude that anything meat-like in a photo
    is a plant-based version.
  </div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="fl">Sex</label>
  <div class="chips" role="group" aria-label="Sex">
    {@render chip(profile.sex === 'male', 'Male', () => (ui.profile.sex = 'male'))}
    {@render chip(profile.sex === 'female', 'Female', () => (ui.profile.sex = 'female'))}
  </div>
  <div class="grid2">
    <div>
      <label class="fl" for="pAge">Age</label><input
        type="number"
        inputmode="numeric"
        id="pAge"
        value={profile.age}
        oninput={(event) => (ui.profile.age = value(event))}
        placeholder="years"
      />
    </div>
    {#if imperial}
      <div>
        <label class="fl" for="pFt">Height</label>
        <div class="grid2" style="gap:6px">
          <input
            type="number"
            inputmode="numeric"
            id="pFt"
            bind:this={feetInput}
            value={feet}
            oninput={setHeightImperial}
            placeholder="ft"
            aria-label="Feet"
          /><input
            type="number"
            inputmode="numeric"
            id="pIn"
            bind:this={inchInput}
            value={inches}
            oninput={setHeightImperial}
            placeholder="in"
            aria-label="Inches"
          />
        </div>
      </div>
    {:else}
      <div>
        <label class="fl" for="pH">Height (cm)</label><input
          type="number"
          inputmode="decimal"
          id="pH"
          value={profile.heightCm}
          oninput={(event) => (ui.profile.heightCm = value(event))}
          placeholder="cm"
        />
      </div>
    {/if}
    <div>
      <label class="fl" for="pW">Weight ({imperial ? 'lb' : 'kg'})</label><input
        type="number"
        inputmode="decimal"
        id="pW"
        value={shownWeight(profile.weightKg)}
        oninput={(event) => setWeight('weightKg', value(event))}
      />
    </div>
    <div>
      <label class="fl" for="pBf">Body fat % <span style="font-weight:500">(optional)</span></label
      ><input
        type="number"
        inputmode="decimal"
        id="pBf"
        value={profile.bf}
        oninput={(event) => (ui.profile.bf = value(event))}
        placeholder="if known"
      />
    </div>
  </div>
  <div class="hint">
    Leave body fat empty unless it was measured (DEXA, calipers, a decent smart scale). A guess
    makes the result worse.
  </div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="fl">Activity</label>
  <div class="opts" role="group" aria-label="Activity">
    {#each ACTIVITY as [id, factor, name, description] (id)}
      <button
        type="button"
        data-act="pact"
        aria-pressed={profile.activity === id}
        onclick={() => (ui.profile.activity = id)}
        ><b>{name} <span class="num">×{factor}</span></b><span>{description}</span></button
      >
    {/each}
  </div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="fl">Goal</label>
  <div class="chips" role="group" aria-label="Goal">
    {@render chip(profile.goal === 'lose', 'Lose weight', () => setGoal('lose'))}
    {@render chip(profile.goal === 'maintain', 'Maintain', () => setGoal('maintain'))}
    {@render chip(profile.goal === 'gain', 'Gain muscle', () => setGoal('gain'))}
  </div>
  <!-- svelte-ignore a11y_label_has_associated_control -->
  <label class="fl">Protein level</label>
  <div class="chips" role="group" aria-label="Protein level">
    {@render chip(
      level === 'standard',
      'Standard · 1.6 g/kg',
      () => (ui.profile.pLevel = 'standard'),
    )}
    {@render chip(
      level === 'higher',
      `Higher · ${profile.goal === 'lose' ? '2.0' : '1.8'} g/kg`,
      () => (ui.profile.pLevel = 'higher'),
    )}
  </div>
  {#if rates.length}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <label class="fl">Pace per week</label>
    <div class="chips" role="group" aria-label="Pace">
      {#each rates as [rate, name] (rate)}
        {@render chip(
          String(profile.rate) === String(rate),
          `${name} · ${imperial ? r1(kgToLb(rate)) + ' lb' : rate + ' kg'}`,
          () => (ui.profile.rate = rate),
        )}
      {/each}
    </div>
    <label class="fl" for="pGoalW"
      >Goal weight ({imperial ? 'lb' : 'kg'}) <span style="font-weight:500">(optional)</span></label
    ><input
      type="number"
      inputmode="decimal"
      id="pGoalW"
      value={shownWeight(profile.goalKg)}
      oninput={(event) => setWeight('goalKg', value(event))}
    />
  {/if}
</section>

<div id="calcOut" style="margin-top:14px">
  {#if !result.ok}
    <div class="empty" style="margin-top:0">
      Enter your {missingText(result.missing)} to calculate your targets.
    </div>
  {:else}
    <section class="facts" aria-label="Calculated targets">
      <div class="hd" style="font-size:24px">Your daily targets</div>
      <div class="cal">
        <span class="l">Calories</span><span class="v num">{fmt(result.kcal)}</span>
      </div>
      <div class="mrow num">
        <span class="n"
          ><span class="dot" style="background:var(--pro)"></span>Protein {result.p} g</span
        ><span class="p">{percent(result.p * 4)}%</span>
      </div>
      <div class="mrow num">
        <span class="n"
          ><span class="dot" style="background:var(--carb)"></span>Carbs {result.c} g</span
        ><span class="p">{percent(result.c * 4)}%</span>
      </div>
      <div class="mrow num">
        <span class="n"
          ><span class="dot" style="background:var(--fat)"></span>Fat {result.f} g</span
        ><span class="p">{percent(result.f * 9)}%</span>
      </div>
    </section>
    <div class="hint num">
      Maintenance ≈ {fmt(result.tdee)} kcal · BMR {fmt(result.bmr)} kcal · BMI {r1(result.bmi)} · % =
      share of calories
    </div>
    {#if result.eta}
      <div class="banner num">
        At {showWeight(Number(profile.rate), profile)} a week you'd reach {showWeight(
          result.eta.gk,
          profile,
        )} in about {result.eta.weeks} weeks, around {result.eta.date}. Real progress is rarely a
        straight line.
      </div>
    {/if}
    {#each result.warn as warning (warning)}<div class="err">{warning}</div>{/each}
    <div style="margin-top:12px">
      <button
        type="button"
        class="btn primary block"
        data-act="usecalc"
        disabled={sameAsCurrent}
        onclick={useCalculated}
        >{sameAsCurrent ? 'These are your current targets' : 'Use these targets'}</button
      >
    </div>
    <h2>How these numbers were worked out</h2>
    <ol class="steps">
      {#each result.steps as step (step.t)}
        <li>
          <b>{step.t}</b>{#each step.f as line (line)}<code>{line}</code>{/each}
          <p>{step.why}</p>
        </li>
      {/each}
    </ol>
    <div class="review" style="box-shadow:none">
      <b>Treat this as a starting point</b>
      <p class="hint" style="margin-top:4px">
        Every formula here is an average, and real people differ by about ±10%. Weigh yourself a few
        mornings a week and compare 2–3 week averages. If your weight isn't moving the way your goal
        says, change calories by 100–200 kcal. Recalculate after every 2–3 kg change. These formulas
        aren't meant for pregnancy, breastfeeding, eating disorders or medical conditions, so talk
        to a professional in those cases.
      </p>
    </div>
  {/if}
</div>

<details class="entry" style="margin-top:16px" open={goals.method === 'custom'}>
  <summary><span class="t">Set targets by hand instead</span><span></span></summary>
  <div class="body">
    <label class="fl" for="tK" style="margin-top:0">Calories (kcal)</label><input
      type="number"
      inputmode="numeric"
      id="tK"
      bind:value={handKcal}
      oninput={() => (handTouched = true)}
    />
    <div class="grid2" style="margin-top:4px">
      <div>
        <label class="fl" for="tP">Protein (g)</label><input
          type="number"
          inputmode="numeric"
          id="tP"
          bind:value={handP}
          oninput={() => (handTouched = true)}
        />
      </div>
      <div>
        <label class="fl" for="tC">Carbs (g)</label><input
          type="number"
          inputmode="numeric"
          id="tC"
          bind:value={handC}
          oninput={() => (handTouched = true)}
        />
      </div>
      <div>
        <label class="fl" for="tF">Fat (g)</label><input
          type="number"
          inputmode="numeric"
          id="tF"
          bind:value={handF}
          oninput={() => (handTouched = true)}
        />
      </div>
    </div>
    <div class="hint num" id="macroCheck">
      {handTouched ? 'Your' : 'These'} macros add up to {fmt(handTotal)} kcal (protein and carbs 4 kcal/g,
      fat 9 kcal/g).
    </div>
    <div style="margin-top:12px">
      <button type="button" class="btn block" data-act="savesettings" onclick={saveByHand}
        >Save my own targets</button
      >
    </div>
  </div>
</details>

<h2>My foods</h2>
{#if !data.foods.length}
  <div class="hint">Foods you save from nutrition labels appear here and in Search.</div>
{:else}
  {#each data.foods as food (food.id)}
    {@const armed = ui.armed === 'f:' + food.id}
    <div class="meal">
      <div style="display:flex;justify-content:space-between;gap:10px">
        <span class="t">{food.name}</span><span class="num">{r0(food.per100.kcal)} kcal/100g</span>
      </div>
      <div class="sub num">
        P {r1(food.per100.p)} · C {r1(food.per100.c)} · F {r1(food.per100.f)} per 100 g
      </div>
      <div class="row-actions">
        <button
          type="button"
          class="btn danger"
          class:armed
          data-act="delfood"
          onclick={() => {
            if (arm('f:' + food.id)) {
              void deleteFood(food.id);
            }
          }}>{armed ? 'Tap again to delete' : 'Delete'}</button
        >
      </div>
    </div>
  {/each}
{/if}

<ClaudeCard />
<DataCard />

<h2>About the food numbers</h2>
<p class="hint">
  Reference values for {BASE_FOODS.length} common foods follow USDA nutrient data. Items marked
  <span class="badge est">estimate</span> weren't in the table, so Claude estimated them. Your log is
  stored in this browser only, until sync is set up.
</p>
