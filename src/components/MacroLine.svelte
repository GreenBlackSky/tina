<!-- "32g protein  48g carbs  12g fat" -->
<script lang="ts">
  import { r0 } from '../lib/nutrition';
  import type { Per100 } from '../lib/types';

  const { values }: { values: Per100 } = $props();
</script>

<span class="macros num"
  ><span><b>{r0(values.p)}</b>g protein</span><span><b>{r0(values.c)}</b>g carbs</span><span
    ><b>{r0(values.f)}</b>g fat</span
  ></span
>
