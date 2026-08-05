<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

const username = ref('');
const password = ref('');
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

        <div class="field">
          <label for="username">Usuario</label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            placeholder="admin"
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
  display: grid;
  grid-template-columns: minmax(420px, 46%) minmax(0, 1fr);
}

.brand-panel {
  background: linear-gradient(165deg, var(--primary) 0%, var(--secondary) 100%);
  color: var(--white);
  padding: clamp(2.5rem, 5vw, 4.5rem);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.brand-panel::after {
  content: '';
  position: absolute;
  inset: auto -20% -30% 40%;
  height: 60%;
  background: radial-gradient(circle, rgba(204, 160, 121, 0.28), transparent 65%);
  pointer-events: none;
}

.logo-white {
  width: min(180px, 60%);
  position: relative;
  z-index: 1;
  animation: rise 0.6s ease both;
}

.brand-copy {
  position: relative;
  z-index: 1;
  animation: rise 0.7s ease 0.05s both;
}

.dove {
  width: 48px;
  margin-bottom: 1rem;
  filter: brightness(0) invert(1);
  opacity: 0.9;
}

.brand-copy h1 {
  color: var(--accent);
  font-size: clamp(2.5rem, 5vw, 3.75rem);
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
  position: relative;
  z-index: 1;
  opacity: 0.7;
  letter-spacing: 0.04em;
}

.form-panel {
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 4rem);
  background:
    radial-gradient(circle at top right, rgba(204, 160, 121, 0.18), transparent 35%),
    var(--cream);
}

.login-card {
  width: min(460px, 100%);
  background: var(--cream-alt);
  border: 1px solid var(--accent);
  border-radius: 24px 8px 8px 8px;
  padding: 2.4rem 2.1rem;
  box-shadow: var(--shadow-lg);
  animation: rise 0.75s ease 0.1s both;
}

.logo-blue {
  width: 120px;
  margin-bottom: 1.25rem;
}

.login-card h2 {
  font-size: 1.85rem;
  margin-bottom: 0.25rem;
}

.subtitle {
  margin: 0 0 1.5rem;
  color: var(--muted);
  font-size: 0.95rem;
}

.password-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
}

.toggle-pass {
  border: 1px solid var(--border-strong);
  background: var(--white);
  border-radius: var(--radius);
  padding: 0 0.85rem;
  color: var(--primary);
  cursor: pointer;
  font-weight: 500;
}

.toggle-pass:hover {
  border-color: var(--accent);
}

.submit,
.back {
  width: 100%;
  min-height: 45px;
}

.submit {
  margin-top: 0.5rem;
}

.back {
  margin-top: 0.65rem;
}

@media (max-width: 960px) {
  .login-shell {
    grid-template-columns: 1fr;
    align-content: start;
    min-height: 100dvh;
  }

  .brand-panel {
    padding: 1.25rem 1.35rem 1.5rem;
    gap: 0.85rem;
    justify-content: flex-start;
  }

  .brand-panel small {
    display: none;
  }

  .form-panel {
    display: block;
    padding: 0 1.15rem 1.5rem;
    margin-top: -1.25rem;
  }

  .login-card {
    width: 100%;
    border-radius: 16px 8px 8px 8px;
    padding: 1.5rem 1.25rem;
  }
}
</style>
