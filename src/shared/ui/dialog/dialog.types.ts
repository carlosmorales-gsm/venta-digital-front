export type DialogVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertOptions {
  title?: string;
  message: string;
  confirmText?: string;
  variant?: DialogVariant;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
}

export type DialogRequest =
  | {
      kind: 'alert';
      options: Required<Pick<AlertOptions, 'message'>> &
        Omit<AlertOptions, 'message'> & {
          title: string;
          confirmText: string;
          variant: DialogVariant;
        };
      resolve: () => void;
    }
  | {
      kind: 'confirm';
      options: Required<Pick<ConfirmOptions, 'message'>> &
        Omit<ConfirmOptions, 'message'> & {
          title: string;
          confirmText: string;
          cancelText: string;
          variant: DialogVariant;
        };
      resolve: (value: boolean) => void;
    };
