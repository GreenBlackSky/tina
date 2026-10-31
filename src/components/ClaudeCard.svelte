<!--
  Claude for photo and text estimates: the API key (kept on this device
  only) and which model to use. Without a key, Search still works.
-->
<script lang="ts">
  import {
    DEFAULT_MODEL,
    maskKey,
    MODELS,
    saveClaudeSettings,
    savedKey,
    savedModel,
  } from '../lib/estimate';
  import { ui } from '../lib/state.svelte';
  import { toast } from '../lib/ui/toast.svelte';

  const KEYS_PAGE = 'https://platform.claude.com/settings/keys';

  let current = $state(savedKey());
  let keyInput = $state('');
  let model = $state(savedModel());

  function save(): void {
    const key = keyInput.trim() || current;
    if (!key) {
      toast('Paste an API key first.');
      return;
    }
    saveClaudeSettings(key, model);
    current = key;
    keyInput = '';
    ui.estimatorVersion++;
    toast('Claude is set up on this device');
  }

  function remove(): void {
    saveClaudeSettings('', DEFAULT_MODEL);
    current = '';
    keyInput = '';
    model = DEFAULT_MODEL;
    ui.estimatorVersion++;
    toast('Key removed from this device');
  }
</script>

<h2>Claude</h2>
<section class="review" style="box-shadow:none" id="claudeCard">
  <p class="hint" style="margin-top:0">
    Photo, label and text estimates use Claude through the Anthropic API, with your own API key
    (create one at <a href={KEYS_PAGE} target="_blank" rel="noreferrer">platform.claude.com</a>).
    Usage is billed to that account, separately from a Claude subscription — set a monthly spend
    limit there. The key is kept in this browser only: not in backups, not synced. Anyone who can
    use this browser could find it, so don't set it on a shared device.
  </p>
  <div class="banner num" data-claude-status>
    {#if current}
      Key saved: <b>{maskKey(current)}</b>
    {:else}
      No key on this device — estimates are off; Search still works.
    {/if}
  </div>
  <label class="fl" for="claudeKey">{current ? 'Replace the key' : 'API key'}</label>
  <input
    type="password"
    id="claudeKey"
    autocomplete="off"
    placeholder="sk-ant-…"
    bind:value={keyInput}
  />
  <label class="fl" for="claudeModel">Model</label>
  <select id="claudeModel" bind:value={model}>
    {#each MODELS as option (option.id)}<option value={option.id}>{option.label}</option>{/each}
  </select>
  <div class="row-actions">
    <button type="button" class="btn primary" data-act="saveclaude" onclick={save}>Save</button>
    {#if current}
      <button type="button" class="btn danger" data-act="removeclaude" onclick={remove}
        >Remove key</button
      >
    {/if}
  </div>
</section>
