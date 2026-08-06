<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue';
import VdModal from '../../../shared/ui/modal/VdModal.vue';
import { fullName, type SaleFormData } from '../types/sale-form';

const props = defineProps<{
  open: boolean;
  form: SaleFormData;
  submitting?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [dataUrl: string];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const hasStroke = ref(false);
let drawing = false;
let ctx: CanvasRenderingContext2D | null = null;

function setupCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const parent = canvas.parentElement;
  const cssW = parent?.clientWidth || 320;
  const cssH = 180;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssW, cssH);
  ctx.strokeStyle = '#1a222a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  hasStroke.value = false;
}

function pos(e: PointerEvent) {
  const canvas = canvasRef.value!;
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onPointerDown(e: PointerEvent) {
  if (!ctx || props.submitting) return;
  drawing = true;
  canvasRef.value?.setPointerCapture(e.pointerId);
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}

function onPointerMove(e: PointerEvent) {
  if (!drawing || !ctx) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  hasStroke.value = true;
}

function onPointerUp() {
  drawing = false;
}

function clearPad() {
  setupCanvas();
}

function confirmSign() {
  const canvas = canvasRef.value;
  if (!canvas || !hasStroke.value) return;
  emit('confirm', canvas.toDataURL('image/png'));
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return;
    await nextTick();
    setupCanvas();
  },
);

onUnmounted(() => {
  ctx = null;
});
</script>

<template>
  <VdModal
    :open="open"
    title="Firmar manualmente"
    wide
    :close-on-scrim="!submitting"
    @close="emit('close')"
  >
    <div class="sign">
      <p class="sign__hint">
        Pide al titular
        <strong>{{ fullName(form.contacto) || 'del contrato' }}</strong>
        que firme en el recuadro con el dedo o el mouse.
      </p>
      <div class="sign__pad-wrap">
        <canvas
          ref="canvasRef"
          class="sign__pad"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointerleave="onPointerUp"
        />
      </div>
      <p v-if="!hasStroke" class="sign__empty">Aún no hay firma</p>
    </div>

    <template #footer>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="submitting"
        @click="clearPad"
      >
        Limpiar
      </button>
      <button
        type="button"
        class="btn btn-ghost"
        :disabled="submitting"
        @click="emit('close')"
      >
        Cancelar
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!hasStroke || submitting"
        @click="confirmSign"
      >
        {{ submitting ? 'Enviando…' : 'Confirmar y enviar' }}
      </button>
    </template>
  </VdModal>
</template>

<style scoped>
.sign {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sign__hint {
  margin: 0;
  color: var(--vd-muted);
  font-size: 0.92rem;
  line-height: 1.4;
}

.sign__hint strong {
  color: var(--vd-ink);
}

.sign__pad-wrap {
  border: 1.5px dashed var(--vd-line);
  border-radius: 8px;
  background:
    linear-gradient(#fff, #fff) padding-box,
    repeating-linear-gradient(
      -45deg,
      #f4f7f9,
      #f4f7f9 8px,
      #eef3f6 8px,
      #eef3f6 16px
    );
  overflow: hidden;
  touch-action: none;
}

.sign__pad {
  display: block;
  width: 100%;
  height: 180px;
  cursor: crosshair;
  touch-action: none;
  background: #fff;
}

.sign__empty {
  margin: 0;
  font-size: 0.82rem;
  color: var(--vd-muted);
  text-align: center;
}
</style>
