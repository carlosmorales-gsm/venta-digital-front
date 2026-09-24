<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { extractApiError, http } from '../../../shared/api/http';
import { isSignedSaleStatus, mergeSaleForm, type SaleFormData, type SaleListItem } from '../types/sale-form';
import SaleManualSignModal from '../components/SaleManualSignModal.vue';
import { buildSignSaleRequest } from '../utils/submit-sign';

const route = useRoute();
const loading = ref(true);
const error = ref<string | null>(null);
const done = ref(false);
const submitting = ref(false);
const form = ref<SaleFormData | null>(null);
const saleId = ref<number | null>(null);
const status = ref('');

function token(): string {
  return String(route.params.token || '').trim();
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await http.get<SaleListItem & { alreadySigned?: boolean }>(
      `/public/sign/${encodeURIComponent(token())}`,
    );
    saleId.value = data.id;
    status.value = data.status;
    if (data.alreadySigned || isSignedSaleStatus(data.status)) {
      done.value = true;
      return;
    }
    form.value = mergeSaleForm(data.payload);
  } catch (e: unknown) {
    error.value = extractApiError(
      e,
      'Este enlace de firma no es válido o ya venció.',
    );
  } finally {
    loading.value = false;
  }
}

async function confirmSign(dataUrl: string) {
  if (!saleId.value || !form.value) return;
  submitting.value = true;
  try {
    const built = await buildSignSaleRequest(form.value, saleId.value, dataUrl);
    await http.post(
      `/public/sign/${encodeURIComponent(token())}`,
      built.body,
      { timeout: 180000 },
    );
    done.value = true;
  } catch (e: unknown) {
    error.value = extractApiError(e, 'No se pudo guardar la firma');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="sign-page">
    <img src="/logo-gsm-azul.svg" alt="Grupo San Martín" class="sign-page__logo" />
    <h1>Firma de documentos</h1>

    <p v-if="loading" class="sign-page__msg">Cargando tus documentos…</p>
    <p v-else-if="done" class="sign-page__ok">
      Gracias. La firma ya quedó registrada. Puedes cerrar esta ventana.
    </p>
    <p v-else-if="error" class="sign-page__err">{{ error }}</p>
    <p v-else class="sign-page__msg">
      Lee cada documento, acepta los términos y firma al final.
    </p>

    <SaleManualSignModal
      v-if="form && !done && !error"
      :open="true"
      :form="form"
      :sale-id="saleId"
      :status="status"
      :submitting="submitting"
      persistent
      @confirm="confirmSign"
    />
  </section>
</template>

<style scoped>
.sign-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1rem 2rem;
  text-align: center;
}
.sign-page__logo {
  width: min(180px, 64vw);
  margin-bottom: 0.75rem;
}
.sign-page h1 {
  color: var(--gsm-blue);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  margin-bottom: 0.6rem;
}
.sign-page__msg,
.sign-page__ok,
.sign-page__err {
  max-width: 28rem;
}
.sign-page__ok {
  color: var(--gsm-green, #1f7a4d);
  font-weight: 600;
}
.sign-page__err {
  color: var(--danger, #b42318);
}
</style>
