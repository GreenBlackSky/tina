<!--
  Today (or any earlier day): Tina's eye and the calories left, three bars
  for protein, carbs and fat, the day's meals, and saved meals that fit what
  is left.
-->
<script lang="ts">
  import Eye from '../components/Eye.svelte';
  import MacroLine from '../components/MacroLine.svelte';
  import { account, initial, signIn } from '../lib/account.svelte';
  import { MEAL_NAME, mealByHour, niceDate, parseDate, today } from '../lib/dates';
  import { eyeState } from '../lib/eye';
  import { fmt, itemValues, mealsThatFit, r0, sumItems } from '../lib/nutrition';
  import {
    arm,
    data,
    dayTotals,
    editEntry,
    go,
    logEntryAgain,
    nextDay,
    previousDay,
    removeEntry,
    saveEntryAsMeal,
    startDraftFromMeal,
    ui,
  } from '../lib/state.svelte';
  import type { Entry } from '../lib/types';

  const totals = $derived(dayTotals(ui.date));
  const goals = $derived(data.settings);
  const entries = $derived(
    (data.days[ui.date]?.entries ?? [])
      .slice()
      .sort((a, b) => (a.t || '').localeCompare(b.t || '')),
  );
  const left = $derived(goals.kcal - totals.kcal);
  const over = $derived(left < 0);
  const eaten = $derived(goals.kcal ? totals.kcal / goals.kcal : 0);
  const eye = $derived(eyeState(eaten));
  const isToday = $derived(ui.date === today());
  const nextMeal = $derived(isToday ? mealByHour() : 'snack');
  const fits = $derived(
    isToday ? mealsThatFit(data.meals, left, Math.max(0, goals.p - totals.p)) : [],
  );

  const macros = $derived([
    { name: 'Protein', color: 'var(--pro)', value: totals.p, goal: goals.p },
    { name: 'Carbs', color: 'var(--carb)', value: totals.c, goal: goals.c },
    { name: 'Fat', color: 'var(--fat)', value: totals.f, goal: goals.f },
  ]);

  function timeOf(entry: Entry): string {
    return entry.t
      ? new Date(entry.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  function remove(entry: Entry): void {
    if (arm('e:' + entry.id)) {
      void removeEntry(ui.date, entry.id);
    }
  }

  function addNext(): void {
    ui.pendingMeal = nextMeal;
    go('add');
  }
</script>

<div class="trow">
  <div class="wordmark" aria-hidden="true">TINA</div>
  {#if account.now.status === 'signed-in'}
    <button
      type="button"
      class="avatar"
      data-act="account"
      aria-label="Account: {account.now.email}"
      onclick={() => go('settings')}>{initial(account.now)}</button
    >
  {:else if account.now.status === 'signed-out'}
    <button type="button" class="acct" data-act="account" disabled={account.busy} onclick={signIn}
      >Sign in</button
    >
  {/if}
</div>
<div class="thead">
  <div>
    <div class="tsub">
      {parseDate(ui.date).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })}
    </div>
    <h1 class="ttl">{niceDate(ui.date)}</h1>
  </div>
  <div class="dnav">
    <button
      type="button"
      class="rbtn"
      data-act="prevday"
      aria-label="Previous day"
      onclick={previousDay}>‹</button
    >
    <button
      type="button"
      class="rbtn"
      data-act="nextday"
      aria-label="Next day"
      disabled={isToday}
      onclick={nextDay}>›</button
    >
  </div>
</div>

<div class="hero">
  <Eye fraction={eaten} label="{fmt(totals.kcal)} of {fmt(goals.kcal)} kcal eaten. {eye.mood}." />
  <span class="rv num" class:over>{fmt(Math.abs(left))}</span>
  <span class="rl">{over ? 'kcal over' : 'kcal left'}</span>
  <span class="kbar" aria-hidden="true"
    ><span class:over style="width:{Math.min(100, eaten * 100).toFixed(1)}%"></span></span
  >
  <span class="rs num">{fmt(totals.kcal)} of {fmt(goals.kcal)} eaten</span>
  <span class="mood">{eye.mood}</span>
</div>

<div class="mbars">
  {#each macros as macro (macro.name)}
    {@const remaining = macro.goal - macro.value}
    <div class="mbar">
      <span>{macro.name}</span>
      <span
        class="bar"
        role="img"
        aria-label="{macro.name}: {r0(macro.value)} of {r0(macro.goal)} g"
        ><span
          style="width:{macro.goal
            ? Math.min(100, (macro.value / macro.goal) * 100).toFixed(1)
            : 0}%;background:{remaining < 0 ? 'var(--over)' : macro.color}"
        ></span></span
      >
      <b class="num" class:over={remaining < 0}
        >{r0(Math.abs(remaining))} g {remaining < 0 ? 'over' : 'left'}</b
      >
    </div>
  {/each}
</div>

{#if !data.settings.isSet}
  <div class="banner">
    These are example targets. <button
      type="button"
      class="linkbtn"
      data-act="settings"
      onclick={() => go('settings')}>Calculate yours</button
    >
  </div>
{/if}

<section class="mealcard" aria-label="Meals">
  {#if !entries.length}
    <div class="mempty">
      {isToday ? "Bowl's empty." : 'Nothing logged on this day.'} Snap your plate, a label, or type what
      you ate.
    </div>
  {/if}
  {#each entries as entry (entry.id)}
    {@const values = sumItems(entry.items)}
    {@const armed = ui.armed === 'e:' + entry.id}
    <details class="erow">
      <summary
        ><span class="en"
          ><b>{entry.title}</b><span
            >{MEAL_NAME[entry.meal] || 'Snack'}{timeOf(entry) && isToday
              ? ` · ${timeOf(entry)}`
              : ''}</span
          ></span
        ><span class="ek num">{fmt(values.kcal)}</span></summary
      >
      <div class="ebody">
        <MacroLine {values} />
        <div class="items">
          {#each entry.items as item, index (index)}
            <div>
              <span>{item.name} · {r0(item.grams)}g</span><span class="num"
                >{fmt(itemValues(item).kcal)}</span
              >
            </div>
          {/each}
        </div>
        <div class="row-actions">
          <button type="button" class="btn" data-act="editentry" onclick={() => editEntry(entry)}
            >Edit</button
          >
          <button
            type="button"
            class="btn"
            data-act="entryagain"
            onclick={() => logEntryAgain(entry)}>Log again</button
          >
          <button
            type="button"
            class="btn"
            data-act="entry2meal"
            onclick={() => saveEntryAsMeal(entry)}>Save as regular</button
          >
          <button
            type="button"
            class="btn danger"
            class:armed
            data-act="delentry"
            onclick={() => remove(entry)}>{armed ? 'Tap again to delete' : 'Delete'}</button
          >
        </div>
      </div>
    </details>
  {/each}
  <button type="button" class="addrow" data-act="goadd" data-meal={nextMeal} onclick={addNext}
    ><svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg
    >Add {MEAL_NAME[nextMeal].toLowerCase()}</button
  >
</section>

{#if fits.length}
  <div class="fits">
    <div class="fh">Fits what's left</div>
    <div class="fscroll">
      {#each fits as fit (fit.meal.id)}
        <button
          type="button"
          class="fcard"
          data-act="logmeal"
          onclick={() => startDraftFromMeal(fit.meal)}
          ><b>{fit.meal.name}</b><span class="num"
            >{fmt(fit.values.kcal)} kcal · {r0(fit.values.p)} g protein</span
          ></button
        >
      {/each}
    </div>
  </div>
{/if}
