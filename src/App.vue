<script setup lang="ts">
import { useRoute } from 'vue-router';
import AppLayout from './layouts/AppLayout.vue';
import VdDialogHost from './shared/ui/dialog/VdDialogHost.vue';
import VdLoadingHost from './shared/ui/loading/VdLoadingHost.vue';

const route = useRoute();
</script>

<template>
  <RouterView v-slot="{ Component }">
    <AppLayout v-if="!route.meta.public && Component">
      <component :is="Component" />
    </AppLayout>
    <component :is="Component" v-else-if="Component" />
  </RouterView>

  <!-- Host global: alert / confirm reutilizables (nunca window.alert/confirm) -->
  <VdDialogHost />
  <VdLoadingHost />
</template>
