<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import type { SaleAttachment } from '../types/sale-form';
import {
  attachmentPreviewSrc,
  isImageAttachment,
  isPdfAttachment,
} from '../utils/attachment-preview';
import {
  attachmentPdfBytes,
  renderPdfToPageImages,
} from '../utils/pdf-page-renderer';

const props = defineProps<{
  open: boolean;
  title: string;
  attachment: SaleAttachment | null;
}>();

defineEmits<{
  close: [];
}>();

const objectUrl = ref<string | null>(null);
const pdfLoading = ref(false);
const pdfError = ref<string | null>(null);
const pdfPages = ref<string[]>([]);

const src = computed(() =>
  props.attachment ? attachmentPreviewSrc(props.attachment) : null,
);

const isPdf = computed(() =>
  props.attachment ? isPdfAttachment(props.attachment) : false,
);

const isImage = computed(() =>
  props.attachment ? isImageAttachment(props.attachment) : false,
);

const isDriveOnly = computed(() => {
  if (!props.attachment) return false;
  return !props.attachment.dataBase64?.trim() && Boolean(props.attachment.driveFileUrl);
});

const usePdfImages = computed(
  () => isPdf.value && !isDriveOnly.value && pdfPages.value.length > 0,
);

async function loadPdfPreview() {
  pdfPages.value = [];
  pdfError.value = null;
  if (!props.open || !props.attachment || !isPdfAttachment(props.attachment)) {
    return;
  }
  if (isDriveOnly.value) return;

  pdfLoading.value = true;
  try {
    const bytes = await attachmentPdfBytes(props.attachment);
    if (!bytes) {
      pdfError.value = 'No se pudo leer el PDF.';
      return;
    }
    pdfPages.value = await renderPdfToPageImages(bytes);
  } catch {
    pdfError.value = 'No se pudo mostrar la vista previa del PDF.';
  } finally {
    pdfLoading.value = false;
  }
}

watch(
  () => [props.open, props.attachment] as const,
  () => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = null;
    }
    void loadPdfPreview();
  },
);

onUnmounted(() => {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
});
</script>

<template>
  <VdModal
    :open="open"
    :title="title"
    :wide="!isPdf"
    :xlarge="isPdf"
    @close="$emit('close')"
  >
    <div class="file-preview">
      <p v-if="!attachment || !src" class="file-preview__empty">
        No hay contenido para previsualizar.
      </p>

      <template v-else>
        <p class="file-preview__meta">
          {{ attachment.name }}
          <template v-if="isDriveOnly"> · en Drive</template>
        </p>

        <div v-if="isImage" class="file-preview__frame">
          <img :src="src" :alt="attachment.name" />
        </div>

        <template v-else-if="isPdf && !isDriveOnly">
          <div v-if="pdfLoading" class="file-preview__state">
            <span class="spinner" />
            Cargando PDF…
          </div>
          <p v-else-if="pdfError" class="file-preview__empty">{{ pdfError }}</p>
          <div v-else-if="usePdfImages" class="file-preview__pages">
            <img
              v-for="(page, i) in pdfPages"
              :key="i"
              :src="page"
              class="file-preview__page"
              :alt="`${attachment.name} · hoja ${i + 1}`"
            />
          </div>
        </template>

        <div v-else class="file-preview__drive">
          <p>Este archivo está en Google Drive.</p>
          <a :href="src" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
            Abrir archivo
          </a>
        </div>
      </template>
    </div>
  </VdModal>
</template>

<style scoped>
.file-preview {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 12rem;
  height: 100%;
  min-width: 0;
}

.file-preview__empty,
.file-preview__state {
  margin: 0;
  color: var(--vd-muted);
}

.file-preview__state {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 20vh;
  justify-content: center;
}

.file-preview__meta {
  margin: 0;
  font-size: 0.85rem;
  color: var(--vd-muted);
  word-break: break-all;
}

.file-preview__frame {
  border: 1px solid var(--vd-line);
  border-radius: 10px;
  background: #f6f7f9;
  overflow: auto;
  max-height: min(70vh, 640px);
  display: grid;
  place-items: center;
  padding: 0.5rem;
  -webkit-overflow-scrolling: touch;
}

.file-preview__frame img {
  max-width: 100%;
  height: auto;
  display: block;
}

.file-preview__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.85rem;
  max-height: min(75vh, 820px);
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  background: #dfe6eb;
  border-radius: 8px;
  padding: 0.65rem;
  flex: 1;
  min-height: 0;
}

.file-preview__page {
  width: min(100%, 420px);
  height: auto;
  display: block;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 2px 12px rgba(28, 42, 51, 0.14);
}

.file-preview__drive {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 0;
}

.file-preview__drive p {
  margin: 0;
  color: var(--vd-muted);
}

@media (max-width: 1024px) {
  .file-preview {
    min-height: 0;
    flex: 1;
  }

  .file-preview__pages {
    max-height: none;
  }

  .file-preview__page {
    width: min(100%, 360px);
  }

  .file-preview__frame {
    max-height: none;
    flex: 1;
    min-height: 0;
  }
}
</style>
