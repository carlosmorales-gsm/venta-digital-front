<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <section class="access">
    <div class="access__hero">
      <img src="/logo-gsm-azul.svg" alt="Grupo San Martín" class="access__logo" />
      <h1>Venta Digital</h1>
      <p>Herramienta comercial para vendedores y monitores.</p>
    </div>

    <div class="access__panel panel">
      <h2>Entrar al sistema</h2>
      <p>Selecciona tu tipo de acceso.</p>

      <div class="access__actions">
        <button
          type="button"
          class="btn btn-primary"
          @click="router.push({ name: 'login-vendedor' })"
        >
          Vendedor (PIN WhatsApp)
        </button>
        <button
          type="button"
          class="btn btn-accent"
          @click="router.push({ name: 'login-monitor' })"
        >
          Monitor / Administrador
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.access {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem 1rem 2rem;
}

.access__hero {
  text-align: center;
  animation: vd-enter 0.4s ease both;
}

.access__logo {
  width: min(200px, 70vw);
  margin-bottom: 0.85rem;
}

.access__hero h1 {
  font-size: clamp(2.2rem, 6vw, 3.2rem);
  color: var(--gsm-blue);
  margin-bottom: 0.4rem;
}

.access__hero p {
  max-width: 26rem;
}

.access__panel {
  width: min(420px, 100%);
  text-align: center;
  animation: vd-enter 0.5s ease 0.05s both;
}

.access__panel h2 {
  font-size: 1.4rem;
  margin-bottom: 0.35rem;
}

.access__panel > p {
  margin-bottom: 1.15rem;
}

.access__actions {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.access__actions .btn {
  width: 100%;
}
</style>
