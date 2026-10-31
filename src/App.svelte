<!--
  Tina: one screen at a time and the tab bar at the bottom, with the
  big camera button in the middle. Which screen shows is just ui.view.
-->
<script lang="ts">
  import { go, ui, type View } from './lib/state.svelte';
  import { toastState } from './lib/ui/toast.svelte';
  import AddScreen from './screens/AddScreen.svelte';
  import MealsScreen from './screens/MealsScreen.svelte';
  import SettingsScreen from './screens/SettingsScreen.svelte';
  import TodayScreen from './screens/TodayScreen.svelte';
  import WeekScreen from './screens/WeekScreen.svelte';

  const TABS: Array<{ id: View; label: string; icon: string; fab?: boolean }> = [
    { id: 'today', label: 'Today', icon: '<circle cx="12" cy="12" r="8"/>' },
    { id: 'meals', label: 'Meals', icon: '<path d="M6 4h12v16l-6-4-6 4z"/>' },
    {
      id: 'add',
      label: '',
      icon: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
      fab: true,
    },
    { id: 'week', label: 'Week', icon: '<path d="M5 20V10M10 20V5M15 20v-8M20 20v-5"/>' },
    {
      id: 'settings',
      label: 'Targets',
      icon: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    },
  ];
</script>

<div class="wrap">
  <main id="main">
    {#if ui.view === 'add'}<AddScreen />
    {:else if ui.view === 'meals'}<MealsScreen />
    {:else if ui.view === 'week'}<WeekScreen />
    {:else if ui.view === 'settings'}<SettingsScreen />
    {:else}<TodayScreen />
    {/if}
  </main>
</div>

<nav class="tabs" aria-label="Sections">
  <div class="in">
    {#each TABS as tab (tab.id)}
      <button
        type="button"
        data-tab={tab.id}
        class:fab={tab.fab}
        aria-label={tab.fab ? 'Add food' : undefined}
        aria-current={ui.view === tab.id ? 'page' : undefined}
        onclick={() => go(tab.id)}
        ><svg viewBox="0 0 24 24">{@html tab.icon}</svg>{tab.label}</button
      >
    {/each}
  </div>
</nav>
<div id="toast" class="toast" hidden={!toastState.visible}>{toastState.message}</div>
