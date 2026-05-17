<script setup lang="ts">
import { NEmpty, NSelect, NText } from 'naive-ui';
import { computed, watch } from 'vue';
import StackUsageTable from '../components/stackusage/StackUsageTable.vue';
import { useBuildReport } from '../composables/useBuildReport';
import { stackUsageSession } from '../composables/usePageSessionState';
import type { StackUsageRow } from '../types/build-report';

const props = defineProps<{
  paneVisible?: boolean;
}>();

const { hasStackUsage, stackDocuments, allStackRows } = useBuildReport();

const ALL_DOCS = -1;
const { selectedDoc } = stackUsageSession;

watch(
  stackDocuments,
  (docs) => {
    if (docs.length > 0 && selectedDoc.value >= docs.length) {
      selectedDoc.value = ALL_DOCS;
    }
  },
  { immediate: true },
);

const docOptions = computed(() => [
  { label: 'Merged', value: ALL_DOCS },
  ...stackDocuments.value.map((d) => ({
    label: `${d.title} (${d.entries.length})`,
    value: d.index,
  })),
]);

const showSourceColumn = computed(() => selectedDoc.value === ALL_DOCS);

const tableRows = computed((): StackUsageRow[] => {
  if (selectedDoc.value === ALL_DOCS) {
    return allStackRows.value;
  }
  const doc = stackDocuments.value.find((d) => d.index === selectedDoc.value);
  if (!doc) {
    return [];
  }
  return doc.entries.map((e) => ({
    functionName: e.functionName,
    stackBytes: e.stackBytes,
    allocationType: e.allocationType,
    locationText: `${e.location.file}:${e.location.line}:${e.location.column}`,
    file: e.location.file,
    line: e.location.line,
    column: e.location.column,
    sourceDoc: doc.title,
  }));
});

const currentDocEmpty = computed(() => {
  if (selectedDoc.value === ALL_DOCS) {
    return allStackRows.value.length === 0;
  }
  const doc = stackDocuments.value.find((d) => d.index === selectedDoc.value);
  return !doc || doc.entries.length === 0;
});
</script>

<template>
  <div v-if="!hasStackUsage" class="empty-center">
    <NEmpty description="No stack usage data">
      <template #extra>
        <NText depth="3" style="font-size: 12px">
          Please enable -fstack-usage in the build options and rebuild the project.
        </NText>
      </template>
    </NEmpty>
  </div>
  <div v-else class="stackusage-page">
    <div class="page-toolbar" style="margin-bottom: 8px; flex-shrink: 0">
      <NSelect
        v-model:value="selectedDoc"
        :options="docOptions"
        style="min-width: 200px"
        size="small"
      />
    </div>
    <div class="stackusage-content">
      <div v-if="currentDocEmpty" class="empty-center">
        <NEmpty description="No stack usage data" />
      </div>
      <StackUsageTable
        v-else
        class="stackusage-table-host"
        :rows="tableRows"
        :show-source-column="showSourceColumn"
        :scroll-key="String(selectedDoc)"
        :pane-visible="props.paneVisible ?? true"
      />
    </div>
  </div>
</template>
