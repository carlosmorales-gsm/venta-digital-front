<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../auth/stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

interface MenuItem {
  title: string;
  description: string;
  permission?: string;
  route?: string;
}

const allItems: MenuItem[] = [
  {
    title: 'Panel',
    description: 'Resumen operativo del día.',
    permission: 'dashboard.ver',
  },
  {
    title: 'Ventas',
    description: 'Consulta de ventas del equipo.',
    permission: 'ventas.ver',
  },
  {
    title: 'Reportes',
    description: 'Reportes con horarios locales.',
    permission: 'reportes.ver',
  },
  {
    title: 'Usuarios',
    description: 'Alta de vendedores y monitores.',
    permission: 'usuarios.gestionar',
    route: 'admin-usuarios',
  },
];

const items = computed(() =>
  allItems.filter((item) => {
    if (item.permission && !auth.hasPermission(item.permission)) return false;
    return true;
  }),
);

function openItem(item: MenuItem) {
  if (item.route) router.push({ name: item.route });
}
</script>

<template>
  <section>
    <header class="page-header">
      <div>
        <h1>Menú</h1>
        <p>
          Opciones disponibles según tus permisos
          <template v-if="auth.userType === 'ADMIN'"> (administrador)</template>.
        </p>
      </div>
    </header>

    <div class="menu-grid">
      <button
        v-for="item in items"
        :key="item.title"
        type="button"
        class="card menu-item"
        :class="{ 'menu-item--active': Boolean(item.route) }"
        @click="openItem(item)"
      >
        <strong>{{ item.title }}</strong>
        <span>{{ item.description }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.menu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.85rem;
}

.menu-item {
  text-align: left;
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  transition: border-color 0.2s ease, transform 0.15s ease, background 0.2s ease;
  animation: rise 0.45s ease both;
  border-left: 4px solid transparent;
}

.menu-item strong {
  font-family: var(--font-display);
  color: var(--primary);
  font-size: 1.25rem;
}

.menu-item span {
  color: var(--muted);
  font-size: 0.92rem;
}

.menu-item--active {
  cursor: pointer;
  border-left-color: var(--accent);
}

.menu-item--active:hover {
  background: var(--cream-alt);
  transform: translateY(-2px);
}
</style>
