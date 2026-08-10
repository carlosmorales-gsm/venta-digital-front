import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../modules/auth/stores/auth.store';
import {
  redirectToLoginOnSessionExpired,
  tokenStorage,
} from '../shared/api/http';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../modules/auth/views/HomeLoginView.vue'),
      meta: { public: true, guest: true },
    },
    {
      path: '/login/vendedor',
      name: 'login-vendedor',
      component: () => import('../modules/auth/views/SellerLoginView.vue'),
      meta: { public: true, guest: true },
    },
    {
      path: '/login/monitor',
      name: 'login-monitor',
      component: () => import('../modules/auth/views/MonitorLoginView.vue'),
      meta: { public: true, guest: true },
    },
    {
      path: '/vendedor/ventas',
      name: 'vendedor-ventas',
      component: () => import('../modules/sales/views/SellerSalesView.vue'),
      meta: { roles: ['VENDEDOR'] },
    },
    {
      path: '/vendedor/ventas/nueva',
      name: 'vendedor-venta-nueva',
      component: () => import('../modules/sales/views/SellerSaleCaptureView.vue'),
      meta: { roles: ['VENDEDOR'] },
    },
    {
      path: '/vendedor/ventas/:id',
      name: 'vendedor-venta-editar',
      component: () => import('../modules/sales/views/SellerSaleCaptureView.vue'),
      meta: { roles: ['VENDEDOR'] },
    },
    {
      path: '/monitor',
      name: 'monitor-menu',
      component: () => import('../modules/monitor/views/MonitorMenuView.vue'),
      meta: { roles: ['MONITOR', 'ADMIN'] },
    },
    {
      path: '/monitor/ventas',
      name: 'monitor-ventas',
      component: () => import('../modules/sales/views/MonitorSalesView.vue'),
      meta: {
        roles: ['MONITOR', 'ADMIN'],
        permissions: ['ventas.ver'],
      },
    },
    {
      path: '/admin/usuarios',
      name: 'admin-usuarios',
      component: () => import('../modules/admin/views/AdminUsersView.vue'),
      meta: {
        roles: ['ADMIN'],
        permissions: ['usuarios.gestionar'],
      },
    },
    {
      path: '/admin/bitacora',
      name: 'admin-bitacora',
      component: () => import('../modules/audit/views/AdminAuditLogsView.vue'),
      meta: {
        roles: ['ADMIN'],
      },
    },
    {
      path: '/admin/configuracion',
      name: 'admin-configuracion',
      component: () => import('../modules/admin/views/AdminSettingsView.vue'),
      meta: {
        roles: ['ADMIN'],
      },
    },
    {
      path: '/admin/descuentos',
      name: 'admin-descuentos',
      component: () => import('../modules/admin/views/AdminDiscountsView.vue'),
      meta: {
        roles: ['ADMIN'],
      },
    },
  ],
});

function sessionExpired(): boolean {
  const expiresAt = localStorage.getItem('vd_expires_at');
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts <= Date.now();
}

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const hasToken = Boolean(tokenStorage.getAccess());

  if (!to.meta.guest && hasToken && sessionExpired()) {
    await redirectToLoginOnSessionExpired();
    return false;
  }

  if (to.meta.guest) {
    if (hasToken && auth.user && !sessionExpired()) {
      if (auth.userType === 'VENDEDOR') return { name: 'vendedor-ventas' };
      return { name: 'monitor-menu' };
    }
    return true;
  }

  const roles = (to.meta.roles as string[] | undefined) ?? [];
  if (roles.length) {
    if (!hasToken || !auth.user) {
      if (to.path.startsWith('/vendedor')) {
        return { name: 'login-vendedor' };
      }
      if (to.path.startsWith('/monitor') || to.path.startsWith('/admin')) {
        return { name: 'login-monitor' };
      }
      return { name: 'home' };
    }
    if (!roles.includes(auth.user.type)) {
      return { name: 'home' };
    }
  }

  const permissions = (to.meta.permissions as string[] | undefined) ?? [];
  if (permissions.length && !permissions.every((p) => auth.hasPermission(p))) {
    return { name: 'monitor-menu' };
  }

  return true;
});

export default router;
