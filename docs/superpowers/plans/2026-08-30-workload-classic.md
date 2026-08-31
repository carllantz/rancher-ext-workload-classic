# Workload Classic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Rancher UI extension that restores the aggregate Cluster Explorer workloads list removed upstream, working on Rancher 2.14, 2.15 and 2.16+ from one build.

**Architecture:** A single extension package registers into the **existing** `explorer` product via `$plugin.DSL(store, 'explorer')`, supplying its own nav entry, route location, column headers and list component. The page routes through the shell's generic `c-cluster-product-resource` route using a schema-less type id (`workload-classic`) with a custom list component — the same mechanism the original page used. All row-selection logic lives in pure TypeScript functions so it is unit-testable without mounting Vue or the shell.

**Tech Stack:** Vue 3, TypeScript, `@rancher/shell` (via the generated dev app), Jest + ts-jest for unit tests, Yarn.

**Spec:** `docs/superpowers/specs/2026-08-30-workload-classic-extension-design.md`

**Deviation from the spec:** the spec lists four files; this plan adds a fifth,
`pkg/workload-classic/utils/rows.ts`. Extracting the row-filter and type-selection
logic into pure functions is what makes the spec's two required unit tests
runnable with ts-jest alone — no Vue mounting, no `@rancher/shell` module
resolution, no Vuex store. Behaviour is unchanged.

## Global Constraints

- Target Rancher versions: **2.14, 2.15, 2.16+**. One build must work on all three.
- The extension supplies its **own** `virtualType`, `configureType`, `headers` and list component. Never rely on the shell's `workload` registrations — they exist on 2.14/2.15 but are deleted on 2.16.
- Type id is exactly `workload-classic`. Nav label is exactly **All Workloads**. URL is `/c/:cluster/explorer/workload-classic`.
- Nav position: bottom of the existing `workload` group — `weightType(WORKLOAD_CLASSIC, -100, true)`.
- Keep the health column. Keep the `NODE` fetch. Both decisions are justified in the spec; do not "optimise" them away.
- Do not add server-side pagination to the aggregate view.
- Licence is Apache-2.0. Any file derived from `rancher/dashboard` carries an attribution header.
- Never modify `LICENSE` or the existing `docs/` tree.

---

### Task 1: Scaffold the dev app and extension package

Generates the Rancher extension dev app at the repo root with the extension package at `pkg/workload-classic`. The generator only writes into an empty directory, so it runs in a temp dir and its output is copied in, preserving the repo's existing `LICENSE`, `README.md` and `docs/`.

**Files:**
- Create: `package.json`, `vue.config.js`, `babel.config.js`, `tsconfig.json`, `eslint.config.mjs`, `.nvmrc`, `.yarnrc`, `.gitignore`, `.github/workflows/*` (all generated)
- Create: `pkg/workload-classic/package.json`, `pkg/workload-classic/index.ts`, `pkg/workload-classic/vue.config.js`, `pkg/workload-classic/tsconfig.json` (all generated)

**Interfaces:**
- Consumes: nothing.
- Produces: a working dev app; the extension entry point `pkg/workload-classic/index.ts` exporting `default function(plugin: IPlugin): void`.

- [ ] **Step 1: Generate the app in a temp directory**

The generator creates a folder named after the app. Use a distinct app name so the extension package is named `workload-classic`:

```bash
cd /tmp && rm -rf wc-scaffold && mkdir wc-scaffold && cd wc-scaffold
npm init @rancher/extension@latest workload-classic -- --app-name wc-dev-app
```

Expected: creates `/tmp/wc-scaffold/wc-dev-app/` containing `pkg/workload-classic/`.

- [ ] **Step 2: Copy the scaffold into the repo, preserving existing files**

```bash
cd /tmp/wc-scaffold/wc-dev-app
# Remove a generated README, which would clobber ours
rm -f README.md
cp -R ./. /Users/sirdopes/git/rancher-ext-workload-classic/
cd /Users/sirdopes/git/rancher-ext-workload-classic
ls LICENSE README.md docs pkg/workload-classic/index.ts
```

