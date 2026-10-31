<!--
  Add food. Without a draft: the capture widget. With one: the review — name,
  meal, day, each food with its grams (edit, change, remove), more foods,
  the total, portion scaling, and Save. The same review edits a logged meal
  or a saved meal.
-->
<script lang="ts">
  import Capture from '../components/Capture.svelte';
  import FoodSearch from '../components/FoodSearch.svelte';
  import MacroLine from '../components/MacroLine.svelte';
  import { MEALS, niceDate, today } from '../lib/dates';
  import { fmt, itemValues, r0, r1, sumItems } from '../lib/nutrition';
  import { cancelDraft, commitDraft, newSavedMeal, scaleDraft, ui } from '../lib/state.svelte';
  import type { Item, MealSlot } from '../lib/types';

  const SCALES: Array<[number, string]> = [
    [0.5, '½×'],
    [0.75, '¾×'],
    [1.5, '1½×'],
    [2, '2×'],
  ];
  const HEADINGS = {
    log: 'Check and save',
    editEntry: 'Edit logged meal',
    editMeal: 'Edit saved meal',
    newMeal: 'New saved meal',
  };

  const draft = $derived(ui.draft);
  const totals = $derived(sumItems(draft?.items));
  const isMeal = $derived(draft?.mode === 'editMeal' || draft?.mode === 'newMeal');

  function badge(item: Item): { text: string; className: string } | null {
    switch (item.src) {
      case 'est':
        return { text: 'estimate', className: 'badge est' };
      case 'label':
        return { text: 'label', className: 'badge' };
      case 'custom':
        return { text: 'mine', className: 'badge' };
      case 'recipe':
        return { text: 'recipe', className: 'badge' };
      default:
        return null;
    }
  }

  /** "today", or the day's name. */
  function dayWord(date: string): string {
    const nice = niceDate(date);
    return nice.toLowerCase() === 'today' ? 'today' : nice;
  }

  function toggleSwap(index: number): void {
    const swapping = ui.searchFor?.type === 'swap' && ui.searchFor.index === index;
    ui.searchFor = swapping ? null : { type: 'swap', index };
    const item = draft!.items[index];
    ui.search = swapping ? '' : (item.guess || item.name).split(',')[0];
  }

  function removeItem(index: number): void {
    draft!.items.splice(index, 1);
    ui.searchFor = null;
  }

  function onDate(event: Event): void {
    const value = (event.currentTarget as HTMLInputElement).value;
    if (draft && value) {
      draft.date = value > today() ? today() : value;
    }
  }

  function onSaveMeal(event: Event): void {
    if (!draft) {
      return;
    }
    draft.saveMeal = (event.currentTarget as HTMLInputElement).checked;
    if (draft.saveMeal && !draft.mealName) {
      draft.mealName = draft.title;
    }
  }
</script>

