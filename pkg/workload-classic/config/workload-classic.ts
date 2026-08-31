import { IPlugin, ConfigureVirtualTypeOptions } from '@shell/core/types';
import {
  STATE,
  NAME as NAME_COL,
  NAMESPACE as NAMESPACE_COL,
  TYPE,
  WORKLOAD_IMAGES,
  WORKLOAD_ENDPOINTS,
  POD_RESTARTS,
  AGE,
  WORKLOAD_HEALTH_SCALE,
} from '@shell/config/table-headers';

/**
 * Deliberately NOT the shell's `workload` type id.
 *
 * The shell still registers `workload` on 2.14 and 2.15 (gated behind
 * !ui-sql-cache) and drops it on 2.16. A distinct id means no duplicate nav
 * entry for anyone who disables that flag, and identical behaviour on all
 * three versions.
 */
export const WORKLOAD_CLASSIC = 'workload-classic';

const EXPLORER = 'explorer';
const WORKLOAD_GROUP = 'workload';
const RESOURCE_ROUTE = 'c-cluster-product-resource';

export function init($plugin: IPlugin, store: any): void {
  const {
    virtualType, basicType, weightType, headers,
  } = $plugin.DSL(store, EXPLORER);

  const route = {
    name:   RESOURCE_ROUTE,
    params: { resource: WORKLOAD_CLASSIC },
  };

  headers(WORKLOAD_CLASSIC, [
    STATE,
    NAME_COL,
    NAMESPACE_COL,
    TYPE,
    WORKLOAD_IMAGES,
    WORKLOAD_ENDPOINTS,
    POD_RESTARTS,
    AGE,
    WORKLOAD_HEALTH_SCALE,
  ]);

  // `icon` is supported at runtime — the shell's own explorer.js sets
  // `icon: 'folder'` on this same nav group — but it is missing from
  // ConfigureVirtualTypeOptions, so widen the type just for that one property.
  const navEntry: ConfigureVirtualTypeOptions & { icon: string } = {
    labelKey:   'workloadClassic.nav.label',
    name:       WORKLOAD_CLASSIC,
    namespaced: true,
    icon:       'folder',
    route,
  };

  virtualType(navEntry);

  basicType([WORKLOAD_CLASSIC], WORKLOAD_GROUP);

  // Negative weight sorts it below the shell's own entries in the group.
  weightType(WORKLOAD_CLASSIC, -100, true);
}
