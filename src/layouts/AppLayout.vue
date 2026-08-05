<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../modules/auth/stores/auth.store';

type MenuItem = {
  to: string;
  label: string;
  hint: string;
  roles?: Array<'VENDEDOR' | 'MONITOR' | 'ADMIN'>;
  permission?: string;
};

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const mobileOpen = ref(false);
const collapsed = ref(localStorage.getItem('vd.sidebarCollapsed') === '1');

const allItems: MenuItem[] = [
  {
    to: '/vendedor/ventas',
    label: 'Mis ventas',
    hint: 'Ventas propias del día',
    roles: ['VENDEDOR'],
  },
  {
    to: '/monitor',
    label: 'Menú',
    hint: 'Panel principal',
    roles: ['MONITOR', 'ADMIN'],
    permission: 'dashboard.ver',
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    hint: 'Vendedores y monitores',
    roles: ['ADMIN'],
    permission: 'usuarios.gestionar',
  },
];

const menuItems = computed(() =>
  allItems.filter((item) => {
    if (item.roles?.length && !item.roles.includes(auth.userType as any)) {
      return false;
    }
    if (item.permission && !auth.hasPermission(item.permission)) {
      return false;
    }
    return true;
  }),
);

const roleLabel = computed(() => {
  if (auth.userType === 'VENDEDOR') return 'Vendedor';
  if (auth.userType === 'MONITOR') return 'Monitor';
  if (auth.userType === 'ADMIN') return 'Administrador';
  return 'Usuario';
});

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

function toggleSidebar() {
  if (window.matchMedia('(max-width: 900px)').matches) {
    mobileOpen.value = !mobileOpen.value;
    return;
  }
  collapsed.value = !collapsed.value;
}
</script>

<template>
  <div class="shell" :class="{ collapsed }">
    <aside class="sidebar" :class="{ open: mobileOpen, collapsed }">
      <div class="sidebar-brand">
        <img src="/logo-sanmartin-white.svg" alt="San Martín" />
        <div v-if="!collapsed" class="brand-text">
          <strong>Venta Digital</strong>
          <small>{{ roleLabel }}</small>
        </div>
        <button
          class="collapse-btn desktop-only"
          type="button"
          :title="collapsed ? 'Mostrar menú' : 'Ocultar menú'"
          @click="collapsed = !collapsed"
        >
          {{ collapsed ? '»' : '«' }}
        </button>
      </div>

      <nav>
        <div class="nav-section">
          <p v-if="!collapsed" class="nav-label">Navegación</p>
          <p v-else class="nav-label-dot" title="Navegación">•</p>
          <button
            v-for="item in menuItems"
            :key="item.to"
            type="button"
            class="nav-item"
            :class="{ active: route.path === item.to }"
            :title="collapsed ? item.label : undefined"
            @click="go(item.to)"
          >
            <span class="nav-initial">{{ item.label.charAt(0) }}</span>
            <span v-if="!collapsed" class="nav-copy">
              <span class="nav-title">{{ item.label }}</span>
              <span class="nav-hint">{{ item.hint }}</span>
            </span>
          </button>
        </div>
      </nav>
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
            <span class="avatar">{{ auth.user?.fullName?.charAt(0)?.toUpperCase() || 'U' }}</span>
            <div class="user-meta">
              <strong>{{ auth.user?.fullName }}</strong>
              <small>{{ roleLabel }}</small>
            </div>
          </div>
          <button class="btn btn-sm logout-btn" type="button" @click="logout">Salir</button>
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
.shell {
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  background: var(--cream);
}

