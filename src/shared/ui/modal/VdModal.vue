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
    /** El cuerpo no hace scroll; el contenido interno se encarga. */
    lockBody?: boolean;
  }>(),
  {
    closeOnScrim: true,
    wide: false,
    xlarge: false,
    lockBody: false,
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

        <div
          class="vd-modal__body"
          :class="{ 'vd-modal__body--locked': lockBody }"
        >
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
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem
    max(0.75rem, env(safe-area-inset-bottom));
  overflow: hidden;
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
  max-height: calc(
    100dvh - 1.75rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)
  );
  display: flex;
  flex-direction: column;
  min-height: 0;
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
}

.vd-modal--xlarge .vd-modal__body {
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
}

.vd-modal__head {
  flex-shrink: 0;
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
  flex: 1 1 auto;
  min-height: 0;
  padding: 1.1rem 1.25rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.vd-modal__body--locked {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.vd-modal__footer {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
  padding: 0.9rem 1.25rem 1.15rem;
  border-top: 1px solid var(--vd-line);
  background: var(--vd-surface-2);
  flex-shrink: 0;
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

@media (max-width: 1024px) {
  .vd-modal-root {
    padding: max(0.65rem, env(safe-area-inset-top)) 0.65rem
      max(0.65rem, env(safe-area-inset-bottom));
  }

  .vd-modal--xlarge,
  .vd-modal--wide {
    width: 100%;
  }

  .vd-modal--xlarge .vd-modal__body {
    padding: 0.65rem 0.75rem;
  }

  .vd-modal__close {
    width: 44px;
    height: 44px;
  }

  .vd-modal__footer :deep(.btn) {
    min-height: 48px;
  }
}

@media (max-width: 600px) {
  .vd-modal {
    width: 100%;
    border-radius: 14px;
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
