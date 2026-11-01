<script lang="ts">
  import type { Agent } from '../sim/types';

  let { agent, size = 36 }: { agent: Agent; size?: number } = $props();
</script>

<!-- Mini avatar mirroring the 3D character. / Avatar mini giống nhân vật 3D. -->
<span class="avatar" style:width="{size}px" style:height="{size}px" style:background={agent.color}>
  <span class="avatar-hair" style:background={agent.hair}></span>
  <span class="avatar-face"><i></i><i></i></span>
</span>
