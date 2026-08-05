import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const STORAGE_ACCESS = 'vd_access_token';
const STORAGE_REFRESH = 'vd_refresh_token';

/** Rutas públicas: no llevan Bearer ni disparan refresh en 401. */
const PUBLIC_AUTH_PATHS = [
  '/auth/monitor/login',
  '/auth/vendedor/solicitar-pin',
  '/auth/vendedor/verificar-pin',
  '/auth/refresh',
];

function isPublicAuthRequest(url?: string): boolean {
  if (!url) return false;
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

export function extractApiError(
  error: unknown,
  fallback = 'Ocurrió un error',
): string {
  const data = (error as AxiosError<any>)?.response?.data;
  const message = data?.message;

  if (Array.isArray(message)) {
    return message.join('. ');
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if ((error as AxiosError)?.code === 'ERR_NETWORK') {
    return 'No se pudo conectar con el API. ¿Está corriendo en el puerto 3022?';
  }
  return fallback;
}

export const tokenStorage = {
  getAccess: () => localStorage.getItem(STORAGE_ACCESS),
  getRefresh: () => localStorage.getItem(STORAGE_REFRESH),
  setTokens(access: string, refresh?: string | null) {
    localStorage.setItem(STORAGE_ACCESS, access);
    if (refresh) {
      localStorage.setItem(STORAGE_REFRESH, refresh);
    } else if (refresh === null) {
      localStorage.removeItem(STORAGE_REFRESH);
    }
  },
  clear() {
    localStorage.removeItem(STORAGE_ACCESS);
    localStorage.removeItem(STORAGE_REFRESH);
    localStorage.removeItem('vd_user');
    localStorage.removeItem('vd_expires_at');
  },
};

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

export const http = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (isPublicAuthRequest(config.url)) {
    return config;
  }

  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) {
    return null;
  }

  try {
    const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, {
      refreshToken,
    });
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('vd_user', JSON.stringify(data.user));
    localStorage.setItem('vd_expires_at', data.expiresAt);
    return data.accessToken as string;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // El login/PIN no deben intentar refresh: el 401 es credencial inválida.
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isPublicAuthRequest(original.url)
    ) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const newToken = await refreshing;
      refreshing = null;

      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      }
    }

    return Promise.reject(error);
  },
);
