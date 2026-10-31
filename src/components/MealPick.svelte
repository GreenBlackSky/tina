<!-- Picking a saved meal to add its foods to the meal being built. -->
<script lang="ts">
  import { fmt, sumItems } from '../lib/nutrition';
  import { data, pickMealInto, ui } from '../lib/state.svelte';

  const MAX_SHOWN = 30;

  const list = $derived.by(() => {
    const query = ui.search.trim().toLowerCase();
    return data.meals
      .filter(
        (meal) =>
          (!query || meal.name.toLowerCase().includes(query)) &&
          (!ui.draft || meal.id !== ui.draft.mealId),
      )
      .slice(0, MAX_SHOWN);
  });
</script>

<input
  type="search"
  id="mealPickBox"
  placeholder="Search your saved meals…"
  bind:value={ui.search}
  autocomplete="off"
/>
<div id="mealPickRes">
  {#if !data.meals.length}
    <div class="hint">No saved meals yet.</div>
  {:else if !list.length}
    <div class="hint">No saved meal matches.</div>
  {:else}
    <div class="results">
      {#each list as meal (meal.id)}
        <button type="button" data-act="pickmeal" onclick={() => pickMealInto(meal.id)}
          ><span>{meal.name}</span><span class="num">{fmt(sumItems(meal.items).kcal)} kcal</span
          ></button
        >
      {/each}
    </div>
  {/if}
</div>
