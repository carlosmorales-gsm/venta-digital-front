<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    /** Cerrar al hacer clic en el fondo */
    closeOnScrim?: boolean;
    wide?: boolean;
    /** Modal extra ancho (p. ej. vista previa PDF) */
    xlarge?: boolean;
  }>(),
  {
    closeOnScrim: true,
    wide: false,
    xlarge: false,
  },
);

const emit = defineEmits<{
  close: [];
}>();

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
);

function onScrim() {
  if (props.closeOnScrim) emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="vd-modal-root" role="presentation">
      <div class="vd-modal-scrim" @click="onScrim" />

      <div
        class="vd-modal panel"
        :class="{
          'vd-modal--wide': wide && !xlarge,
          'vd-modal--xlarge': xlarge,
        }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'vd-modal-title'"
      >
        <header class="vd-modal__head">
          <h2 id="vd-modal-title">{{ title }}</h2>
          <button
            type="button"
            class="vd-modal__close"
            aria-label="Cerrar"
            @click="emit('close')"
          >
            ×
          </button>
        </header>

        <div class="vd-modal__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="vd-modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vd-modal-root {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.vd-modal-scrim {
  position: absolute;
  inset: 0;
  background: rgba(28, 42, 51, 0.45);
}

.vd-modal {
  position: relative;
  z-index: 1;
  width: min(440px, 100%);
  max-height: min(90vh, 720px);
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border-top: 3px solid var(--gsm-cafe);
  overflow: hidden;
  animation: vd-modal-in 0.2s ease both;
}

.vd-modal--wide {
  width: min(560px, 100%);
}

.vd-modal--xlarge {
  width: min(820px, 100%);
  max-height: min(94vh, 900px);
}

.vd-modal--xlarge .vd-modal__body {
  padding: 0.75rem 0.85rem;
}

.vd-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.1rem 1.25rem 0.85rem;
  border-bottom: 1px solid var(--vd-line);
}

.vd-modal__head h2 {
  margin: 0;
  font-size: 1.35rem;
  color: var(--gsm-blue);
  line-height: 1.2;
}

.vd-modal__close {
  border: 0;
  background: transparent;
  color: var(--vd-muted);
  font-size: 1.6rem;
  line-height: 1;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}

.vd-modal__close:hover {
  background: rgba(53, 100, 125, 0.08);
  color: var(--gsm-blue);
}

.vd-modal__body {
  padding: 1.1rem 1.25rem;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.vd-modal__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
  padding: 0.9rem 1.25rem 1.15rem;
  border-top: 1px solid var(--vd-line);
  background: var(--vd-surface-2);
}

@keyframes vd-modal-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 600px) {
  .vd-modal-root {
    padding: 0.65rem;
    align-items: flex-end;
  }

  .vd-modal {
    width: 100%;
    max-height: 92vh;
    border-radius: 14px 14px 8px 8px;
  }

  .vd-modal__footer {
    flex-direction: column-reverse;
  }

  .vd-modal__footer :deep(.btn) {
    width: 100%;
    min-height: 48px;
  }
}
</style>
