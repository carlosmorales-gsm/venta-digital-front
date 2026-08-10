<script setup lang="ts">
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import type { AttachmentListItem } from '../utils/attachment-preview';
import { isImageAttachment, isPdfAttachment } from '../utils/attachment-preview';

defineProps<{
  open: boolean;
  items: AttachmentListItem[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [item: AttachmentListItem];
}>();

function kindBadge(item: AttachmentListItem) {
  if (isPdfAttachment(item.attachment)) return 'PDF';
  if (isImageAttachment(item.attachment)) return 'Imagen';
  return 'Archivo';
}
</script>

<template>
  <VdModal :open="open" title="Archivos anexados" @close="emit('close')">
    <div v-if="loading" class="att-loading">
      <span class="spinner" />
      Cargando…
    </div>
    <p v-else-if="!items.length" class="att-empty">
      Esta venta aún no tiene archivos anexados.
    </p>
    <ul v-else class="att-list">
      <li v-for="item in items" :key="item.kind">
        <button type="button" class="att-item" @click="emit('select', item)">
          <span class="att-item__icon" aria-hidden="true">
            <svg v-if="isPdfAttachment(item.attachment)" viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1 7V3.5L18.5 9H15zM8 13h2.5a1.5 1.5 0 0 1 0 3H9v2H8v-5zm1 1v1.5h1.5a.5.5 0 0 0 0-1H9zm4.5 0H14a.75.75 0 0 1 0 1.5h-.5V17H12v-5h1.5v1zm3 0h2v1h-2V17h-1.5v-5H17.5v1z"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20">
              <path
                fill="currentColor"
                d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
              />
            </svg>
          </span>
          <span class="att-item__copy">
            <strong>{{ item.label }}</strong>
            <small>{{ item.attachment.name || kindBadge(item) }}</small>
          </span>
          <span class="att-item__badge">{{ kindBadge(item) }}</span>
        </button>
      </li>
    </ul>
  </VdModal>
</template>

<style scoped>
.att-loading,
.att-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--vd-muted);
  font-size: 0.92rem;
  margin: 0;
  min-height: 3rem;
}

.att-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.att-item {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.7rem;
  text-align: left;
  border: 1px solid var(--vd-line);
  background: var(--vd-surface, #fff);
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  cursor: pointer;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.att-item:hover {
  border-color: var(--gsm-blue, #35647d);
  background: #f4f8fa;
}

.att-item__icon {
  color: var(--gsm-blue, #35647d);
  display: grid;
  place-items: center;
}

.att-item__copy {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.att-item__copy strong {
  font-size: 0.9rem;
}

.att-item__copy small {
  color: var(--vd-muted);
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att-item__badge {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gsm-blue, #35647d);
  background: #e8f1f5;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
}
</style>
