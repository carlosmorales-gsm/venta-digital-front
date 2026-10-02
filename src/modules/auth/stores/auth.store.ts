import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { extractApiError, http, tokenStorage } from '../../../shared/api/http';
import {
  clearSellerPrefetch,
  prefetchSellerSession,
} from '../../sales/utils/seller-session-cache';
import type {
  AuthTokensResponse,
  SessionUser,
  UserType,
} from '../../../shared/types/auth';

function readStoredUser(): SessionUser | null {
  const raw = localStorage.getItem('vd_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(readStoredUser());
  const expiresAt = ref<string | null>(localStorage.getItem('vd_expires_at'));
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => Boolean(tokenStorage.getAccess() && user.value));
  const userType = computed<UserType | null>(() => user.value?.type ?? null);
  const permissions = computed(() => user.value?.permissions ?? []);

  const STORAGE_ADMIN_BACKUP = 'vd_admin_session_backup';
  const impersonating = ref(
    Boolean(
      typeof localStorage !== 'undefined' &&
        localStorage.getItem(STORAGE_ADMIN_BACKUP),
    ) && readStoredUser()?.type === 'VENDEDOR',
  );
  const isImpersonating = computed(
    () => impersonating.value && user.value?.type === 'VENDEDOR',
  );

  function persistSession(data: AuthTokensResponse) {
    tokenStorage.setTokens(data.accessToken, data.refreshToken ?? null);
    localStorage.setItem('vd_user', JSON.stringify(data.user));
    localStorage.setItem('vd_expires_at', data.expiresAt);
    user.value = data.user;
    expiresAt.value = data.expiresAt;
  }

  function readAdminBackup(): AuthTokensResponse | null {
    const raw = localStorage.getItem(STORAGE_ADMIN_BACKUP);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthTokensResponse;
    } catch {
      return null;
    }
  }

  function writeAdminBackup(data: AuthTokensResponse) {
    localStorage.setItem(STORAGE_ADMIN_BACKUP, JSON.stringify(data));
    impersonating.value = true;
  }

  function dropAdminBackup() {
    localStorage.removeItem(STORAGE_ADMIN_BACKUP);
    impersonating.value = false;
  }

  function snapshotCurrentSession(): AuthTokensResponse | null {
    const accessToken = tokenStorage.getAccess();
    const currentUser = user.value;
    if (!accessToken || !currentUser) return null;
    return {
      accessToken,
      refreshToken: tokenStorage.getRefresh() ?? undefined,
      expiresAt: expiresAt.value ?? new Date().toISOString(),
      user: currentUser,
    };
  }

  async function enterAsSeller(sellerId: number) {
    if (isImpersonating.value) {
      throw new Error('Ya estás trabajando como un vendedor');
    }
    const backup = snapshotCurrentSession();
    if (!backup || backup.user.type !== 'ADMIN') {
      throw new Error('Solo un administrador puede entrar como vendedor');
    }

    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<AuthTokensResponse>(
        '/auth/admin/entrar-vendedor',
        { sellerId },
      );
      writeAdminBackup(backup);
      persistSession(data);
      if (data.user.type === 'VENDEDOR') {
        void prefetchSellerSession(data.user.id).catch(() => undefined);
      }
      return data;
    } catch (e: unknown) {
      error.value = extractApiError(e, 'No se pudo entrar como vendedor');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Restaura la sesión de admin (renueva el access con el refresh guardado). */
  async function restoreAdminSession(): Promise<boolean> {
    const backup = readAdminBackup();
    if (!backup?.user || (!backup.accessToken && !backup.refreshToken)) {
      return false;
    }

    clearSellerPrefetch();

    if (backup.refreshToken) {
      try {
        const { data } = await http.post<AuthTokensResponse>(
          '/auth/refresh',
          { refreshToken: backup.refreshToken },
          { skipGlobalLoading: true },
        );
        dropAdminBackup();
        persistSession(data);
        return true;
      } catch {
        /* el access del backup puede seguir vigente */
      }
    }

    if (!backup.accessToken) {
      dropAdminBackup();
      return false;
    }

    dropAdminBackup();
    persistSession(backup);
    return true;
  }

  async function loginSellerDev(cellphone: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<AuthTokensResponse>(
        '/auth/vendedor/login-dev',
        { cellphone },
      );
      dropAdminBackup();
      persistSession(data);
      if (data.user.type === 'VENDEDOR') {
        void prefetchSellerSession(data.user.id).catch(() => undefined);
      }
      return data;
    } catch (e: unknown) {
      error.value = extractApiError(e, 'No se pudo iniciar sesión');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function requestSellerPin(cellphone: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post('/auth/vendedor/solicitar-pin', {
        cellphone,
      });
      return data as { nipId: number | null; message: string };
    } catch (e: unknown) {
      error.value = extractApiError(e, 'No se pudo solicitar el PIN');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function verifySellerPin(payload: {
    nipId: number;
    nip: string;
    cellphone: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<AuthTokensResponse>(
        '/auth/vendedor/verificar-pin',
        payload,
      );
      dropAdminBackup();
      persistSession(data);
      if (data.user.type === 'VENDEDOR') {
        void prefetchSellerSession(data.user.id).catch(() => undefined);
      }
      return data;
    } catch (e: unknown) {
      error.value = extractApiError(e, 'PIN inválido');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loginMonitor(username: string, password: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<AuthTokensResponse>(
        '/auth/monitor/login',
        { username, password },
      );
      dropAdminBackup();
      persistSession(data);
      return data;
    } catch (e: unknown) {
      error.value = extractApiError(e, 'Credenciales inválidas');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Limpia sesión local sin llamar al API (token vencido / refresh fallido). */
  function clearSession() {
    dropAdminBackup();
    tokenStorage.clear();
    clearSellerPrefetch();
    user.value = null;
    expiresAt.value = null;
    error.value = null;
  }

  async function logout() {
    const refreshToken =
      tokenStorage.getRefresh() ?? readAdminBackup()?.refreshToken ?? null;
    try {
      await http.post('/auth/logout', { refreshToken });
    } catch {
      // ignore network errors on logout
    }
    clearSession();
  }

  function hasPermission(code: string) {
    if (user.value?.type === 'ADMIN') return true;
    return permissions.value.includes(code);
  }

  async function changeOwnPassword(currentPassword: string, newPassword: string) {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<{
        message: string;
        user: SessionUser;
      }>('/auth/cambiar-password', { currentPassword, newPassword });
      if (data?.user) {
        user.value = { ...(user.value ?? data.user), ...data.user };
        localStorage.setItem('vd_user', JSON.stringify(user.value));
      }
      return data;
    } catch (e: unknown) {
      error.value = extractApiError(e, 'No se pudo cambiar la contraseña');
      throw e;
    } finally {
      loading.value = false;
    }
  }

  /** Actualiza el usuario en sesión (p. ej. jefe de ventas del catálogo). */
  async function refreshMe() {
    if (!tokenStorage.getAccess()) return null;
    try {
      const { data } = await http.get<SessionUser>('/auth/me');
      if (!data?.id) return user.value;
      user.value = { ...(user.value ?? data), ...data };
      localStorage.setItem('vd_user', JSON.stringify(user.value));
      return user.value;
    } catch {
      return user.value;
    }
  }

  return {
    user,
    expiresAt,
    loading,
    error,
    isAuthenticated,
    userType,
    permissions,
    isImpersonating,
    enterAsSeller,
    restoreAdminSession,
    requestSellerPin,
    loginSellerDev,
    verifySellerPin,
    loginMonitor,
    changeOwnPassword,
    logout,
    clearSession,
    hasPermission,
    refreshMe,
  };
});
