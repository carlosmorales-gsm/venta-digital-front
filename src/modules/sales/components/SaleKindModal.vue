<script setup lang="ts">
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { SALE_KINDS, type SaleKind } from '../constants/sale-kinds';

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [kind: SaleKind];
}>();
</script>

<template>
  <VdModal :open="open" title="Tipo de venta" @close="emit('close')">
    <div class="kind-list">
      <button
        v-for="item in SALE_KINDS"
        :key="item.value"
        type="button"
        class="kind-card"
        :class="`kind-card--${item.value.toLowerCase()}`"
        @click="emit('select', item.value)"
      >
        <span class="kind-card__icon" aria-hidden="true">
          <svg
            v-if="item.value === 'NUEVA'"
            viewBox="0 0 24 24"
            width="26"
            height="26"
          >
            <path
              fill="currentColor"
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3zm-3-7V3.5L18.5 9H13z"
            />
          </svg>
          <svg
            v-else-if="item.value === 'RECONOCIMIENTO'"
            viewBox="0 0 24 24"
            width="26"
            height="26"
          >
            <path
              fill="currentColor"
              d="M21 7.28V5c0-1.1-.9-2-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.28A2 2 0 0 0 22 15V9a2 2 0 0 0-1-1.72M20 9v6h-7V9zM5 19V5h14v2h-6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6v2zm11.5-6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3"
            />
          </svg>
          <svg
            v-else-if="item.value === 'MEJORA'"
            viewBox="0 0 24 24"
            width="26"
            height="26"
          >
            <path
              fill="currentColor"
              d="M16 6h6v6h-2V9.41l-7.17 7.18-4-4L2 17.41 3.41 18.83l5.42-5.42 4 4L20.59 9H16z"
            />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="26"
            height="26"
          >
            <path
              fill="currentColor"
              d="M16 18h6v-6h-2v2.59l-7.17-7.18-4 4L2 6.59 3.41 5.17l5.42 5.42 4-4L20.59 15H16z"
            />
          </svg>
        </span>
        <strong>{{ item.label }}</strong>
        <span class="kind-card__go" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <path
              fill="currentColor"
              d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.58a1 1 0 0 0 0-1.42L10.7 6.7a1 1 0 0 0-1.41.01"
            />
          </svg>
        </span>
      </button>
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost" @click="emit('close')">
        Cancelar
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.kind-list {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.kind-card {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  width: 100%;
  min-height: 72px;
  padding: 0.75rem 0.9rem 0.75rem 0.8rem;
  border: 1px solid var(--vd-line);
  border-radius: 14px;
  background: #fff;
  color: inherit;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 0 rgba(2, 53, 125, 0.04);
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.kind-card:hover {
  border-color: var(--gsm-blue);
  background: #f6fafc;
  box-shadow: 0 10px 22px rgba(53, 100, 125, 0.1);
  transform: translateY(-1px);
}

.kind-card:focus-visible {
  outline: 2px solid var(--gsm-blue);
  outline-offset: 2px;
}

.kind-card:active {
  transform: scale(0.99);
}

.kind-card__icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: 12px;
  background: #e8f0f4;
  color: var(--gsm-blue);
}

.kind-card--reconocimiento .kind-card__icon {
  background: var(--gsm-cafe-soft);
  color: #8a6844;
}

.kind-card--mejora .kind-card__icon {
  background: #e4eef4;
  color: var(--gsm-blue-deep);
}

.kind-card--minoria .kind-card__icon {
  background: #eef3f6;
  color: var(--gsm-blue);
}

.kind-card:hover .kind-card__icon {
  filter: saturate(1.08);
}

.kind-card strong {
  flex: 1;
  min-width: 0;
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--gsm-blue);
  line-height: 1.2;
}

.kind-card__go {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #9aa6ae;
  transition: color 0.18s ease, transform 0.18s ease;
}

.kind-card:hover .kind-card__go {
  color: var(--gsm-blue);
  transform: translateX(2px);
}

@media (max-width: 600px) {
  .kind-card {
    min-height: 68px;
  }
}
</style>
