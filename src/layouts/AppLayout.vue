<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../modules/auth/stores/auth.store';

type NavIcon = 'inicio' | 'ventas' | 'usuarios' | 'bitacora' | 'reportes';

type NavItem = {
  to: string;
  label: string;
  hint: string;
  icon: NavIcon;
  roles?: Array<'VENDEDOR' | 'MONITOR' | 'ADMIN'>;
  permission?: string;
};

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const mobileOpen = ref(false);
const collapsed = ref(localStorage.getItem('vd.sidebarCollapsed') === '1');

/** Solo MONITOR/ADMIN tienen menú. El vendedor solo usa la barra superior. */
const allItems: NavItem[] = [
  {
    to: '/monitor',
    label: 'Inicio',
    hint: 'Panel principal',
    icon: 'inicio',
    roles: ['MONITOR', 'ADMIN'],
    permission: 'dashboard.ver',
  },
  {
    to: '/monitor/ventas',
    label: 'Ventas',
    hint: 'Ventas de vendedores',
    icon: 'ventas',
    roles: ['MONITOR', 'ADMIN'],
    permission: 'ventas.ver',
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    hint: 'Vendedores y monitores',
    icon: 'usuarios',
    roles: ['ADMIN'],
    permission: 'usuarios.gestionar',
  },
  {
    to: '/admin/bitacora',
    label: 'Bitácora',
    hint: 'Log de transacciones',
    icon: 'bitacora',
    roles: ['ADMIN'],
  },
];

const isSeller = computed(() => auth.userType === 'VENDEDOR');

const navItems = computed(() => {
  if (isSeller.value) return [];

  return allItems.filter((item) => {
    if (item.roles?.length && !item.roles.includes(auth.userType as any)) {
      return false;
    }
    if (item.permission && !auth.hasPermission(item.permission)) {
      return false;
    }
    return true;
  });
});

const showNav = computed(() => !isSeller.value && navItems.value.length > 0);

const roleLabel = computed(() => {
  if (auth.userType === 'VENDEDOR') return 'Vendedor';
  if (auth.userType === 'MONITOR') return 'Monitor';
  if (auth.userType === 'ADMIN') return 'Admin';
  return '';
});

const userInitial = computed(
  () => auth.user?.fullName?.charAt(0)?.toUpperCase() || 'U',
);

watch(
  () => route.path,
  () => {
    mobileOpen.value = false;
  },
);

watch(collapsed, (value) => {
  localStorage.setItem('vd.sidebarCollapsed', value ? '1' : '0');
});

async function logout() {
  await auth.logout();
  router.push({ name: 'home' });
}

function go(to: string) {
  mobileOpen.value = false;
  router.push(to);
}

function isActive(to: string) {
  if (to === '/monitor') return route.path === '/monitor';
  return route.path === to || route.path.startsWith(`${to}/`);
}

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    mobileOpen.value = !mobileOpen.value;
    return;
  }
  collapsed.value = !collapsed.value;
}
</script>

