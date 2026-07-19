<script lang="ts">
  interface Props {
    role: string;
    facilityDid: string;
  }
  const { role, facilityDid }: Props = $props();
</script>

<div class="phi-banner">
  🔒 PHI 暗号化中 · {role} @ {facilityDid.replace('did:web:', '')}
</div>