Expected: all four paths exist. If `LICENSE`, `README.md` or `docs` is missing, stop — the copy overwrote repo files.

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/sirdopes/git/rancher-ext-workload-classic
nvm use    # use the Node version in the generated .nvmrc
yarn install
```

Expected: completes without errors.

- [ ] **Step 4: Verify the dev app boots**

```bash
API=<your-rancher-url> yarn dev
```

Expected: server starts and https://127.0.0.1:8005 serves the Rancher UI. Log in and confirm Cluster Explorer loads. Stop the server before continuing.

This is a manual gate — there is no automated substitute for "the dev app runs".

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Scaffold Rancher extension dev app and workload-classic package"
```

---

### Task 2: Pure row-selection utilities, test-first

The two pieces of real logic — which types to fetch, and which rows to display — are extracted into pure functions taking plain data. This keeps them testable with ts-jest alone: no Vue mounting, no `@rancher/shell` module resolution, no Vuex store.

**Files:**
- Create: `jest.config.js`
- Create: `pkg/workload-classic/utils/rows.ts`
- Test: `pkg/workload-classic/utils/__tests__/rows.test.ts`
- Modify: `package.json` (add `test` script and dev dependencies)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `WorkloadRow` — interface `{ ownedByWorkload?: boolean }`
  - `filterTopLevelRows<T extends WorkloadRow>(resources: (T[] | null | undefined)[]): T[]`
  - `allowedWorkloadTypes(types: string[], hasSchema: (type: string) => boolean): string[]`

  Task 4 imports both functions from `../utils/rows`.

`utils/` is deliberately not one of the shell's auto-imported folders (`shell/pkg/auto-import.js` registers `chart`, `cloud-credential`, `content`, `detail`, `edit`, `list`, `machine-config`, `models`, `promptRemove`, `l10n`, `windowComponents`, `dialog`, `formatters`, `login`), so nothing there is mistaken for a resource type.

- [ ] **Step 1: Add test tooling**

```bash
cd /Users/sirdopes/git/rancher-ext-workload-classic
yarn add --dev jest@^29 ts-jest@^29 @types/jest@^29 typescript
```

Add to `package.json` `"scripts"`:

```json
"test": "jest"
```

- [ ] **Step 2: Create the Jest config**

Create `jest.config.js`:

```js
module.exports = {
  preset:          'ts-jest',
  testEnvironment: 'node',
  testMatch:       ['<rootDir>/pkg/**/__tests__/**/*.test.ts'],
};
```

`testEnvironment: 'node'` is correct here — these are pure functions with no DOM.

- [ ] **Step 3: Write the failing tests**

Create `pkg/workload-classic/utils/__tests__/rows.test.ts`:

```ts
import { filterTopLevelRows, allowedWorkloadTypes } from '../rows';

describe('filterTopLevelRows', () => {
  it('keeps rows that are not owned by a workload', () => {
    const rows = [[{ id: 'a', ownedByWorkload: false }, { id: 'b' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([
      { id: 'a', ownedByWorkload: false },
      { id: 'b' },
    ]);
  });

  it('drops rows owned by a workload', () => {
    const rows = [[{ id: 'rs', ownedByWorkload: true }, { id: 'deploy' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'deploy' }]);
  });

  it('flattens across type buckets', () => {
    const rows = [[{ id: 'a' }], [{ id: 'b' }]];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('skips buckets that failed to load', () => {
    const rows = [null, [{ id: 'a' }], undefined];

    expect(filterTopLevelRows(rows)).toStrictEqual([{ id: 'a' }]);
  });

  it('returns an empty array when nothing loaded', () => {
    expect(filterTopLevelRows([])).toStrictEqual([]);
  });
});

describe('allowedWorkloadTypes', () => {
  it('keeps only types the user has a schema for', () => {
    const hasSchema = (type: string) => type !== 'batch.job';

    expect(allowedWorkloadTypes(['apps.deployment', 'batch.job'], hasSchema))
      .toStrictEqual(['apps.deployment']);
  });

  it('returns an empty array when the user can see nothing', () => {
    expect(allowedWorkloadTypes(['apps.deployment'], () => false)).toStrictEqual([]);
  });

  it('returns an empty array for no input types', () => {
    expect(allowedWorkloadTypes([], () => true)).toStrictEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
yarn test
```

Expected: FAIL — `Cannot find module '../rows'`.