<template>
  <!-- Vendedor: solo barra superior -->
  <div v-if="isSeller" class="app app--seller">
    <header class="seller-bar">
      <div class="seller-bar__brand">
        <img src="/logo-sanmartin-white.svg" alt="San Martín" />
        <div class="seller-bar__titles">
          <strong>Venta Digital</strong>
          <small>{{ roleLabel }}</small>
        </div>
      </div>
      <div class="seller-bar__actions">
        <span class="user-name">{{ auth.user?.fullName }}</span>
        <button class="btn btn-sm btn-ghost logout-light" type="button" @click="logout">
          Salir
        </button>
      </div>
    </header>
    <main class="seller-main">
      <div class="content-inner">
        <slot />
      </div>
    </main>
  </div>

  <!-- Monitor / Admin: menú lateral -->
  <div v-else class="shell" :class="{ collapsed }">
    <aside class="sidebar" :class="{ open: mobileOpen, collapsed }">
      <div class="sidebar-brand">
        <div class="sidebar-brand__row">
          <img src="/logo-sanmartin-white.svg" alt="San Martín" />
          <button
            class="collapse-btn desktop-only"
            type="button"
            :title="collapsed ? 'Mostrar menú' : 'Ocultar menú'"
            @click="collapsed = !collapsed"
          >
            {{ collapsed ? '»' : '«' }}
          </button>
        </div>
        <div v-if="!collapsed" class="brand-text">
          <strong>Venta Digital</strong>
          <small>{{ roleLabel }}</small>
        </div>
      </div>

      <nav v-if="showNav">
        <p v-if="!collapsed" class="nav-label">Menú</p>
        <p v-else class="nav-label-dot" title="Menú">•</p>

        <button
          v-for="item in navItems"
          :key="item.to"
          type="button"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          :title="collapsed ? item.label : undefined"
          @click="go(item.to)"
        >
          <span class="nav-icon" aria-hidden="true">
            <svg v-if="item.icon === 'inicio'" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8" />
              <rect x="13" y="3" width="8" height="5" rx="1.5" stroke="currentColor" stroke-width="1.8" />
              <rect x="13" y="10" width="8" height="11" rx="1.5" stroke="currentColor" stroke-width="1.8" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.8" />
            </svg>
            <svg v-else-if="item.icon === 'ventas'" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 7h16l-1.2 11.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
              <path
                d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <svg v-else-if="item.icon === 'usuarios'" viewBox="0 0 24 24" fill="none">
              <circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8" />
              <path
                d="M3.5 19c.6-3.1 2.8-4.8 5.5-4.8S14 15.9 14.5 19"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
              <circle cx="17" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8" />
              <path
                d="M16 14.2c2 .3 3.4 1.5 3.9 3.8"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
            <svg v-else-if="item.icon === 'bitacora'" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 3.5h8.5L19 7v13.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linejoin="round"
              />
              <path d="M15 3.5V7h3.5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
              <path d="M9 12h6M9 15.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none">
              <path d="M4 19h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              <rect x="6" y="11" width="3" height="6" rx="1" fill="currentColor" />
              <rect x="10.5" y="7" width="3" height="10" rx="1" fill="currentColor" />
              <rect x="15" y="9" width="3" height="8" rx="1" fill="currentColor" />
            </svg>
          </span>

          <span v-if="!collapsed" class="nav-copy">
            <span class="nav-title">{{ item.label }}</span>
            <span class="nav-hint">{{ item.hint }}</span>
          </span>
        </button>
      </nav>

      <div v-if="!collapsed" class="sidebar-foot">
        <small>Grupo San Martín</small>
      </div>
    </aside>

    <div class="workspace">
      <div
        v-if="mobileOpen"
        class="scrim"
        aria-hidden="true"
        @click="mobileOpen = false"
      />

      <header class="topbar">
        <div class="topbar-left">
          <button class="menu-btn mobile-only" type="button" aria-label="Menú" @click="toggleSidebar">
            ☰
          </button>
        </div>
        <div class="topbar-right">
          <div class="user-chip">
            <span class="avatar">{{ userInitial }}</span>
            <div class="user-meta">
              <strong>{{ auth.user?.fullName }}</strong>
              <small>{{ roleLabel }}</small>
            </div>
          </div>
          <button class="btn btn-sm btn-ghost logout-dark" type="button" @click="logout">
            Salir
          </button>
        </div>
      </header>

      <main class="content">
        <div class="content-inner">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
/* —— Vendedor —— */
.app--seller {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.seller-bar {
  position: sticky;
  top: 0;
  z-index: 30;
  min-height: var(--vd-header);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: var(--gsm-blue);
  color: #fff;
  border-bottom: 3px solid var(--gsm-cafe);
  box-shadow: 0 6px 18px rgba(2, 53, 125, 0.16);
}

.seller-bar__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.seller-bar__brand img {
  height: 32px;
  width: auto;
}

.seller-bar__titles {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.seller-bar__titles strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--gsm-cafe);
}

.seller-bar__titles small {
  font-size: 0.75rem;
  opacity: 0.85;
}

.seller-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.seller-main {
  flex: 1;
  padding: 1.1rem 1.15rem 2rem;
}

/* —— Shell lateral —— */
.shell {
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  background: var(--vd-bg);
}

.sidebar {
  position: sticky;
  top: 0;
  flex: 0 0 268px;
  width: 268px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem 0.85rem;
  background: var(--gsm-blue);
  color: #fff;
  border-right: 3px solid var(--gsm-cafe);
  overflow: auto;
  transition: flex-basis 0.2s ease, width 0.2s ease;
  z-index: 30;
}

