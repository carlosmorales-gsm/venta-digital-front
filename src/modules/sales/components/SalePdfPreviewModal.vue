<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { pdfBlobViewUrl } from '../utils/pdf-page-renderer';
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
const embedUrl = ref<string | null>(null);

const useEmbedFallback = computed(
  () => !loading.value && !error.value && pageImages.value.length === 0 && Boolean(embedUrl.value),
);

async function render() {
  loading.value = true;
  error.value = null;
  pageImages.value = [];
  if (downloadUrl.value) {
    URL.revokeObjectURL(downloadUrl.value);
    downloadUrl.value = null;
  }
  if (embedUrl.value) {
    embedUrl.value = null;
  }

  try {
    const { blob, pages } = await buildSalePreviewBundle(props.form, {
      saleId: props.saleId,
      status: props.status,
    });
    downloadUrl.value = URL.createObjectURL(blob);
    if (pages.length) {
      pageImages.value = pages;
    } else {
      embedUrl.value = pdfBlobViewUrl(downloadUrl.value);
    }
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
      <div v-else-if="pageImages.length" class="preview__pages">
        <img
          v-for="(src, i) in pageImages"
          :key="i"
          :src="src"
          class="preview__page"
          :alt="`Hoja ${i + 1} de la carátula`"
        />
      </div>
      <div v-else-if="useEmbedFallback" class="preview__embed">
        <iframe :src="embedUrl!" title="Carátula del contrato" />
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
  height: 100%;
  background: #dfe6eb;
  border-radius: 8px;
  padding: 0.65rem;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.preview__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--vd-muted);
  min-height: 40vh;
  justify-content: center;
  flex: 1;
}

.preview__pages {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  max-height: min(72vh, 800px);
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
}

.preview__page {
  width: 100%;
  height: auto;
  display: block;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 12px rgba(28, 42, 51, 0.14);
}

.preview__embed {
  flex: 1;
  min-height: min(68vh, 720px);
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
}

.preview__embed iframe {
  width: 100%;
  height: 100%;
  min-height: min(68vh, 720px);
  border: 0;
}

@media (max-width: 1024px) {
  .preview {
    min-height: 0;
    flex: 1;
    padding: 0.5rem;
  }

  .preview__pages {
    flex: 1;
    max-height: none;
    min-height: 0;
  }

  .preview__embed {
    min-height: 0;
  }

  .preview__embed iframe {
    min-height: 100%;
  }
}

@media (max-width: 600px) {
  .preview__pages {
    gap: 0.65rem;
  }
}
</style>
