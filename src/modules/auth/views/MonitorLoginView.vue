<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

/** En desarrollo se precargan las credenciales del admin semilla. */
const username = ref(import.meta.env.DEV ? 'admin' : '');
const password = ref(import.meta.env.DEV ? 'AdminVd2026!' : '');
const showPassword = ref(false);
const localError = ref<string | null>(null);

async function onSubmit() {
  localError.value = null;
  try {
    await auth.loginMonitor(username.value.trim(), password.value);
    router.replace({ name: 'monitor-menu' });
  } catch {
    localError.value = auth.error || 'No se pudo iniciar sesión';
  }
}
</script>

<template>
  <section class="access">
    <div class="access__hero">
      <img src="/logo-gsm-azul.svg" alt="Grupo San Martín" class="access__logo" />
      <h1>Venta Digital</h1>
      <p>Acceso monitor y administrador</p>
    </div>

    <form class="panel access__panel" @submit.prevent="onSubmit">
      <h2>Iniciar sesión</h2>

      <div class="field">
        <label for="username">Usuario</label>
        <input
          id="username"
          v-model="username"
          type="text"
          autocomplete="username"
          required
        />
      </div>

      <div class="field">
        <label for="password">Contraseña</label>
        <div class="pass-row">
          <input
            id="password"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button class="btn btn-ghost btn-sm" type="button" @click="showPassword = !showPassword">
            {{ showPassword ? 'Ocultar' : 'Ver' }}
          </button>
        </div>
      </div>

      <p v-if="localError" class="error-text">{{ localError }}</p>

      <button class="btn btn-primary" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading" class="spinner" />
        {{ auth.loading ? 'Entrando…' : 'Entrar' }}
      </button>
      <button class="btn btn-ghost" type="button" @click="router.push({ name: 'home' })">
        Volver
      </button>
    </form>
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
  gap: 1rem;
  padding: 1.5rem 1rem 2rem;
}

.access__hero {
  text-align: center;
  animation: vd-enter 0.4s ease both;
}

.access__logo {
  width: min(170px, 65vw);
  margin-bottom: 0.65rem;
}

.access__hero h1 {
  font-size: clamp(2rem, 5vw, 2.7rem);
  color: var(--gsm-teal);
}

.access__panel {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: vd-enter 0.5s ease 0.05s both;
}

.access__panel h2 {
  font-size: 1.35rem;
}

.pass-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.access__panel .btn {
  width: 100%;
}
</style>
