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
    /**
     * Kick the delayed columns (Restarts, Health) once rows arrive.
     *
     * SortableTable only starts a `delayLoading` column when it sees the
     * `forceUpdateLiveAndDelayed` prop CHANGE (watcherUpdateLiveAndDelayed ->
     * updateDelayedColumns), or when the user scrolls the table.
     *
     * The shell's own mixins assign that timestamp from exactly two watchers:
     * a namespace-filter change (resource-fetch-namespaced.js) and a pagination
     * change (resource-fetch-api-pagination.js). Native list pages get it for
     * free because server-side pagination settles during load. This page
     * deliberately does not paginate, and on a first load the namespace filter
     * does not change either -- so neither watcher fires, the value stays at its
     * initial 0, and both delayed columns spin forever.
     *
     * Re-running is safe: SortableTable tags each column with `__delayedLoading`
     * and skips the ones it has already started.
     */
    filteredRows(rows) {
      if (rows.length) {
        this.forceUpdateLiveAndDelayed = new Date().getTime();
      }
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
