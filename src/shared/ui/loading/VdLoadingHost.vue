<script setup lang="ts">
import { watch } from 'vue';
import { httpLoadingVisible } from '../../api/http-loading';

watch(httpLoadingVisible, (open) => {
  document.body.style.overflow = open ? 'hidden' : '';
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="httpLoadingVisible"
      class="vd-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div class="vd-loading__panel">
        <span class="spinner vd-loading__spinner" />
        <span class="vd-loading__text">Cargando…</span>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vd-loading {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: grid;
  place-items: center;
  background: rgba(28, 42, 51, 0.42);
  touch-action: none;
}

.vd-loading__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  min-width: 9rem;
  padding: 1.25rem 1.5rem;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 12px 40px rgba(28, 42, 51, 0.18);
}

.vd-loading__spinner {
  width: 28px;
  height: 28px;
  border-width: 3px;
}

.vd-loading__text {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--gsm-blue, #35647d);
}
</style>
