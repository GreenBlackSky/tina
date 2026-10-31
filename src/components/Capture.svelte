<!--
  How food gets in: a meal photo, a label photo, a typed description (Claude
  estimates those), a search of the food table, or — when adding to a meal —
  a saved meal. Used on the Add screen (target "new": the result opens for
  review) and inside the review (target "append": the result is added).
-->
<script lang="ts">
  import {
    estimator,
    foodList,
    runEstimate,
    stopEstimate,
    takeFile,
    clearFile,
    data,
    ui,
    type CaptureMode,
    type CaptureTarget,
  } from '../lib/state.svelte';
  import FoodSearch from './FoodSearch.svelte';
  import MealPick from './MealPick.svelte';

  const { target }: { target: CaptureTarget } = $props();

  const isNew = $derived(target === 'new');
  const mode = $derived(isNew ? ui.mode : ui.addMode);
  const modes = $derived.by((): Array<[CaptureMode, string]> => {
    if (isNew) {
      return [
        ['photo', 'Meal photo'],
        ['label', 'Label'],
        ['text', 'Text'],
        ['search', 'Search'],
      ];
    }
    const base: Array<[CaptureMode, string]> = [
      ['photo', 'Photo'],
      ['label', 'Label'],
      ['text', 'Text'],
      ['search', 'Search'],
    ];
    const draftMode = ui.draft?.mode ?? 'log';
    return draftMode !== 'editMeal' && draftMode !== 'newMeal'
      ? [...base, ['meal', 'Saved']]
      : base;
  });

  /** Why Claude cannot be used for this mode right now ('' when it can). */
  const blocked = $derived.by(() => {
    const claude = estimator();
    if (!claude) {
      return 'Photo and text estimates need a Claude API key. Add one under Targets → Claude; Search works without it.';
    }
    if ((mode === 'photo' || mode === 'label') && !claude.canImages) {
      return 'This view can’t send photos to Claude. Try Text or Search instead.';
    }
    return '';
  });

  function chooseMode(next: CaptureMode): void {
    ui.error = '';
    ui.search = '';
    if (isNew) {
      ui.mode = next;
    } else {
      ui.addMode = ui.addMode === next ? null : next;
    }
    const current = isNew ? ui.mode : ui.addMode;
    if (current === 'search') {
      ui.searchFor = { type: isNew ? 'new' : 'add' };
    } else if (current === 'meal') {
      ui.searchFor = { type: 'meal' };
    } else if (!isNew) {
      ui.searchFor = null;
    }
  }

  /* the Add screen opens on Search with the right purpose */
  $effect(() => {
    if (isNew && ui.mode === 'search' && !ui.searchFor) {
      ui.searchFor = { type: 'new' };
    }
  });

  function onFile(event: Event): void {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      void takeFile(file);
    }
  }
</script>

<div
  class="seg"
  role="group"
  aria-label="How to add"
  style="grid-template-columns:repeat({modes.length},minmax(0,1fr))"
>
  {#each modes as [key, label] (key)}
    <button
      type="button"
      data-act={isNew ? 'mode' : 'addmode'}
      data-mode={key}
      aria-pressed={mode === key}
      onclick={() => chooseMode(key)}>{label}</button
    >
  {/each}
</div>

{#if mode === 'photo' || mode === 'label'}
  {@const isLabel = mode === 'label'}
  {#if blocked}<div class="banner">{blocked}</div>{/if}
  <div class="drop">
    {#if ui.fileUrl}
      <img src={ui.fileUrl} alt="What you picked" />
    {:else}
      <span class="cam" aria-hidden="true"></span>
      <b>{isLabel ? 'Photograph the nutrition label' : 'Photograph your plate'}</b>
      <small
        >{isLabel
          ? 'Whole table in frame, straight on'
          : 'From above, with a fork or your hand for scale'}</small
      >
    {/if}
  </div>
  <div class="pickrow">
    <label class="btn" for="camIn"
      >Take photo<input
        class="vh"
        type="file"
        id="camIn"
        accept="image/*"
        capture="environment"
        onchange={onFile}
      /></label
    >
    <label class="btn" for="galIn"
      >From gallery<input
        class="vh"
        type="file"
        id="galIn"
        accept="image/*"
        onchange={onFile}
      /></label
    >
    {#if ui.fileUrl}
      <button type="button" class="btn danger" data-act="clearphoto" onclick={clearFile}
        >Remove</button
      >
    {/if}
  </div>
  {#if ui.fileNote}<div class="hint">{ui.fileNote}</div>{/if}
  <label class="fl" for="notesIn">Description <span style="font-weight:500">(optional)</span></label
  >
  <textarea
    id="notesIn"
    placeholder={isLabel
      ? 'e.g. I ate half the 400 g pack'
      : 'e.g. cooked in 1 tbsp olive oil, about 200 g of rice'}
    bind:value={ui.notes}></textarea>
  <div style="margin-top:10px">
    <button
      type="button"
      class="btn primary block"
      data-act="run"
      data-kind={mode}
      disabled={!ui.file || !!ui.busy || !!blocked}
      onclick={() => runEstimate(isLabel ? 'label' : 'photo', target)}
      >{isLabel ? 'Read label' : 'Estimate'}</button
    >
  </div>
{:else if mode === 'text'}
  {#if blocked}<div class="banner">{blocked}</div>{/if}
  <label class="fl" for="textIn">What {isNew ? 'did you eat' : 'should be added'}?</label>
  <textarea
    id="textIn"
    placeholder="2 eggs fried in butter, 2 slices of rye toast, a latte"
    bind:value={ui.text}></textarea>
  <div class="hint">Amounts help: “150 g tofu”, “a big bowl”, “half a pizza”.</div>
  <div style="margin-top:10px">
    <button
      type="button"
      class="btn primary block"
      data-act="run"
      data-kind="text"
      disabled={!ui.text.trim() || !!ui.busy || !!blocked}
      onclick={() => runEstimate('text', target)}>Estimate</button
    >
  </div>
{:else if mode === 'search'}
  <FoodSearch placeholder={isNew ? 'tofu, rice, banana…' : 'Search foods…'} />
  <div class="hint">
    {foodList().length} foods{data.foods.length ? `, ${data.foods.length} of them yours` : ''}.
    Values per 100 g.
  </div>
{:else if mode === 'meal'}
  <MealPick />
{/if}

{#if ui.busy && ui.busyTarget === target}
  <div class="status" role="status">
    <span style="display:flex;gap:10px;align-items:center"
      ><span class="pulse"></span>{ui.busy === 'label'
        ? 'Tina is reading the label…'
        : 'Tina is sniffing your plate…'}</span
    >
    <button type="button" class="btn" data-act="stop" onclick={stopEstimate}>Stop</button>
  </div>
{/if}
{#if ui.error && ui.errorTarget === target}
  <div class="err" role="alert">{ui.error}</div>
{/if}
