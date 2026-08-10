<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import type { SaleAttachment } from '../types/sale-form';
import {
  attachmentPreviewSrc,
  isImageAttachment,
  isPdfAttachment,
} from '../utils/attachment-preview';

const props = defineProps<{
  open: boolean;
  title: string;
  attachment: SaleAttachment | null;
}>();

defineEmits<{
  close: [];
}>();

const objectUrl = ref<string | null>(null);

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

watch(
  () => [props.open, props.attachment] as const,
  () => {
    if (objectUrl.value) {
      URL.revokeObjectURL(objectUrl.value);
      objectUrl.value = null;
    }
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
    wide
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

        <div v-else-if="isPdf && !isDriveOnly" class="file-preview__frame file-preview__frame--pdf">
          <iframe :src="src" title="Vista previa PDF" />
        </div>

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
}

.file-preview__empty {
  margin: 0;
  color: var(--vd-muted);
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
}

.file-preview__frame img {
  max-width: 100%;
  height: auto;
  display: block;
}

.file-preview__frame--pdf {
  padding: 0;
  place-items: stretch;
}

.file-preview__frame--pdf iframe {
  width: 100%;
  height: min(70vh, 640px);
  border: 0;
  background: #fff;
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
</style>
