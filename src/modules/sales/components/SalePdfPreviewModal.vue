<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { buildSalePreviewBundle } from '../utils/sale-pdf';
import type { SaleFormData } from '../types/sale-form';

const props = defineProps<{
  open: boolean;
  form: SaleFormData;
  saleId?: number | null;
  status?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const loading = ref(false);
const error = ref<string | null>(null);
const pageImages = ref<string[]>([]);
const downloadUrl = ref<string | null>(null);

async function render() {
  loading.value = true;
  error.value = null;
  pageImages.value = [];
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value);
    downloadUrl.value = null;
  }

  try {
    const { blob, pages } = await buildSalePreviewBundle(props.form, {
      saleId: props.saleId,
      status: props.status,
    });
    pageImages.value = pages;
    downloadUrl.value = URL.createObjectURL(blob);
  } catch {
    error.value = 'No se pudo generar la carátula. Intenta de nuevo.';
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void render();
  },
);

onUnmounted(() => {
  if (downloadUrl.value) URL.revokeObjectURL(downloadUrl.value);
});
</script>

<template>
  <VdModal
    :open="open"
    title="Carátula del contrato"
    xlarge
    @close="emit('close')"
  >
    <div class="preview">
      <div v-if="loading" class="preview__state">
        <span class="spinner" />
        Generando carátula…
      </div>
      <p v-else-if="error" class="error-text">{{ error }}</p>
      <div v-else class="preview__pages">
        <img
          v-for="(src, i) in pageImages"
          :key="i"
          :src="src"
          class="preview__page"
          :alt="`Hoja ${i + 1} de la carátula`"
        />
      </div>
    </div>

    <template #footer>
      <a
        v-if="downloadUrl"
        class="btn btn-accent"
        :href="downloadUrl"
        download="caratula-contrato.pdf"
      >
        Descargar PDF
      </a>
      <button type="button" class="btn btn-ghost" @click="emit('close')">
        Cerrar
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.preview {
  min-height: 40vh;
  background: #dfe6eb;
  border-radius: 8px;
  padding: 0.65rem;
}

.preview__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
  min-height: 40vh;
  justify-content: center;
}

.preview__pages {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: min(72vh, 800px);
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.preview__page {
  width: 100%;
  height: auto;
  display: block;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 12px rgba(28, 42, 51, 0.14);
}

@media (max-width: 600px) {
  .preview__pages {
    max-height: min(60vh, 580px);
  }
}
</style>
