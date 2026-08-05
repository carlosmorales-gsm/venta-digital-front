<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../modules/auth/stores/auth.store';

type NavItem = {
  to: string;
  label: string;
  roles?: Array<'VENDEDOR' | 'MONITOR' | 'ADMIN'>;
  permission?: string;
};

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const menuOpen = ref(false);

/** Solo MONITOR/ADMIN tienen menú. El vendedor solo usa la barra superior. */
const allItems: NavItem[] = [
  {
    to: '/monitor',
    label: 'Inicio',
    roles: ['MONITOR', 'ADMIN'],
    permission: 'dashboard.ver',
  },
  {
    to: '/monitor/ventas',
    label: 'Ventas',
    roles: ['MONITOR', 'ADMIN'],
    permission: 'ventas.ver',
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    roles: ['ADMIN'],
    permission: 'usuarios.gestionar',
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

async function logout() {
  await auth.logout();
  router.push({ name: 'home' });
}

function go(to: string) {
  menuOpen.value = false;
  router.push(to);
}
</script>

<template>
  <div class="app">
    <header class="top">
      <div class="top__brand">
        <img src="/logo-sanmartin-white.svg" alt="San Martín" />
        <div class="top__titles">
          <strong>Venta Digital</strong>
          <small>{{ roleLabel }}</small>
        </div>
      </div>

      <nav v-if="showNav" class="top__nav desktop">
        <button
          v-for="item in navItems"
          :key="item.to"
          type="button"
          class="nav-link"
          :class="{ active: route.path === item.to }"
          @click="go(item.to)"
        >
          {{ item.label }}
        </button>
      </nav>

      <div class="top__actions">
        <span class="user-name" :class="{ 'user-name--always': isSeller }">
          {{ auth.user?.fullName }}
        </span>
        <button class="btn btn-sm btn-ghost logout" type="button" @click="logout">
          Salir
        </button>
        <button
          v-if="showNav"
          class="burger mobile"
          type="button"
          aria-label="Menú"
          @click="menuOpen = !menuOpen"
        >
          ☰
        </button>
      </div>
    </header>

    <template v-if="showNav">
      <div v-if="menuOpen" class="drawer-scrim mobile" @click="menuOpen = false" />
      <aside class="drawer mobile" :class="{ open: menuOpen }">
        <p class="drawer__label">Menú</p>
        <button
          v-for="item in navItems"
          :key="`m-${item.to}`"
          type="button"
          class="drawer__link"
          :class="{ active: route.path === item.to }"
          @click="go(item.to)"
        >
          {{ item.label }}
        </button>
      </aside>
    </template>

    <main class="main">
      <div class="main__inner">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.top {
  position: sticky;
  top: 0;
  z-index: 30;
  min-height: var(--vd-header);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(90deg, var(--gsm-teal-deep), var(--gsm-teal));
  color: #fff;
  box-shadow: 0 6px 18px rgba(28, 42, 51, 0.18);
}

.top__brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.top__brand img {
  height: 32px;
  width: auto;
}

.top__titles {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.top__titles strong {
  font-family: var(--font-display);
  font-size: 1.15rem;
  color: var(--gsm-sand);
}

.top__titles small {
  font-size: 0.75rem;
  opacity: 0.85;
}

.top__nav {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.nav-link {
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  border-radius: 999px;
  padding: 0.45rem 0.95rem;
  cursor: pointer;
  font-weight: 500;
}

.nav-link:hover,
.nav-link.active {
  background: rgba(204, 160, 121, 0.22);
  color: #fff;
}

.top__actions {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.user-name {
  font-size: 0.88rem;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.logout {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
}

.logout:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--gsm-sand);
  color: #fff;
}

.burger {
  display: none;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: transparent;
  color: #fff;
  cursor: pointer;
}

.main {
  flex: 1;
  padding: 1.1rem 1.15rem 2rem;
}

.main__inner {
  width: min(1080px, 100%);
  margin: 0 auto;
  animation: vd-enter 0.35s ease both;
}

.drawer,
.drawer-scrim {
  display: none;
}

@media (max-width: 900px) {
  .main {
    padding: 0.85rem 1rem 1.5rem;
  }

  .desktop {
    display: none !important;
  }

  .user-name:not(.user-name--always) {
    display: none;
  }

  .burger.mobile {
    display: grid;
    place-items: center;
  }

  .drawer-scrim.mobile {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(28, 42, 51, 0.4);
    z-index: 40;
  }

  .drawer.mobile {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(280px, 86vw);
    z-index: 45;
    padding: 1.25rem;
    background: var(--vd-surface);
    transform: translateX(105%);
    transition: transform 0.22s ease;
    box-shadow: var(--vd-shadow);
  }

  .drawer.open {
    transform: translateX(0);
  }

  .drawer__label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--vd-muted);
    margin-bottom: 0.5rem;
  }

  .drawer__link {
    border: 0;
    text-align: left;
    background: transparent;
    color: var(--gsm-teal-deep);
    border-radius: 10px;
    padding: 0.85rem 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .drawer__link.active,
  .drawer__link:hover {
    background: rgba(204, 160, 121, 0.18);
  }
}
</style>
