<script setup lang="ts">
import { ControlButton, Controls } from '@vue-flow/controls';
import { useVueFlow } from '@vue-flow/core';
import { computed, onMounted } from 'vue';

const { nodesDraggable, setState } = useVueFlow();

/** 默认锁定：仅禁止拖动节点，仍可选中 */
onMounted(() => {
  if (nodesDraggable.value) {
    setState({ nodesDraggable: false });
  }
});

const isNodeDragLocked = computed(() => !nodesDraggable.value);

function toggleNodeDragLock() {
  setState({ nodesDraggable: !nodesDraggable.value });
}
</script>

<template>
  <Controls :show-interactive="false">
    <ControlButton
      class="vue-flow__controls-interactive"
      :title="isNodeDragLocked ? 'Unlock drag' : 'Lock drag'"
      @click="toggleNodeDragLock"
    >
      <svg
        v-if="isNodeDragLocked"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 25 32"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 0 0 0 13.714v15.238A3.056 3.056 0 0 0 3.048 32h18.285a3.056 3.056 0 0 0 3.048-3.048V13.714a3.056 3.056 0 0 0-3.048-3.047zM12.19 24.533a3.056 3.056 0 0 1-3.047-3.047 3.056 3.056 0 0 1 3.047-3.048 3.056 3.056 0 0 1 3.048 3.048 3.056 3.056 0 0 1-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"
        />
      </svg>
      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 25 32"
        width="16"
        height="16"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 0 0 0 13.714v15.238A3.056 3.056 0 0 0 3.048 32h18.285a3.056 3.056 0 0 0 3.048-3.048V13.714a3.056 3.056 0 0 0-3.048-3.047zM12.19 24.533a3.056 3.056 0 0 1-3.047-3.047 3.056 3.056 0 0 1 3.047-3.048 3.056 3.056 0 0 1 3.048 3.048 3.056 3.056 0 0 1-3.048 3.047z"
        />
      </svg>
    </ControlButton>
  </Controls>
</template>
