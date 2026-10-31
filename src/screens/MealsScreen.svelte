<!-- Saved meals: log one (it opens for review first), edit or delete it. -->
<script lang="ts">
  import MacroLine from '../components/MacroLine.svelte';
  import { fmt, r0, sumItems } from '../lib/nutrition';
  import {
    arm,
    data,
    deleteMeal,
    editSavedMeal,
    newSavedMeal,
    startDraftFromMeal,
    ui,
  } from '../lib/state.svelte';

  const list = $derived.by(() => {
    const query = ui.mealQuery.trim().toLowerCase();
    return data.meals.filter((meal) => !query || meal.name.toLowerCase().includes(query));
  });

  function remove(id: string): void {
    if (arm('m:' + id)) {
      void deleteMeal(id);
    }
  }
</script>

<div class="thead" style="margin-bottom:12px">
  <h1 class="ptitle" style="margin:0">Saved meals</h1>
  <button type="button" class="btn primary" data-act="newmeal" onclick={newSavedMeal}
    >+ New meal</button
  >
</div>

{#if !data.meals.length}
  <div class="empty">
    No saved meals yet.<br />Tap “New meal” to build one, tick “Also save as a regular meal” when
    logging, or open a logged meal on Today and tap “Save as regular”.
  </div>
{:else}
  <input
    type="search"
    id="mealSearch"
    placeholder="Search {data.meals.length} meals…"
    bind:value={ui.mealQuery}
    autocomplete="off"
    style="margin-bottom:10px"
  />
  <div id="mealList">
    {#each list as meal (meal.id)}
      {@const values = sumItems(meal.items)}
      {@const armed = ui.armed === 'm:' + meal.id}
      <div class="meal">
        <div style="display:flex;justify-content:space-between;gap:10px">
          <span class="t">{meal.name}</span><b class="num">{fmt(values.kcal)} kcal</b>
        </div>
        <MacroLine {values} />
        <div class="sub">
          {meal.items.map((item) => `${item.name.split(',')[0]} ${r0(item.grams)}g`).join(' · ')}
        </div>
        {#if meal.source}
          <div class="sub">From {meal.source}{meal.note ? ` · ${meal.note}` : ''}</div>
        {/if}
        <div class="row-actions">
          <button
            type="button"
            class="btn primary"
            data-act="logmeal"
            onclick={() => startDraftFromMeal(meal)}>Log it</button
          >
          <button type="button" class="btn" data-act="editmeal" onclick={() => editSavedMeal(meal)}
            >Edit</button
          >
          <button
            type="button"
            class="btn danger"
            class:armed
            data-act="delmeal"
            onclick={() => remove(meal.id)}>{armed ? 'Tap again to delete' : 'Delete'}</button
          >
        </div>
      </div>
    {:else}
      <div class="hint">No saved meal matches.</div>
    {/each}
  </div>
  <p class="hint">
    Logging a saved meal opens it for review first, so you can change the amounts for that day.
    Editing a saved meal never changes days you've already logged.
  </p>
{/if}
