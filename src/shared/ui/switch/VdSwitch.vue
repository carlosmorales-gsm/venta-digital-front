<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    ariaLabel?: string;
    title?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: 'Cambiar estado',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  change: [value: boolean];
}>();

function onToggle() {
  if (props.disabled) return;
  // Solo notifica la intención; el padre confirma y actualiza el valor real.
  emit('change', !props.modelValue);
}
</script>

<template>
  <button
    type="button"
    class="vd-switch"
    :class="{ on: modelValue, disabled }"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :title="title"
    :disabled="disabled"
    @click="onToggle"
  >
    <span class="vd-switch__thumb" aria-hidden="true" />
  </button>
</template>

<style scoped>
.vd-switch {
  --track-w: 44px;
  --track-h: 24px;
  --thumb: 18px;
  position: relative;
  width: var(--track-w);
  height: var(--track-h);
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #c5cdd3;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.18s ease;
}

.vd-switch.on {
  background: var(--gsm-blue);
}

.vd-switch.disabled,
.vd-switch:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.vd-switch__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: var(--thumb);
  height: var(--thumb);
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(28, 42, 51, 0.25);
  transition: transform 0.18s ease;
}

.vd-switch.on .vd-switch__thumb {
  transform: translateX(20px);
}

.vd-switch:focus-visible {
  outline: 2px solid var(--gsm-cafe);
  outline-offset: 2px;
}
</style>