- [ ] **Step 5: Write the implementation**

Create `pkg/workload-classic/utils/rows.ts`:

```ts
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
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
yarn test
```

Expected: PASS — 8 tests.

- [ ] **Step 7: Commit**

```bash
git add jest.config.js package.json yarn.lock pkg/workload-classic/utils/
git commit -m "Add pure row-selection utilities with unit tests"
```

---

### Task 3: Register the nav entry, route location and columns

Registers `workload-classic` into the existing `explorer` product. After this task the nav entry appears and the route resolves; the page itself renders empty until Task 4 supplies the component.

**Files:**
- Create: `pkg/workload-classic/config/workload-classic.ts`
- Create: `pkg/workload-classic/l10n/en-us.yaml`
- Modify: `pkg/workload-classic/index.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `WORKLOAD_CLASSIC` — the string constant `'workload-classic'`, exported from `config/workload-classic.ts`. Task 4 imports it.
  - `init($plugin: IPlugin, store: any): void` — exported from `config/workload-classic.ts`, called by `index.ts`.

- [ ] **Step 1: Write the product configuration**

Create `pkg/workload-classic/config/workload-classic.ts`:

```ts
import { IPlugin } from '@shell/core/types';
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
    virtualType, basicType, weightType, configureType, headers,
  } = $plugin.DSL(store, EXPLORER);

  const route = {
    name:   RESOURCE_ROUTE,
    params: { resource: WORKLOAD_CLASSIC },
  };

  configureType(WORKLOAD_CLASSIC, { location: route });

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

  virtualType({
    labelKey:   'workloadClassic.nav.label',
    name:       WORKLOAD_CLASSIC,
    namespaced: true,
    icon:       'folder',
    route,
  });

  basicType([WORKLOAD_CLASSIC], WORKLOAD_GROUP);

  // Negative weight sorts it below the shell's own entries in the group.
  weightType(WORKLOAD_CLASSIC, -100, true);
}
```

- [ ] **Step 2: Add the translation**

Create `pkg/workload-classic/l10n/en-us.yaml`:

```yaml
workloadClassic:
  nav:
    label: All Workloads
```

- [ ] **Step 3: Wire it into the plugin entry point**

Replace the contents of `pkg/workload-classic/index.ts`:

```ts
import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';
import { init } from './config/workload-classic';

// Init the package
export default function(plugin: IPlugin): void {
  // Auto-imports list/ and l10n/ by folder convention
  importTypes(plugin);

  // Provide plugin metadata from package.json
  plugin.metadata = require('./package.json');

  // The module exports `init(plugin, store)`; the shell calls it during load.
  plugin.addProduct(require('./config/workload-classic'));
}
```

Why this exact form, rather than passing a function or product metadata:

- `addProduct` branches on `product?.name`. A module with no `name` export falls
  through to `this.products.push(...)` and returns early
  (`shell/core/plugin.ts:156-159`), skipping the "addProduct can only be called
  once per product" guard — which is what makes it safe to target the existing
  `explorer` product.
- The shell then calls `impl.init(plugin, store)` on each registered module
  (`shell/core/extension-manager-impl.js:513-518`).
- External extensions are loaded *after* built-ins, deliberately, "so that core
  + builtin products are registered first and available for extending"
  (`extension-manager-impl.js:509-511`). So `explorer` always exists by the time
  `init` runs.
- `pkg/rancher-prime/index.ts:83` uses this same `addProduct(require(...))` form.

Do not add a `name` export to `config/workload-classic.ts` — that would push it
down the new-product branch and throw on the already-registered `explorer`.

- [ ] **Step 4: Verify the nav entry appears**

```bash
API=<your-rancher-url> yarn dev
```

Navigate to Cluster Explorer. Expected: **All Workloads** appears at the bottom of the Workloads group, below Pods. Clicking it navigates to `/c/<cluster>/explorer/workload-classic`.

The page will render an empty table or a "not listable" message at this point — that is expected until Task 4. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add pkg/workload-classic/config pkg/workload-classic/l10n pkg/workload-classic/index.ts
git commit -m "Register All Workloads nav entry, route and columns"
```

---

### Task 4: The aggregate list component

