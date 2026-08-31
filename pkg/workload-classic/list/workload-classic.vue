<script>
/**
 * Aggregate workloads list.
 *
 * Derived from shell/list/workload.vue in rancher/dashboard at tag v2.9.0,
 * before the aggregate view was gated off by PR #10795 and later removed by
 * PR #18450. Original work Copyright (c) SUSE, Apache-2.0.
 *
 * Differences from the original:
 *  - Uses the `workload-classic` type id rather than `workload`.
 *  - Row and type selection live in ../utils/rows so they can be unit tested.
 *  - The single-type branch is dropped; this component only ever renders the
 *    aggregate view, because per-type lists are still handled by the shell.
 */
import ResourceTable from '@shell/components/ResourceTable';
import { LIST_WORKLOAD_TYPES, SCHEMA, NODE, POD, WORKLOAD_TYPES } from '@shell/config/types';
import ResourceFetch from '@shell/mixins/resource-fetch';
import { WORKLOAD_CLASSIC } from '../config/workload-classic';
import { filterTopLevelRows, allowedWorkloadTypes } from '../utils/rows';

const ALL_TYPES = Object.values(LIST_WORKLOAD_TYPES);

/**
 * `workload-classic` has no Kubernetes schema, so fabricate one for
 * ResourceTable. This mirrors what the original component did.
 */
const workloadClassicSchema = {
  id:         WORKLOAD_CLASSIC,
  type:       SCHEMA,
  attributes: {
    kind:       'Workload',
    namespaced: true,
  },
  metadata: { name: WORKLOAD_CLASSIC },
};

const $loadingResources = ($route, $store) => ({
  loadResources: allowedWorkloadTypes(
    ALL_TYPES,
    (type) => !!$store.getters['cluster/schemaFor'](type)
  ),
  loadIndeterminate: true,
});

export default {
  name:       'ListWorkloadClassic',
  components: { ResourceTable },
  mixins:     [ResourceFetch],

  props: {
    useQueryParamsForSimpleFiltering: {
      type:    Boolean,
      default: false,
    },
  },

  async fetch() {
    if (this.loadResources.length) {
      this.$initializeFetchData(this.loadResources[0], this.loadResources);
    }

    // Nodes resolve NodePort endpoints to clickable external links. Without
    // them the Endpoints column degrades to "[Any Node]:<port>".
    if (this.$store.getters['cluster/schemaFor'](NODE)) {
      this.$fetchType(NODE);
    }

    // Populate the health column. Both are already in loadResources, so the
    // store de-duplicates these; they are requested explicitly to make the
    // dependency obvious.
    this.$fetchType(POD);
    this.$fetchType(WORKLOAD_TYPES.JOB);

    this.resources = await Promise.all(
      this.loadResources.map((type) => this.$fetchType(type, this.loadResources))
    );
  },

  data() {
    // Set on load rather than in fetch, so the namespace filter knows whether
    // it is required before the first request goes out.
    const { loadResources, loadIndeterminate } = $loadingResources(this.$route, this.$store);

    return {
      resources: [],
      loadResources,
      loadIndeterminate,
      schema: workloadClassicSchema,
    };
  },

  computed: {
    filteredRows() {
      return filterTopLevelRows(this.resources);
    },

    headers() {
      return this.$store.getters['type-map/headersFor'](this.schema, false);
    },
  },

  watch: {
    filteredRows() {
      this.kickDelayedColumns();
    },

    '$fetchState.pending'(pending) {
      if (!pending) {
        this.kickDelayedColumns();
      }
    },
  },

  methods: {
    /**
     * Start the delayed columns (Restarts, Health).
     *
     * SortableTable only starts a `delayLoading` column when it sees the
     * `forceUpdateLiveAndDelayed` prop change (watcherUpdateLiveAndDelayed ->
     * updateDelayedColumns), or when the table is scrolled. The shell assigns
     * that timestamp from exactly two watchers: a namespace-filter change
     * (resource-fetch-namespaced) and a pagination change
     * (resource-fetch-api-pagination). Native list pages get it for free
     * because server-side pagination settles during load. This page
     * deliberately does not paginate, and on a first load the namespace filter
     * does not change either, so neither fires and both columns spin forever.
     *
     * Timing matters as much as the nudge itself. SortableTable renders no rows
     * at all while `loading` is true (`v-if="isLoading && !loadingDelay"`), and
     * updateDelayedColumns bails out when `$refs.column` is empty without ever
     * retrying. Nudging as soon as rows are computed is therefore too early --
     * that happens inside fetch(), before $fetchState.pending flips. Wait for
     * loading to finish AND for the rows to be in the DOM.
     *
     * Re-running is safe: SortableTable tags each column with
     * `__delayedLoading` and skips ones it has already started.
     */
    kickDelayedColumns() {
      if (this.$fetchState.pending || !this.filteredRows.length) {
        return;
      }

      this.$nextTick(() => {
        this.forceUpdateLiveAndDelayed = new Date().getTime();
      });
    },
  },

  // Drives the loading indicator
  $loadingResources($route, $store) {
    return $loadingResources($route, $store);
  },

  // ResourceList/index.vue applies this option as `component.typeDisplay.apply(this)`
  // where `this` is ResourceList's OWN instance, not this component's. ResourceList's
  // own `schema` comes from `cluster/schemaFor(resource)`, which is undefined for
  // `workload-classic` because the type is deliberately schema-less — so `this.schema`
  // here is undefined and must fall back to the fabricated schema constant, or the
  // page heading and tab title render as "?". Do not remove the fallback.
  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](this.schema || workloadClassicSchema, 99);
  },
};
</script>

<template>
  <ResourceTable
    :loading="$fetchState.pending"
    :schema="schema"
    :headers="headers"
    :rows="filteredRows"
    :overflow-y="true"
    :use-query-params-for-simple-filtering="useQueryParamsForSimpleFiltering"
    :force-update-live-and-delayed="forceUpdateLiveAndDelayed"
  />
</template>
