import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../modules/auth/stores/auth.store';
import { tokenStorage } from '../shared/api/http';

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
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const hasToken = Boolean(tokenStorage.getAccess());

  if (to.meta.guest) {
    if (hasToken && auth.user) {
      if (auth.userType === 'VENDEDOR') return { name: 'vendedor-ventas' };
      return { name: 'monitor-menu' };
    }
    return true;
  }

  const roles = (to.meta.roles as string[] | undefined) ?? [];
  if (roles.length) {
    if (!hasToken || !auth.user) {
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
