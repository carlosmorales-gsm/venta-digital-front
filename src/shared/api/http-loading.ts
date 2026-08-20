import { computed, ref } from 'vue';

const pending = ref(0);
const visible = ref(false);

let showTimer: ReturnType<typeof setTimeout> | null = null;
const SHOW_DELAY_MS = 120;

function clearShowTimer() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

export function trackHttpLoadingStart() {
  pending.value += 1;
  if (pending.value === 1) {
    showTimer = setTimeout(() => {
      if (pending.value > 0) visible.value = true;
    }, SHOW_DELAY_MS);
  }
}

export function trackHttpLoadingStop() {
  pending.value = Math.max(0, pending.value - 1);
  if (pending.value === 0) {
    clearShowTimer();
    visible.value = false;
  }
}

export const httpLoadingVisible = computed(() => visible.value);
