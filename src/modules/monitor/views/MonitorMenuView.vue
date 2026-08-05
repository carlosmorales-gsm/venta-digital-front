<script setup lang="ts">
import { computed } from 'vue';
import { useAuthStore } from '../../auth/stores/auth.store';

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
      <p>
        {{ greeting }}. Usa el menú lateral para navegar según tus permisos
        <template v-if="auth.userType === 'ADMIN'"> (administrador)</template>.
      </p>
    </header>

    <div class="panel home-card">
      <strong>Venta Digital</strong>
      <span>Panel de monitoreo y administración.</span>
    </div>
  </section>
</template>

<style scoped>
.home-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-left: 3px solid var(--gsm-cafe);
}

.home-card strong {
  font-family: var(--font-display);
  color: var(--gsm-blue);
  font-size: 1.25rem;
}

.home-card span {
  color: var(--vd-muted);
  font-size: 0.95rem;
}
</style>
