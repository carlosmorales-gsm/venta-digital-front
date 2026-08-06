import { useDialogStore } from './dialog.store';
import type { AlertOptions, ConfirmOptions } from './dialog.types';

/**
 * API global para avisos y confirmaciones.
 * @example
 * const { alert, confirm } = useDialog()
 * await alert({ message: 'Guardado' })
 * const ok = await confirm({ message: '¿Eliminar?' })
 */
export function useDialog() {
  const store = useDialogStore();

  return {
    alert: (options: AlertOptions) => store.alert(options),
    confirm: (options: ConfirmOptions) => store.confirm(options),
  };
}
