<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useDialogStore } from './dialog.store';

const dialog = useDialogStore();

const variantClass = computed(() => {
  const variant = dialog.current?.options.variant ?? 'info';
  return `vd-dialog--${variant}`;
});

function onKeydown(e: KeyboardEvent) {
  if (!dialog.open) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    dialog.dismiss();
  }
  if (e.key === 'Enter' && dialog.current?.kind === 'alert') {
    e.preventDefault();
    dialog.accept();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

watch(
  () => dialog.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
  },
);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="dialog.open && dialog.current"
      class="vd-dialog-root"
      role="presentation"
    >
      <div class="vd-dialog-scrim" @click="dialog.dismiss()" />

      <div
        class="vd-dialog panel"
        :class="variantClass"
        role="alertdialog"
        aria-modal="true"
        :aria-labelledby="'vd-dialog-title'"
        :aria-describedby="'vd-dialog-message'"
      >
        <header class="vd-dialog__head">
          <h2 id="vd-dialog-title">{{ dialog.current.options.title }}</h2>
        </header>

        <p id="vd-dialog-message" class="vd-dialog__message">
          {{ dialog.current.options.message }}
        </p>

        <footer class="vd-dialog__actions">
          <button
            v-if="dialog.current.kind === 'confirm'"
            type="button"
            class="btn btn-ghost"
            @click="dialog.dismiss()"
          >
            {{ dialog.current.options.cancelText }}
          </button>
          <button
            type="button"
            class="btn"
            :class="
              dialog.current.options.variant === 'danger'
                ? 'btn-danger'
                : 'btn-primary'
            "
            @click="dialog.accept()"
          >
            {{ dialog.current.options.confirmText }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.vd-dialog-root {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) 1rem
    max(0.75rem, env(safe-area-inset-bottom));
  overflow: hidden;
}

.vd-dialog-scrim {
  position: absolute;
  inset: 0;
  background: rgba(28, 42, 51, 0.45);
}

.vd-dialog {
  position: relative;
  z-index: 1;
  width: min(420px, 100%);
  max-height: calc(
    100dvh - 1.75rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)
  );
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 0.85rem;
  overflow: auto;
  overscroll-behavior: contain;
  border-top: 3px solid var(--gsm-cafe);
  animation: vd-dialog-in 0.2s ease both;
}

.vd-dialog--danger {
  border-top-color: var(--vd-danger);
}

.vd-dialog--success {
  border-top-color: var(--vd-ok);
}

.vd-dialog--warning {
  border-top-color: var(--gsm-cafe);
}

.vd-dialog--info {
  border-top-color: var(--gsm-blue);
}

.vd-dialog__head h2 {
  font-size: 1.35rem;
  color: var(--gsm-blue);
  margin: 0;
}

.vd-dialog--danger .vd-dialog__head h2 {
  color: var(--vd-danger);
}

.vd-dialog__message {
  margin: 0;
  color: var(--vd-muted);
  line-height: 1.45;
  font-size: 0.98rem;
}

.vd-dialog__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-top: 0.25rem;
}

.vd-dialog__actions .btn {
  min-width: 110px;
}

@keyframes vd-dialog-in {
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
  .vd-dialog__actions {
    flex-direction: column-reverse;
  }

  .vd-dialog__actions .btn {
    width: 100%;
    min-height: 48px;
  }
}
</style>
