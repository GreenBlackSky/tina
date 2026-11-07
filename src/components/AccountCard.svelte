<!--
  "Account", first on Targets: Google sign-in (optional). Today's corner
  button signs in too, and once signed in it leads here.
-->
<script lang="ts">
  import { account, signIn, signOut } from '../lib/account.svelte';
</script>

<h2>Account</h2>
<section class="review" style="box-shadow:none" id="accountCard">
  <div class="banner" style="margin-top:0" data-account={account.now.status}>
    {#if account.now.status === 'signed-in'}
      Signed in as <b>{account.now.email || account.now.name}</b>
    {:else if account.now.status === 'unavailable'}
      Sign-in isn't available right now — check the connection.
    {:else}
      Not signed in. Signing in with Google is optional; syncing between devices comes later.
    {/if}
  </div>
  <div class="row-actions">
    {#if account.now.status === 'signed-in'}
      <button type="button" class="btn" data-act="signout" disabled={account.busy} onclick={signOut}
        >Sign out</button
      >
    {:else}
      <button
        type="button"
        class="btn primary"
        data-act="signin"
        disabled={account.busy || account.now.status === 'loading'}
        onclick={signIn}>Sign in with Google</button
      >
    {/if}
  </div>
</section>