{#if !draft}
  <h1 class="ptitle">Add food</h1>
  <Capture target="new" />
  {#if ui.mode !== 'search'}
    <p class="hint" style="margin-top:14px">
      Estimates from photos are usually within 20–30%. Portion size is the hard part, so check the
      grams before saving.
    </p>
  {/if}
  <div class="banner" style="margin-top:16px">
    Making something you'll eat again? <button
      type="button"
      class="linkbtn"
      data-act="newmeal"
      onclick={newSavedMeal}>Build a new saved meal</button
    > from its ingredients instead.
  </div>
{:else}
  <div class="datenav" style="margin-top:0">
    <button
      type="button"
      data-act="canceldraft"
      aria-label="Close without saving"
      onclick={cancelDraft}>✕</button
    ><b>{HEADINGS[draft.mode]}</b><span style="width:40px"></span>
  </div>
  <section class="review">
    <label class="fl" for="titleIn" style="margin-top:0">Name</label>
    <input
      type="text"
      id="titleIn"
      bind:value={draft.title}
      placeholder={isMeal ? 'e.g. Pasta with tomato sauce' : 'e.g. Chicken and rice'}
    />
    {#if !isMeal}
      <!-- svelte-ignore a11y_label_has_associated_control (a heading for the chips, styled like the others) -->
      <label class="fl">Meal</label>
      <div class="chips" role="group" aria-label="Meal">
        {#each MEALS as [key, label] (key)}
          <button
            type="button"
            data-act="setmeal"
            data-meal={key}
            aria-pressed={draft.meal === key}
            onclick={() => (draft.meal = key as MealSlot)}>{label.replace(/s$/, '')}</button
          >
        {/each}
      </div>
      <label class="fl" for="dateIn">Day</label>
      <input type="date" id="dateIn" value={draft.date} max={today()} onchange={onDate} />
    {/if}
    {#if draft.mode === 'editEntry' && draft.origDate}
      <div class="hint">
        You're changing a meal already in your log for {dayWord(draft.origDate)}.
      </div>
    {/if}
    {#if draft.mode === 'editMeal'}
      <div class="hint">
        Changes apply the next time you log this meal. Days you've already logged keep their
        numbers.
      </div>
    {/if}
    {#if draft.mode === 'newMeal'}
      <div class="hint">
        Build it from foods, label photos or other saved meals. Nothing is logged until you use it.
      </div>
    {/if}
    {#if draft.comment}<div class="comment">{draft.comment}</div>{/if}

    <div style="margin-top:12px">
      {#if !draft.items.length}
        <div class="hint" style="padding-block:8px">No foods yet. Add some below.</div>
      {/if}
      {#each draft.items as item, index (index)}
        {@const values = itemValues(item)}
        {@const itemBadge = badge(item)}
        <div class="item" data-i={index}>
          <div class="top">
            <span class="nm"
              >{item.name}{#if itemBadge}<span class={itemBadge.className}>{itemBadge.text}</span
                >{/if}</span
            >
            <button
              type="button"
              class="linkbtn rm"
              data-act="rmitem"
              aria-label="Remove {item.name}"
              onclick={() => removeItem(index)}>Remove</button
            >
          </div>
          <div class="ctl">
            <span class="gram"
              ><input
                type="number"
                inputmode="decimal"
                min="0"
                step="1"
                id="g{index}"
                data-grams={index}
                value={r1(item.grams)}
                oninput={(event) =>
                  (item.grams = Number((event.currentTarget as HTMLInputElement).value) || 0)}
                aria-label="Grams of {item.name}"
              /></span
            >
            <span class="vals num" id="v{index}"
              ><b>{fmt(values.kcal)} kcal</b> · P {r0(values.p)} · C {r0(values.c)} · F {r0(
                values.f,
              )}</span
            >
          </div>
          {#if item.guess && item.guess.toLowerCase() !== item.name.toLowerCase()}
            <div class="hint">Seen as “{item.guess}”</div>
          {/if}
          <button type="button" class="linkbtn" data-act="swap" onclick={() => toggleSwap(index)}
            >Change food</button
          >
          {#if ui.searchFor?.type === 'swap' && ui.searchFor.index === index}
            <div style="margin-top:6px"><FoodSearch placeholder="Search to replace…" /></div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="item">
      <div class="fl" style="margin-top:0">Add to this meal</div>
      <Capture target="append" />
    </div>
    <div class="total">
      <span>Total</span><b class="num" id="totK">{fmt(totals.kcal)} kcal</b>
    </div>
    <div id="totM" style="text-align:right"><MacroLine values={totals} /></div>
    <div class="scale">
      <span>Portion</span>
      {#each SCALES as [factor, label] (factor)}
        <button
          type="button"
          class="btn"
          data-act="scale"
          data-f={factor}
          onclick={() => scaleDraft(factor)}>{label}</button
        >
      {/each}
    </div>

    {#if draft.mode === 'log'}
      {#if draft.labelFood}
        <label class="check"
          ><input type="checkbox" id="saveFoodIn" bind:checked={draft.saveFood} /> Save “{draft
            .labelFood.name}” to my foods</label
        >
      {/if}
      <label class="check"
        ><input type="checkbox" id="saveMealIn" checked={draft.saveMeal} onchange={onSaveMeal} /> Also
        save as a new meal</label
      >
      {#if draft.saveMeal}
        <input
          type="text"
          id="mealNameIn"
          style="margin-top:8px"
          placeholder="Name, e.g. Usual breakfast"
          bind:value={draft.mealName}
        />
        <div class="hint">It will appear in Meals with these foods and amounts.</div>
      {/if}
      <div style="margin-top:14px">
        <button
          type="button"
          class="btn primary block"
          data-act="commit"
          disabled={!draft.items.length}
          onclick={commitDraft}>Save to {dayWord(draft.date)}</button
        >
      </div>
    {:else}
      <div style="margin-top:14px">
        <button
          type="button"
          class="btn primary block"
          data-act="commit"
          disabled={!draft.items.length}
          onclick={commitDraft}>{isMeal ? 'Save meal' : 'Save changes'}</button
        >
      </div>
    {/if}
  </section>
{/if}
