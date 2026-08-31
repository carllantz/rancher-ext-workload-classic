# Workload Classic — Rancher UI Extension Design

- **Date:** 2026-08-30
- **Status:** Approved design, pending implementation plan
- **Target:** Rancher 2.14, 2.15, 2.16+
- **Repo:** https://github.com/carllantz/rancher-ext-workload-classic

## Problem

Rancher's Cluster Explorer used to have an aggregate **Workloads** page at
`/c/<cluster>/explorer/workload`: a single sortable table listing every workload
across all types — Deployments, DaemonSets, StatefulSets, ReplicaSets,
ReplicationControllers, Jobs, CronJobs and standalone Pods.

That page is no longer reachable. The Workload Dashboard added in 2.15 is a
counts-and-status overview, not a resource list, so it does not replace the
flat table for the "show me everything running, in one place, sortable" use
case.

This extension restores the original page.

## Goals

- Restore the aggregate workload list with its original columns and semantics.
- Work identically on Rancher 2.14, 2.15 and 2.16+ from a single build.
- Ship as an installable Rancher extension (Helm chart via the extension catalog).

## Non-goals

- Replacing or modifying the 2.15 Workload Dashboard. Both coexist.
- Scaling to very large clusters. The original page's fetch-everything design is
  reproduced deliberately; see [Scale](#scale-and-its-limits).
- Server-side pagination for the aggregate view. It is not achievable across
  heterogeneous types; see [Why not server-side pagination](#why-not-server-side-pagination).

## Background: how the page disappeared

Three upstream changes, none of which is what the version numbers suggest:

| PR | Milestone | Effect |
|---|---|---|
| [#10795](https://github.com/rancher/dashboard/pull/10795) | v2.9.0 | Added `ifFeature: '!ui-sql-cache'` to the Workloads `virtualType`, hiding the nav entry whenever the VAI SQL cache is on |
| [#17728](https://github.com/rancher/dashboard/pull/17728) | v2.15.0 | Added the Workload Dashboard as the intended replacement |
| [#18450](https://github.com/rancher/dashboard/pull/18450) | v2.16.0 | Removed the `ui-sql-cache` flag entirely, deleting the nav entry, `configureType` location and `headers(WORKLOAD, …)` |

The rationale is recorded in issue
[#11513](https://github.com/rancher/dashboard/issues/11513): *"The workloads list
fetches all sub types (deployments, pods, etc). This does not scale and needs to
be removed. We should replace this with a useful overview page."*

The page was therefore never "broken" — it was switched off for scale reasons,
then deleted once the flag went away. Restoring it means accepting that scale
characteristic knowingly.

### What the shell still provides

| | 2.14 | 2.15 | 2.16+ |
|---|:--:|:--:|:--:|
| `WORKLOAD` in nav `basicType` | yes | yes | removed |
| `configureType(WORKLOAD, …)` route location | yes | yes | removed |
| `headers(WORKLOAD, …)` columns | yes | yes | removed |
| `virtualType` nav entry | gated off | gated off | removed |
| `shell/list/workload.vue` | yes | yes | yes (per-type only) |

Because the four registrations exist on 2.14/2.15 but not 2.16, the extension
supplies its **own** copy of each and never depends on shell state that varies
by version. One build, three Rancher versions, identical behaviour.

## Design

### Registration

The extension registers into the **existing** `explorer` product rather than
creating a product of its own, following the pattern in
`pkg/rancher-prime/config/navigation.ts`:

```ts
const { virtualType, basicType, weightType, configureType, headers } =
  $extension.DSL(store, 'explorer');
```

| Concern | Value |
|---|---|
| Type id | `workload-classic` |
| Nav label | **All Workloads** |
| URL | `/c/:cluster/explorer/workload-classic` |
| Nav position | Bottom of the existing Workloads group (`weightType(…, -100, true)`) |

A distinct type id avoids any collision with the shell's own `workload`
registrations, which still exist (merely gated) on 2.14 and 2.15. Reusing
`workload` would produce two identical nav entries for anyone who disables
`ui-sql-cache` on those versions.

### Routing through the generic resource list

Rather than a bespoke page route, the extension registers a **custom list
component for a schema-less type** and routes through the shell's generic
`c-cluster-product-resource` route — the same mechanism the original page used:

```ts
configureType('workload-classic', {
  location: {
    name:   'c-cluster-product-resource',
    params: { resource: 'workload-classic' },
  },
});
```

This inherits the standard masthead, namespace/project filter, mass actions and
table chrome, which is most of what makes the page feel native.

`workload-classic` has no backing Kubernetes schema. That is supported, not
incidental — verified on master:

- `ResourceList/index.vue:110` applies its schema-listability guard only
  `if (!this.hasListComponent)`.
- `ResourceList/index.vue:170` falls through to the component's own headers when
  a custom list component is registered.

The component fabricates a schema stub for `ResourceTable`, exactly as the
original did.

### Files

```
pkg/workload-classic/
├── index.ts                     plugin entry: importTypes + product init
├── config/workload-classic.ts   DSL registrations
├── list/workload-classic.vue    ported list component  ← the only substantial file
└── l10n/en-us.yaml              nav label, column labels
```

`importTypes(plugin)` auto-registers the `list/` and `l10n/` folders by
convention (`shell/pkg/auto-import.js:3`), so the component needs no explicit
wiring — the filename *is* the registration.

### Data flow

A port of `shell/list/workload.vue` as it stood at `v2.9.0`:

1. Build a schema stub: `{ id: 'workload-classic', type: SCHEMA, attributes: { kind: 'Workload', namespaced: true } }`.
2. `$fetchType` each member of `LIST_WORKLOAD_TYPES` for which the user has a
   schema — Deployment, DaemonSet, StatefulSet, ReplicaSet, ReplicationController,
   Job, CronJob, Pod (eight types: `WORKLOAD_TYPES` has seven members, plus Pod).
   Types the user cannot list are skipped, so RBAC is respected without error.
3. Fetch `NODE` (for endpoint resolution) and `POD`/`JOB` (for health). In
   practice pods and jobs are already loaded by step 2; see
   [Decisions](#decision-keep-the-health-column).
4. Flatten all rows and drop those where `row.ownedByWorkload`. This is what
   hides Deployment-owned ReplicaSets and workload-owned Pods, leaving top-level
   workloads plus standalone pods.
5. Render one `<ResourceTable>`.

### Columns

Matching `headers(WORKLOAD, …)` as it stood on 2.14/2.15:

`State`, `Name`, `Namespace`, `Type`, `Images`, `Endpoints`, `Restarts`, `Age`, `Health`

## Decisions

### Decision: keep the health column

**Keep it.**

`WORKLOAD_HEALTH_SCALE` renders from `row.podGauges`, which resolves through
`matchingLabelSelector(POD, …)` — a **store getter, not a fetch**. It reports on
whatever pods are already cached and silently under-reports when they are not.

That weakness is why upstream added `includeAssociatedData=true`
(`shell/list/workload.vue:124`), which has the backend embed pod stats in the
workload response. **That fix is unavailable here:**

- It is constructed only in the pagination param builder
  (`steve-pagination-utils.ts:537`), and `actions.js` forwards it only when
  `opt.pagination` is set — so it requires server-side pagination, which this
  page cannot use.
- It does not exist in 2.14 at all (absent from `release-2.14`, present in
  `release-2.15`).

Keeping the column is nonetheless right:

1. **It costs no extra network.** `LIST_WORKLOAD_TYPES` is
   `{...WORKLOAD_TYPES, POD}` — pods and jobs are fetched anyway to render rows.
2. **This is the one page where it is accurate.** Because all pods are loaded,
   the selector matching is complete. On paginated per-type lists it is not.
3. It is the main thing the 2.15 dashboard cannot give you: health across every
   workload type in one table.

The real cost is CPU, not network: label-selector matching is roughly
`workloads × pods` comparisons at render. The column sets `delayLoading: true`,
deferring that off the initial paint.

### Decision: keep the NODE fetch

**Keep it.** This reverses an earlier call to drop it.

`Endpoints.vue:21-28` uses nodes to resolve NodePort endpoints. With node data an
endpoint renders as a clickable `http://<external-ip>:30080`; without it, it
degrades to the placeholder `[Any Node]:30080`. Endpoints carrying explicit
`addresses` are unaffected either way.

Nodes number in the tens against thousands of pods, making this the cheapest
fetch on the page — and the only one whose removal is visible to users. Trimming
it was a bad trade.

### Why not server-side pagination

The aggregate view spans eight resource types. Steve paginates one type per
request, so there is no server-side ordering across the union. Any paginated
implementation would have to merge per-type pages client-side, making
cross-type sorting and filtering approximate. That is a materially different
page from the one being restored, and out of scope.

## Scale and its limits

Per page load: eight `findAll` calls (one per workload type, including pods),
plus `NODE`. All rows are held in the Vuex `cluster` store and filtered and
sorted client-side.

**The cliff is pods, not workloads.** A cluster with 200 Deployments across
20,000 Pods will hurt considerably more than one with 2,000 Deployments across
4,000 Pods, because pod count drives both the largest fetch and the
`workloads × pods` matching cost.

This is understood and accepted: it is the same characteristic the original page
had, and the reason upstream removed it. Target is small-to-medium clusters.

If it ever needs guardrails, the natural first step is to require a
namespace/project filter before fetching, rather than to page across types.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Shell internals shift again (the schema-less + custom-list path already changed once) | Medium | Extension owns all four registrations; only the `c-cluster-product-resource` route and `ResourceTable` props are shell contracts. Both are widely used and stable. |
| `ResourceList` tightens the schema-less path in a future release | Low | Fallback is a standalone page route with a hand-rolled masthead — more code, no behaviour change. |
| Health under-reports if a pod fetch fails | Low | Pods are fetched as displayed rows, so a failure is visible as missing rows, not silently wrong health alone. |
| Client-side matching cost on pod-heavy clusters | Medium | `delayLoading: true` defers it; documented in README so operators know the shape of the limit. |

## Testing

**Unit (Jest, in-repo):**

- `ownedByWorkload` filtering: Deployment-owned ReplicaSets and workload-owned
  Pods excluded; standalone Pods and top-level workloads retained.
- RBAC-aware type selection: types without a schema are skipped rather than
  throwing, and an empty allowed-type list degrades to an empty table.

**Manual matrix — 2.14, 2.15, 2.16:**

- Nav entry appears at the bottom of the Workloads group, labelled All Workloads.
- Page loads at `/c/<cluster>/explorer/workload-classic`.
- Columns match the original set.
- Namespace/project filter and mass actions behave as on native list pages.
- On 2.15/2.16, coexists with the Workload Dashboard without duplicate entries.

**Not covered:** end-to-end tests. They would require a live cluster per Rancher
version; the manual matrix stands in for them deliberately rather than shipping
tests that never run.

## Licensing

`list/workload-classic.vue` is a derivative of `shell/list/workload.vue` from
rancher/dashboard (Apache-2.0). The repo is Apache-2.0 and the file carries an
attribution header naming its upstream origin and the `v2.9.0` tag it was taken
from.
