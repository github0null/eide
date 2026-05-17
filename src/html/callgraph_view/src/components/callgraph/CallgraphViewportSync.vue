<script setup lang="ts">
import { useVueFlow } from '@vue-flow/core';
import { nextTick, watch } from 'vue';
import { callgraphViewportByFlowKey } from '../../composables/usePageSessionState';

const props = defineProps<{
  flowKey: string;
  paneVisible: boolean;
}>();

const { setViewport, viewport } = useVueFlow();

watch(
  viewport,
  (vp) => {
    callgraphViewportByFlowKey.set(props.flowKey, {
      x: vp.x,
      y: vp.y,
      zoom: vp.zoom,
    });
  },
  { deep: true },
);

watch(
  () => [props.paneVisible, props.flowKey] as const,
  ([visible], [prevVisible]) => {
    if (prevVisible && !visible) {
      callgraphViewportByFlowKey.set(props.flowKey, {
        x: viewport.value.x,
        y: viewport.value.y,
        zoom: viewport.value.zoom,
      });
      return;
    }
    if (!visible) {
      return;
    }
    const saved = callgraphViewportByFlowKey.get(props.flowKey);
    if (!saved) {
      return;
    }
    void nextTick(() => {
      void setViewport(saved, { duration: 0 });
    });
  },
);
</script>

<template />
