<!--
  Tina's eye: how much of the day's calories is eaten, as one of six fixed
  drawings. A yellow iris all day; the pupil is wide and round when she's
  hungry and narrows to a slit near the target. Over the target the upper
  lid comes down (drowsy), and well over she's asleep. No animation.
-->
<script lang="ts">
  import { eyeState } from '../lib/eye';

  const { fraction, label }: { fraction: number; label: string } = $props();

  const state = $derived(eyeState(fraction));
  const ALMOND = 'M6 36Q60 -12 114 36 60 84 6 36Z';
</script>

<svg class="eye" viewBox="0 0 120 72" role="img" aria-label={label} data-eye={state.id}>
  <defs>
    <clipPath id="eye-clip"><path d={ALMOND} /></clipPath>
  </defs>
  {#if state.id === 'asleep'}
    <path
      d="M8 36Q60 64 112 36"
      fill="none"
      stroke="var(--pupil)"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      d="M8 36Q60 64 112 36"
      fill="none"
      stroke="var(--over)"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <text x="98" y="20" font-size="13" fill="var(--muted)">z</text>
    <text x="106" y="11" font-size="10" fill="var(--muted)">z</text>
  {:else}
    <g clip-path="url(#eye-clip)">
      <rect width="120" height="72" fill="var(--accent)" />
      <ellipse cx="60" cy={state.lid ? 38 : 36} rx={state.pupil} ry="22" fill="var(--pupil)" />
      {#if state.glint}
        <circle cx={60 + state.pupil * 0.4} cy="27" r="3" fill="var(--ink)" opacity="0.65" />
      {/if}
      {#if state.lid}
        <path d="M0 0H120V36H114Q60 26 6 36H0Z" fill="var(--fur)" />
      {/if}
    </g>
    {#if state.lid}
      <path d="M6 36Q60 26 114 36" fill="none" stroke="var(--pupil)" stroke-width="3" />
      <path d="M6 36Q60 84 114 36" fill="none" stroke="var(--pupil)" stroke-width="2.5" />
    {:else}
      <path d={ALMOND} fill="none" stroke="var(--pupil)" stroke-width="2.5" />
    {/if}
  {/if}
</svg>