.shell.collapsed .sidebar {
  flex-basis: 84px;
  width: 84px;
}

.sidebar-brand {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.25rem 0.2rem 0.95rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
}

.sidebar-brand__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-brand img {
  height: 36px;
  width: auto;
  flex-shrink: 0;
}

.brand-text {
  min-width: 0;
  padding: 0 0.15rem;
}

.brand-text strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.35rem;
  color: var(--gsm-cafe);
  line-height: 1.25;
  white-space: nowrap;
  overflow: visible;
}

.brand-text small {
  display: block;
  margin-top: 0.15rem;
  opacity: 0.8;
  font-size: 0.75rem;
}

.collapse-btn {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: white;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  flex-shrink: 0;
}

.collapse-btn:hover {
  border-color: var(--gsm-cafe);
  color: var(--gsm-cafe);
}

.nav-label {
  margin: 0.35rem 0.55rem 0.45rem;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.55;
}

.nav-label-dot {
  margin: 0.35rem 0;
  text-align: center;
  opacity: 0.4;
}

nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0.2rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  padding: 0.72rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.nav-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  flex-shrink: 0;
  transition: background 0.18s ease, color 0.18s ease;
}

.nav-icon svg {
  width: 18px;
  height: 18px;
}

.nav-copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.nav-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.nav-hint {
  font-size: 0.72rem;
  opacity: 0.65;
}

.nav-item:hover {
  background: rgba(204, 160, 121, 0.16);
}

.nav-item.active {
  background: rgba(204, 160, 121, 0.24);
  color: #fff;
  box-shadow: inset 3px 0 0 var(--gsm-cafe);
}

.nav-item.active .nav-icon {
  background: rgba(204, 160, 121, 0.35);
  color: #fff;
}

.sidebar.collapsed .sidebar-brand__row {
  justify-content: center;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 0.7rem 0.4rem;
}

.sidebar-foot {
  padding: 0.65rem 0.55rem 0.2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  opacity: 0.75;
}

.sidebar-foot small {
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

.workspace {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 64px;
  padding: 0.7rem 1.5rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--vd-line);
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--gsm-cafe);
  color: #3d2c1f;
  font-weight: 700;
  flex-shrink: 0;
}

.user-meta strong,
.user-meta small {
  display: block;
  line-height: 1.2;
}

.user-meta strong {
  color: var(--vd-ink);
  font-size: 0.92rem;
}

.user-meta small {
  color: var(--vd-muted);
  font-size: 0.75rem;
}

.user-name {
  font-size: 0.88rem;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout-light {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
}

.logout-light:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--gsm-cafe);
  color: #fff;
}

.logout-dark {
  color: var(--gsm-blue);
  border-color: var(--vd-line);
}

.logout-dark:hover:not(:disabled) {
  border-color: var(--gsm-cafe);
  color: var(--gsm-blue);
  background: rgba(204, 160, 121, 0.1);
}

.menu-btn {
  border: 1px solid var(--vd-line);
  background: var(--gsm-white);
  color: var(--gsm-blue);
  border-radius: 8px;
  width: 42px;
  height: 42px;
  cursor: pointer;
  font-size: 1.05rem;
}

.mobile-only {
  display: none;
}

.desktop-only {
  display: inline-grid;
  place-items: center;
}

.content {
  flex: 1;
  padding: 1.25rem 1.5rem 2rem;
}

.content-inner {
  width: min(1080px, 100%);
  margin: 0 auto;
  animation: vd-enter 0.35s ease both;
}

.scrim {
  display: none;
}

@media (max-width: 900px) {
  .shell {
    display: block;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(280px, 86vw);
    flex-basis: auto;
    transform: translateX(-105%);
    transition: transform 0.22s ease;
    box-shadow: var(--vd-shadow);
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .shell.collapsed .sidebar {
    width: min(280px, 86vw);
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: inline-grid;
    place-items: center;
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(28, 42, 51, 0.4);
    z-index: 25;
  }

  .user-meta {
    display: none;
  }

  .content {
    padding: 0.9rem 1rem 1.5rem;
  }
}
</style>
