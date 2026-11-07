<!--
  "Your data": the log is saved in this browser only (until syncing is set
  up), so this is where a backup file is saved and restored. The backup
  exported from the original claude.ai app restores here too.
-->
<script lang="ts">
  import { APP_ID, db, type Backup } from '../lib/db';
  import { countDocs, downloadBackup, readBackupFile } from '../lib/db/backup';
  import { toast } from '../lib/ui/toast.svelte';

  let fileInput: HTMLInputElement;
  /** a backup read from a file, waiting for "Replace" */
  let pending = $state<Backup | null>(null);

  async function choose(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    try {
      pending = await readBackupFile(file, APP_ID);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function replace(): void {
    if (pending) {
      db.importAll(pending);
      pending = null;
      toast('Backup restored');
    }
  }
</script>

<h2>Your data</h2>
<section class="review" style="box-shadow:none">
  <p class="hint" style="margin-top:0">
    Your log, meals and foods are saved in this browser only. Save a backup now and then — and
    before clearing browser data.
  </p>
  {#if pending}
    <div class="err" data-confirm>
      Replace everything on this device with the backup from {new Date(
        pending.exportedAt,
      ).toLocaleString()} ({countDocs(pending)} items)?
    </div>
    <div class="row-actions">
      <button type="button" class="btn danger armed" data-replace onclick={replace}>Replace</button>
      <button type="button" class="btn" onclick={() => (pending = null)}>Cancel</button>
    </div>
  {:else}
    <div class="row-actions">
      <button type="button" class="btn" data-export onclick={() => downloadBackup(db, APP_ID)}
        >Save backup</button
      >
      <button type="button" class="btn" data-import onclick={() => fileInput.click()}
        >Restore backup…</button
      >
    </div>
  {/if}
  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.json"
    hidden
    onchange={choose}
  />
</section>
