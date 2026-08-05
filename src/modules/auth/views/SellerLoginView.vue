<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

const auth = useAuthStore();
const router = useRouter();

const step = ref<'phone' | 'pin'>('phone');
const cellphone = ref('');
const nipId = ref<number | null>(null);
const nip = ref('');
const localError = ref<string | null>(null);

async function requestPin() {
  localError.value = null;
  if (!/^\d{10}$/.test(cellphone.value)) {
    localError.value = 'Ingresa un celular de 10 dígitos';
    return;
  }

  try {
    const data = await auth.requestSellerPin(cellphone.value);
    if (!data.nipId) {
      localError.value = data.message;
      return;
    }
    nipId.value = data.nipId;
    step.value = 'pin';
  } catch {
    localError.value = auth.error;
  }
}

async function verifyPin() {
  localError.value = null;
  if (!nipId.value || !nip.value) {
    localError.value = 'Ingresa el PIN recibido';
    return;
  }

  try {
    await auth.verifySellerPin({
      nipId: nipId.value,
      nip: nip.value,
      cellphone: cellphone.value,
    });
    router.replace({ name: 'vendedor-ventas' });
  } catch {
    localError.value = auth.error;
  }
}
</script>

<template>
  <section class="access">
    <div class="access__hero">
      <img src="/logo-gsm-azul.svg" alt="Grupo San Martín" class="access__logo" />
      <h1>Venta Digital</h1>
      <p>Acceso de vendedor con PIN de WhatsApp</p>
    </div>

    <form
      class="panel access__panel"
      @submit.prevent="step === 'phone' ? requestPin() : verifyPin()"
    >
      <h2>{{ step === 'phone' ? 'Tu celular' : 'Código PIN' }}</h2>

      <div v-if="step === 'phone'" class="field">
        <label for="cellphone">Celular (10 dígitos)</label>
        <input
          id="cellphone"
          v-model="cellphone"
          type="tel"
          inputmode="numeric"
          maxlength="10"
          placeholder="6671234567"
          autocomplete="tel"
          required
        />
      </div>

      <div v-else class="field">
        <label for="nip">PIN recibido</label>
        <input
          id="nip"
          v-model="nip"
          type="text"
          inputmode="numeric"
          maxlength="8"
          placeholder="••••"
          autocomplete="one-time-code"
          required
        />
      </div>

      <p v-if="localError" class="error-text">{{ localError }}</p>

      <button class="btn btn-primary" type="submit" :disabled="auth.loading">
        <span v-if="auth.loading" class="spinner" />
        <template v-if="step === 'phone'">
          {{ auth.loading ? 'Enviando…' : 'Enviar PIN' }}
        </template>
        <template v-else>
          {{ auth.loading ? 'Validando…' : 'Entrar' }}
        </template>
      </button>

      <button
        v-if="step === 'pin'"
        class="btn btn-ghost"
        type="button"
        @click="step = 'phone'"
      >
        Cambiar celular
      </button>
      <button
        v-else
        class="btn btn-ghost"
        type="button"
        @click="router.push({ name: 'home' })"
      >
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

.access__panel .btn {
  width: 100%;
}
</style>
