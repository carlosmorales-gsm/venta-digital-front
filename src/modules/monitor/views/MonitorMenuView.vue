<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../auth/stores/auth.store';
import SalesDashboard from '../components/SalesDashboard.vue';

const auth = useAuthStore();

const greeting = computed(() => {
  const name = auth.user?.fullName?.split(' ')[0] || 'equipo';
  return `Hola, ${name}`;
});
</script>

<template>
  <section class="home">
    <header class="page-head">
      <h1>Inicio</h1>
      <p>{{ greeting }}. Indicadores de las ventas del periodo.</p>
    </header>

    <SalesDashboard />
  </section>
</template>
