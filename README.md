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

Verified end to end against Rancher v2.15.0 with `ui-sql-cache` enabled — the
configuration in which the shell's own Workloads entry is hidden.

## Installation

Rancher's extension support must be enabled first: **☰ → Extensions**, then
**Enable** if you have not used extensions on this cluster before.

### Option A — Helm repository (recommended)

The repository ships a workflow that publishes a Helm chart repository, but it
only runs on a GitHub release, so one has to be cut first.

1. Set the version you want in `pkg/workload-classic/package.json`.
2. Create a GitHub release whose tag is exactly `workload-classic-<version>`,
   for example `workload-classic-0.1.0`. The tag has to match
   `<pkg folder name>-<version>`; on any other tag the workflow cancels itself.
3. The **Build and Release Extension Charts** workflow publishes the chart
   repository to the `gh-pages` branch. Enable GitHub Pages for that branch
   (Settings → Pages → Source: `gh-pages`).
4. In Rancher, go to **Extensions → ⋮ → Manage Repositories → Create**, choose
   **http(s)**, and enter the Pages URL:
   `https://<owner>.github.io/rancher-ext-workload-classic`
5. Back on **Extensions → Available**, install **Workload Classic**.
6. Reload the page. **All Workloads** appears at the bottom of the Workloads
   group in Cluster Explorer.

### Option B — developer load (no release needed)

Useful for trying it out, and the quickest path on an air-gapped or private
cluster.

```sh
yarn install
yarn build-pkg workload-classic
yarn serve-pkgs
```

`serve-pkgs` serves the built extension on port 4500. In Rancher, go to
**Extensions → ⋮ → Developer load** and enter:

```
http://127.0.0.1:4500/workload-classic-0.1.0/workload-classic-0.1.0.umd.min.js
```

The browser fetches that URL, not the Rancher server, so `127.0.0.1` works as
long as you are running the command on the same machine as the browser. Adjust
the version in the path if you change it.

### A note on the catalog workflow

`build-extension-catalog.yml` publishes an OCI catalog image to `ghcr.io`, but
it validates the release tag against the **root** `package.json`
(`wc-dev-app-<version>`), whereas the chart workflow validates against the
package folder (`workload-classic-<version>`). A single release cannot satisfy
both while the root package is named `wc-dev-app`; rename it if you want the
catalog image as well.

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

`yarn dev` serves the dashboard with this extension loaded at
https://127.0.0.1:8005.

Type checking is not part of the dev server; run it explicitly:

```sh
./node_modules/.bin/tsc -p pkg/workload-classic/tsconfig.json --noEmit
```

## Licence

Apache-2.0. `pkg/workload-classic/list/workload-classic.vue` is derived from
`shell/list/workload.vue` in [rancher/dashboard](https://github.com/rancher/dashboard)
at tag `v2.9.0`, also Apache-2.0.
