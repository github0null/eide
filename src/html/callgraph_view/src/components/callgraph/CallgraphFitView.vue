<script setup lang="ts">
import {
  getRectOfNodes,
  useNodesInitialized,
  useVueFlow,
} from '@vue-flow/core';
import { nextTick, watch } from 'vue';

const props = defineProps<{
  trigger: string;
}>();

const { fitView, getNodes, setViewport, dimensions } = useVueFlow();
const nodesInitialized = useNodesInitialized();

const MAX_ATTEMPTS = 12;
const RETRY_MS = 80;

async function applyFitView(): Promise<boolean> {
  await nextTick();
  const { width, height } = dimensions.value;
  if (!width || !height) {
    return false;
  }
  const nodes = getNodes.value;
  if (nodes.length === 0) {
    return false;
  }
  const rect = getRectOfNodes(nodes);
  if (rect.width < 1 || rect.height < 1) {
    void setViewport({ x: 0, y: 0, zoom: 1 });
    return false;
  }
  await fitView({
    padding: 0.12,
    minZoom: 0.12,
    maxZoom: 1.5,
    duration: 0,
  });
  return true;
}

function scheduleFitView(attempt = 0): void {
  if (attempt >= MAX_ATTEMPTS) {
    return;
  }
  setTimeout(() => {
    void applyFitView().then((ok) => {
      if (!ok) {
        scheduleFitView(attempt + 1);
      }
    });
  }, RETRY_MS);
}

watch(
  () =>
    [
      nodesInitialized.value,
      props.trigger,
      dimensions.value.width,
      dimensions.value.height,
    ] as const,
  ([ready]) => {
    if (!ready) {
      return;
    }
    scheduleFitView();
  },
  { immediate: true },
);
</script>

<template />
