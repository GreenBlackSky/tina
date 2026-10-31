<!-- The food search box and its results; picking one calls pickFood(). -->
<script lang="ts">
  import { r0, searchFoods } from '../lib/nutrition';
  import { foodList, pickFood, ui } from '../lib/state.svelte';

  const { placeholder }: { placeholder: string } = $props();

  let input = $state<HTMLInputElement>();
  const results = $derived(searchFoods(ui.search, foodList()));

  $effect(() => {
    input?.focus();
  });
</script>

<input
  type="search"
  id="searchBox"
  bind:this={input}
  {placeholder}
  bind:value={ui.search}
  autocomplete="off"
/>
<div id="searchRes">
  {#if ui.search.trim()}
    {#if !results.length}
      <div class="hint">No match. Try a simpler word, or use Text to let Claude estimate it.</div>
    {:else}
      <div class="results">
        {#each results as food (food.key)}
          <button type="button" data-act="pick" onclick={() => pickFood(food.key)}
            ><span
              >{food.name}{#if food.src === 'custom'}<span class="badge">mine</span>{/if}</span
            ><span class="num">{r0(food.per100.kcal)} kcal/100g</span></button
          >
        {/each}
      </div>
    {/if}
  {/if}
</div>
