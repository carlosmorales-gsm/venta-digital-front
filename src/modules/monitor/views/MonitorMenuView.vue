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
    description: 'Todas las ventas de los vendedores.',
    permission: 'ventas.ver',
    route: 'monitor-ventas',
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
    <header class="page-head">
      <h1>Inicio</h1>
      <p>
        Opciones según tus permisos
        <template v-if="auth.userType === 'ADMIN'"> (administrador)</template>.
      </p>
    </header>

    <div class="tiles">
      <button
        v-for="item in items"
        :key="item.title"
        type="button"
        class="panel tile"
        :class="{ clickable: Boolean(item.route) }"
        @click="openItem(item)"
      >
        <strong>{{ item.title }}</strong>
        <span>{{ item.description }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 0.85rem;
}

.tile {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  cursor: default;
  border-top: 3px solid transparent;
  transition: transform 0.15s ease, border-color 0.2s ease;
}

.tile strong {
  font-family: var(--font-display);
  color: var(--gsm-teal);
  font-size: 1.25rem;
}

.tile span {
  color: var(--vd-muted);
  font-size: 0.92rem;
}

.tile.clickable {
  cursor: pointer;
  border-top-color: var(--gsm-sand);
}

.tile.clickable:hover {
  transform: translateY(-2px);
}
</style>
