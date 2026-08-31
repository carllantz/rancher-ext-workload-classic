/**
 * A row as returned by the cluster store. Only the field this module needs is
 * declared; models carry many more.
 */
export interface WorkloadRow {
  ownedByWorkload?: boolean;
}

/**
 * Flatten per-type row buckets into a single list, dropping any row owned by
 * another workload.
 *
 * This is what hides Deployment-owned ReplicaSets and workload-owned Pods, so
 * the table shows top-level workloads plus standalone pods — matching the
 * original aggregate page.
 *
 * Buckets may be null or undefined when a type failed to load or the user
 * lacks access; those are skipped rather than throwing.
 */
export function filterTopLevelRows<T extends WorkloadRow>(
  resources: (T[] | null | undefined)[]
): T[] {
  const out: T[] = [];

  for (const typeRows of resources) {
    if (!typeRows) {
      continue;
    }

    for (const row of typeRows) {
      if (!row.ownedByWorkload) {
        out.push(row);
      }
    }
  }

  return out;
}

/**
 * Narrow a list of resource types to those the user can actually list.
 *
 * RBAC is expressed through schema availability: no schema means no access, so
 * fetching that type would 403. Filtering up front keeps the page working for
 * restricted users instead of erroring.
 */
export function allowedWorkloadTypes(
  types: string[],
  hasSchema: (type: string) => boolean
): string[] {
  return types.filter((type) => hasSchema(type));
}