Ports the list component from `rancher/dashboard` at tag `v2.9.0`, using the utilities from Task 2. Registering a custom list component is also what makes the schema-less type legal: `ResourceList/index.vue` applies its listability guard only `if (!this.hasListComponent)`.

**Files:**
- Create: `pkg/workload-classic/list/workload-classic.vue`
- Modify: `README.md`

**Interfaces:**
- Consumes: `filterTopLevelRows`, `allowedWorkloadTypes` from `../utils/rows` (Task 2); `WORKLOAD_CLASSIC` from `../config/workload-classic` (Task 3).
- Produces: the list component registered for type `workload-classic` by `importTypes`.

- [ ] **Step 1: Write the component**

Create `pkg/workload-classic/list/workload-classic.vue`:

```vue
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
const schema = {
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
      schema,
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

  // Drives the loading indicator
  $loadingResources($route, $store) {
    return $loadingResources($route, $store);
  },

  typeDisplay() {
    return this.$store.getters['type-map/labelFor'](this.schema, 99);
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
```

- [ ] **Step 2: Verify the unit tests still pass**

```bash
yarn test
```

Expected: PASS — 8 tests. The component imports the utilities but does not change them; this confirms no regression.

- [ ] **Step 3: Verify the page renders**

```bash
API=<your-rancher-url> yarn dev
```

Navigate to Cluster Explorer → **All Workloads**. Verify each:

- Rows appear for Deployments, DaemonSets, StatefulSets, Jobs, CronJobs and standalone Pods.
- ReplicaSets owned by a Deployment are **absent**; a standalone ReplicaSet is present.
- Pods owned by a workload are **absent**; standalone pods are present.
- Columns are: State, Name, Namespace, Type, Images, Endpoints, Restarts, Age, Health.
- The Health column populates (it loads slightly after the table — `delayLoading` is set).
- The namespace/project filter changes the row set.
- Selecting rows offers the standard mass actions.

- [ ] **Step 4: Document the extension**

Replace `README.md` with:

```markdown
# Workload Classic

A Rancher UI extension that restores the aggregate **Workloads** list to Cluster
Explorer — one sortable table of every Deployment, DaemonSet, StatefulSet,
ReplicaSet, ReplicationController, Job, CronJob and standalone Pod.

Rancher hid this page in v2.9.0 ([PR #10795](https://github.com/rancher/dashboard/pull/10795))
whenever the `ui-sql-cache` feature flag is enabled, and removed it entirely in
v2.16.0 ([PR #18450](https://github.com/rancher/dashboard/pull/18450)). The
Workload Dashboard added in v2.15.0 is a counts-and-status overview rather than
a resource list, so it does not serve the same purpose.

Installs as **All Workloads** at the bottom of the Workloads group.

## Supported Rancher versions

2.14, 2.15, 2.16+.

## Scale

This page fetches every workload type, including all pods, and filters and sorts
client-side. That is the original page's design and the reason Rancher removed
it.

**The limit is driven by pod count, not workload count** — pods are both the
largest fetch and the input to the health column's client-side label-selector
matching. It suits small-to-medium clusters. On pod-heavy clusters expect slow
loads.

## Development

```sh
yarn install
API=<your-rancher-url> yarn dev
yarn test
```

## Licence

Apache-2.0. `pkg/workload-classic/list/workload-classic.vue` is derived from
`shell/list/workload.vue` in [rancher/dashboard](https://github.com/rancher/dashboard)
at tag `v2.9.0`, also Apache-2.0.
```

- [ ] **Step 5: Commit**

```bash
git add pkg/workload-classic/list README.md
git commit -m "Add aggregate workloads list component"
```

---

## Verification

After all four tasks:

- [ ] `yarn test` passes (8 tests).
- [ ] `yarn lint` passes.
- [ ] Manual matrix — repeat Task 4 Step 3 against **2.14, 2.15 and 2.16**. On 2.15 and 2.16 additionally confirm **All Workloads** and the shell's **Workload Dashboard** both appear, with no duplicate entries.
- [ ] Confirm the shell's own `workload` entry does **not** appear alongside ours on a 2.14 or 2.15 cluster with `ui-sql-cache` disabled.

No end-to-end tests: they would need a live cluster per Rancher version. The manual matrix stands in deliberately, rather than shipping tests that never run.
