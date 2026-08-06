import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  AlertOptions,
  ConfirmOptions,
  DialogRequest,
  DialogVariant,
} from './dialog.types';

function defaultsAlert(options: AlertOptions) {
  return {
    title: options.title ?? 'Aviso',
    message: options.message,
    confirmText: options.confirmText ?? 'Aceptar',
    variant: (options.variant ?? 'info') as DialogVariant,
  };
}

function defaultsConfirm(options: ConfirmOptions) {
  return {
    title: options.title ?? 'Confirmar',
    message: options.message,
    confirmText: options.confirmText ?? 'Confirmar',
    cancelText: options.cancelText ?? 'Cancelar',
    variant: (options.variant ?? 'warning') as DialogVariant,
  };
}

/**
 * Cola global de diálogos.
 * Prohibido usar window.alert / window.confirm: usar este store vía useDialog().
 */
export const useDialogStore = defineStore('vd-dialog', () => {
  const queue = ref<DialogRequest[]>([]);

  const current = computed(() => queue.value[0] ?? null);
  const open = computed(() => queue.value.length > 0);

  function alert(options: AlertOptions): Promise<void> {
    return new Promise((resolve) => {
      queue.value.push({
        kind: 'alert',
        options: defaultsAlert(options),
        resolve,
      });
    });
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      queue.value.push({
        kind: 'confirm',
        options: defaultsConfirm(options),
        resolve,
      });
    });
  }

  function accept() {
    const item = queue.value[0];
    if (!item) return;
    queue.value.shift();
    if (item.kind === 'alert') item.resolve();
    else item.resolve(true);
  }

  function dismiss() {
    const item = queue.value[0];
    if (!item) return;
    queue.value.shift();
    if (item.kind === 'alert') item.resolve();
    else item.resolve(false);
  }

  return { queue, current, open, alert, confirm, accept, dismiss };
});