.sidebar {
  position: sticky;
  top: 0;
  flex: 0 0 280px;
  width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 0.9rem;
  background: linear-gradient(180deg, var(--secondary) 0%, #1f3a4a 100%);
  color: white;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  overflow: auto;
  transition: flex-basis 0.2s ease, width 0.2s ease;
}

.shell.collapsed .sidebar {
  flex-basis: 84px;
  width: 84px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.25rem 0.2rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-brand img {
  height: 38px;
  width: auto;
  flex-shrink: 0;
}

.brand-text {
  flex: 1;
  min-width: 0;
}

.brand-text strong {
  display: block;
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--accent);
  line-height: 1.1;
}

.brand-text small {
  opacity: 0.75;
  font-size: 0.75rem;
}

.collapse-btn {
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: white;
  border-radius: 6px;
  width: 30px;
  height: 30px;
  cursor: pointer;
  flex-shrink: 0;
}

.collapse-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.nav-section {
  margin-bottom: 0.85rem;
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
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  color: #f6f6f7;
  padding: 0.7rem 0.75rem;
  border-radius: 10px;
  cursor: pointer;
  transition: 0.2s ease;
}

.nav-initial {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.08);
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
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
  background: rgba(204, 160, 121, 0.14);
}

.nav-item.active {
  background: rgba(204, 160, 121, 0.22);
  color: var(--accent);
  box-shadow: inset 3px 0 0 var(--accent);
}

.nav-item.active .nav-initial {
  background: rgba(204, 160, 121, 0.28);
}

.sidebar.collapsed .sidebar-brand {
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.sidebar.collapsed .nav-item {
  justify-content: center;
  padding: 0.7rem 0.4rem;
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
  min-height: 72px;
  padding: 0.85rem 2rem;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
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
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--secondary);
  font-weight: 700;
  flex-shrink: 0;
}

.user-meta strong,
.user-meta small {
  display: block;
  line-height: 1.2;
}

.user-meta strong {
  color: var(--ink);
  font-size: 0.92rem;
}

.user-meta small {
  color: var(--muted);
  font-size: 0.75rem;
}

.logout-btn {
  background: transparent;
  border: 1px solid var(--border-strong);
  color: var(--primary);
}

.logout-btn:hover {
  border-color: var(--accent);
  color: var(--secondary);
}

.menu-btn {
  border: 1px solid var(--border-strong);
  background: var(--white);
  color: var(--primary);
  border-radius: 8px;
  width: 42px;
  height: 42px;
  cursor: pointer;
  font-size: 1.05rem;
}

.mobile-only {
  display: none;
}

.content {
  flex: 1;
  padding: 1.75rem 2rem 2.5rem;
}

.content-inner {
  width: min(1280px, 100%);
  margin: 0 auto;
}

.scrim {
  display: none;
}

@media (max-width: 1100px) {
  .sidebar {
    flex-basis: 220px;
    width: 220px;
  }

  .content {
    padding: 1.25rem 1.25rem 2rem;
  }

  .topbar {
    padding: 0.75rem 1.25rem;
  }
}

@media (max-width: 900px) {
  .mobile-only {
    display: grid;
    place-items: center;
  }

  .desktop-only {
    display: none !important;
  }

  .user-meta {
    display: none;
  }

  .sidebar,
  .shell.collapsed .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    flex: none;
    width: min(300px, 88vw);
    height: 100vh;
    z-index: 40;
    transform: translateX(-105%);
    transition: transform 0.25s ease;
    padding: 1.25rem 0.9rem;
    padding-top: calc(1.25rem + env(safe-area-inset-top, 0px));
    padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
  }

  .sidebar.open {
    transform: translateX(0);
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(40, 75, 94, 0.4);
    z-index: 35;
  }

  .workspace {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
  }

  .content {
    padding: 1.35rem 1.25rem 1.75rem;
    padding-bottom: calc(1.75rem + env(safe-area-inset-bottom, 0px));
  }

  .content-inner {
    width: 100%;
    max-width: 100%;
  }

  .topbar {
    min-height: 68px;
    padding: 0.85rem 1.15rem;
    padding-top: calc(0.85rem + env(safe-area-inset-top, 0px));
  }

  .nav-item {
    min-height: 48px;
  }

  .menu-btn,
  .logout-btn {
    min-height: 44px;
  }
}

@media (max-width: 640px) {
  .content {
    padding: 1.2rem 1.1rem 1.6rem;
    padding-bottom: calc(1.6rem + env(safe-area-inset-bottom, 0px));
  }

  .topbar {
    padding-left: 1.1rem;
    padding-right: 1.1rem;
  }
}
</style>
