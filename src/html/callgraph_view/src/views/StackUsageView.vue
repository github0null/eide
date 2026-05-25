<script setup lang="ts">
import { NEmpty, NText } from 'naive-ui';
import { computed } from 'vue';
import StackUsageTable from '../components/stackusage/StackUsageTable.vue';
import { useBuildReport } from '../composables/useBuildReport';

const props = defineProps<{
  paneVisible?: boolean;
}>();

const { hasStackUsage, allStackRows } = useBuildReport();

const tableEmpty = computed(() => allStackRows.value.length === 0);
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
    <div class="stackusage-content">
      <div v-if="tableEmpty" class="empty-center">
        <NEmpty description="No stack usage data" />
      </div>
      <StackUsageTable
        v-else
        class="stackusage-table-host"
        :rows="allStackRows"
        :show-source-column="true"
        scroll-key="merged"
        :pane-visible="props.paneVisible ?? true"
      />
    </div>
  </div>
</template>
