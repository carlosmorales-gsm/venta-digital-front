<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

/** En desarrollo se precargan las credenciales del admin semilla. */
const username = ref(import.meta.env.DEV ? 'admin' : '');
const password = ref(import.meta.env.DEV ? 'AdminVd2026!' : '');
const showPassword = ref(false);
const localError = ref<string | null>(null);
const sessionExpired = computed(() => route.query.sesion === 'expirada');

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
  <div class="login-shell">
    <aside class="brand-panel">
      <img src="/logo-sanmartin-white.svg" alt="San Martín" class="logo-white" />
      <div class="brand-copy">
        <img src="/icons-palomasanmartin.svg" alt="" class="dove" />
        <h1>Venta Digital</h1>
        <p>Acceso para monitores y administradores</p>
      </div>
      <small>Grupo San Martín</small>
    </aside>

    <section class="form-panel">
      <form class="login-card" @submit.prevent="onSubmit">
        <img src="/logo-gsm-azul.svg" alt="GSM" class="logo-blue" />
        <h2>Iniciar sesión</h2>
        <p class="subtitle">Ingresa con tu usuario y contraseña</p>
        <p v-if="sessionExpired" class="session-note" role="status">
          Tu sesión expiró. Inicia sesión de nuevo.
        </p>

        <div class="field">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="usuario"
            required
          />
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <div class="password-row">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              placeholder="••••••••"
              required
            />
            <button class="toggle-pass" type="button" @click="showPassword = !showPassword">
              {{ showPassword ? 'Ocultar' : 'Ver' }}
            </button>
          </div>
        </div>

        <p v-if="localError" class="error-text" role="alert">{{ localError }}</p>

        <button class="btn btn-primary submit" type="submit" :disabled="auth.loading">
          <span v-if="auth.loading" class="spinner" />
          {{ auth.loading ? 'Entrando…' : 'Entrar' }}
        </button>

        <button class="btn btn-ghost back" type="button" @click="router.push({ name: 'home' })">
          Volver
        </button>
      </form>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  grid-template-columns: minmax(400px, 46%) minmax(0, 1fr);
}

.brand-panel {
  background: var(--gsm-blue);
  color: var(--gsm-white);
  padding: clamp(2.5rem, 5vw, 4.5rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-right: 3px solid var(--gsm-cafe);
}

.logo-white {
  width: min(180px, 60%);
}

.dove {
  width: 48px;
  margin-bottom: 1rem;
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.brand-copy h1 {
  color: var(--gsm-cafe);
  font-size: clamp(2.4rem, 5vw, 3.6rem);
  margin-bottom: 0.5rem;
}

.brand-copy p {
  margin: 0;
  max-width: 280px;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 300;
}

.brand-panel small {
  opacity: 0.7;
  letter-spacing: 0.04em;
}

.form-panel {
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 4rem);
  background: var(--vd-bg);
}

.login-card {
  width: min(460px, 100%);
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  background: var(--gsm-white);
  border: 1px solid rgba(53, 100, 125, 0.12);
  border-radius: 16px 8px 8px 8px;
  padding: 2.2rem 2rem;
  box-shadow: var(--vd-shadow);
  border-top: 3px solid var(--gsm-cafe);
}

.logo-blue {
  width: 120px;
  margin-bottom: 0.35rem;
}

.login-card h2 {
  font-size: 1.75rem;
  margin: 0;
  color: var(--gsm-blue);
}

.subtitle {
  margin: -0.35rem 0 0.35rem;
  color: var(--vd-muted);
  font-size: 0.95rem;
}

.session-note {
  margin: 0 0 0.35rem;
  padding: 0.55rem 0.7rem;
  border-radius: var(--vd-radius-sm, 8px);
  background: #fff4e5;
  color: #8a4b00;
  font-size: 0.88rem;
  font-weight: 600;
}

.password-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.toggle-pass {
  border: 1px solid var(--vd-line);
  background: var(--gsm-white);
  border-radius: var(--vd-radius-sm);
  padding: 0 0.85rem;
  color: var(--gsm-blue);
  cursor: pointer;
  font-weight: 500;
  min-height: 46px;
}

.toggle-pass:hover {
  border-color: var(--gsm-cafe);
  background: rgba(204, 160, 121, 0.1);
}

.submit,
.back {
  width: 100%;
}

.submit {
  margin-top: 0.25rem;
}

@media (max-width: 960px) {
  .login-shell {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    align-content: start;
  }

  .brand-panel {
    min-height: 0;
    padding: 1.25rem 1.35rem 1.5rem;
    gap: 0.85rem;
    justify-content: flex-start;
    border-right: 0;
    border-bottom: 3px solid var(--gsm-cafe);
  }

  .brand-panel small {
    display: none;
  }

  .logo-white {
    width: min(140px, 48%);
  }

  .dove {
    width: 36px;
    margin-bottom: 0.45rem;
  }

  .brand-copy h1 {
    font-size: clamp(1.75rem, 6.5vw, 2.1rem);
    margin-bottom: 0.25rem;
  }

  .brand-copy p {
    max-width: none;
    font-size: 0.95rem;
  }

  .form-panel {
    display: block;
    padding: 0 1.15rem 1.5rem;
    margin-top: -1.25rem;
    place-items: unset;
  }

  .login-card {
    width: 100%;
    border-radius: 14px 8px 8px 8px;
    padding: 1.5rem 1.25rem 1.35rem;
    margin: 0 auto;
  }

  .logo-blue {
    width: 100px;
  }

  .login-card h2 {
    font-size: 1.55rem;
  }
}

@media (max-width: 600px) {
  .brand-panel {
    padding: 1rem 1.1rem 1.25rem;
    gap: 0.65rem;
  }

  .form-panel {
    padding: 0 0.9rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    margin-top: -1rem;
  }

  .login-card {
    padding: 1.25rem 1.05rem 1.2rem;
  }

  .toggle-pass,
  .submit {
    min-height: 48px;
  }
}
</style>
