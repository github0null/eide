<script setup lang="ts">
import { Handle, Position, type NodeProps } from '@vue-flow/core';
import { computed } from 'vue';
import type { VcgLocation } from '../../types/build-report';

interface CallgraphNodeData {
  label: string;
  shape?: string;
  location?: VcgLocation;
  title: string;
  dimmed?: boolean;
  highlighted?: boolean;
  highlightRole?: 'selected' | 'caller' | 'callee';
}

const props = defineProps<NodeProps<CallgraphNodeData>>();

const nodeClass = computed(() => {
  const shape = props.data.shape;
  if (shape === 'triangle') return 'node-triangle';
  if (shape === 'ellipse') return 'node-ellipse';
  return 'node-box';
});

const locText = computed(() => {
  const loc = props.data.location;
  if (!loc?.file) {
    return '';
  }
  if (loc.line !== undefined && loc.column !== undefined) {
    return `${loc.file}:${loc.line}:${loc.column}`;
  }
  if (loc.line !== undefined) {
    return `${loc.file}:${loc.line}`;
  }
  return loc.file;
});
</script>

<template>
  <div
    class="cg-node"
    :class="[
      nodeClass,
      {
        selected: props.selected,
        'node-dimmed': props.data.dimmed,
        'node-highlighted': props.data.highlighted,
        'node-selected-role': props.data.highlightRole === 'selected',
        'node-caller': props.data.highlightRole === 'caller',
        'node-callee': props.data.highlightRole === 'callee',
      },
    ]"
  >
    <Handle type="target" :position="props.targetPosition ?? Position.Top" />
    <div class="cg-label" :title="props.data?.label ?? ''">
      {{ props.data?.label ?? '' }}
    </div>
    <div v-if="locText" class="cg-loc-wrap" :title="locText">
      <span class="cg-loc">{{ locText }}</span>
    </div>
    <Handle type="source" :position="props.sourcePosition ?? Position.Bottom" />
  </div>
</template>

<style scoped>
.cg-node {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--vscode-editorWidget-border, #3c3c3c);
  background: var(--vscode-editorWidget-background, #252526);
  color: var(--vscode-editor-foreground, #d4d4d4);
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  font-size: 11px;
  text-align: center;
  box-sizing: border-box;
  overflow: hidden;
}

.cg-node.selected {
  border-color: var(--vscode-focusBorder, #007acc);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc);
}

.node-triangle {
  border-color: var(--vscode-button-background, #0e639c);
}

.node-ellipse {
  border-radius: 999px;
  opacity: 0.92;
}

.cg-node.node-dimmed {
  opacity: 0.35;
}

.cg-node.node-highlighted {
  outline: 2px solid var(--vscode-focusBorder, #007acc);
  outline-offset: 2px;
}

.cg-node.node-selected-role {
  border-color: var(--vscode-focusBorder, #007acc);
  box-shadow: 0 0 0 2px var(--vscode-focusBorder, #007acc);
}

.cg-node.node-caller {
  border-color: var(--vscode-charts-green, #89d185);
  box-shadow: 0 0 0 1px var(--vscode-charts-green, #89d185);
}

.cg-node.node-callee {
  border-color: var(--vscode-charts-orange, #cca700);
  box-shadow: 0 0 0 1px var(--vscode-charts-orange, #cca700);
}

.cg-label {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.cg-loc-wrap {
  display: block;
  width: 100%;
  min-width: 0;
  margin-top: 2px;
  overflow: hidden;
}

.cg-loc {
  display: block;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  opacity: 0.65;
  /* 省略号在左侧，右侧优先显示文件名:行:列；title 放在外层避免 rtl 扰乱 tooltip */
  direction: rtl;
  text-align: left;
  unicode-bidi: plaintext;
}
</style>
