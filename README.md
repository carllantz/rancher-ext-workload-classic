> [!CAUTION]
> This is just a POC and should be treated as such.


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

Verified on an installed build against Rancher v2.15.0 with `ui-sql-cache`
enabled — the configuration in which the shell's own Workloads entry is hidden.

## Installation

The chart is already published. Installing is two steps in the Rancher UI: add
the repository, then install the extension from it. Nothing needs building and
no command line is involved.

**Prerequisite.** Rancher's extension support must be turned on for the cluster.
Go to **☰ → Extensions**; if you are prompted to enable extensions, do that
first and wait for it to finish.

### 1. Add the repository

1. **☰ → Extensions**
2. Open the **⋮** menu at the top right and choose **Manage Repositories**
3. Click **Create**
4. Leave the target as **Helm Repository** — "HTTP(S) URL pointing to a Helm
   chart repository index", which is the default
5. Fill in:

   | Field | Value |
   |---|---|
   | Name | `workload-classic` |
   | Index URL | `https://carllantz.github.io/rancher-ext-workload-classic` |

6. Click **Create**

The repository turns **Active** within a few seconds, once Rancher has fetched
the index.

### 2. Install the extension

1. Go back to **☰ → Extensions** and select the **Available** tab
2. Find the **workload-classic** card
3. Open its **⋮** menu and choose **Install**
4. Confirm the version and click **Install**

### 3. Reload

Reload the browser once the install completes. **All Workloads** appears at the
bottom of the **Workloads** group in Cluster Explorer, and the page itself is at
`/c/<cluster>/explorer/workload-classic`.

To upgrade later, use **Upgrade** in the same **⋮** menu. If a newly published
version does not appear, select the repository under **Manage Repositories** and
click **Refresh** — Rancher only re-reads the index periodically.

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

**`yarn dev` does not behave like an installed extension.** In development the
package is compiled into the host application and shares its module instances;
when installed it is a separate UMD bundle with its own copies of whatever it
imports from `@shell`. Anything depending on shell state that is populated at
host boot — the `SortableTable` formatter map is one — works in `yarn dev` and
fails once installed. Verify changes against a real install, or reproduce the
split locally: set `excludes: ['workload-classic']` in the root `vue.config.js`
so the dev server does not bundle the package, then load the built UMD through
**Extensions → ⋮ → Developer load**.

### Trying a local build on a cluster

Build it and serve it, then point Rancher's developer load at it — no release
required:

```sh
yarn build-pkg workload-classic
yarn serve-pkgs
```

`serve-pkgs` serves the built extension on port 4500. In Rancher, go to
**Extensions → ⋮ → Developer load** and enter:

```
http://127.0.0.1:4500/workload-classic-0.1.3/workload-classic-0.1.3.umd.min.js
```

The browser fetches that URL, not the Rancher server, so `127.0.0.1` works as
long as you run the command on the same machine as the browser. Adjust the
version in the path to match what you built. **Developer load** only appears
once **Enable Extension developer features** is ticked under user preferences.

## Releasing

Only needed if you fork this repository and want to publish your own charts.
The workflow that publishes the Helm repository runs on a GitHub release.

1. Set the version in `pkg/workload-classic/package.json`.
2. **Create the `gh-pages` branch first if it does not exist.** The publish
   script does not create it and fails with `'gh-pages' branch not found, this
   branch must exist before running this script`. An empty orphan branch is
   enough, and touches neither your checkout nor `HEAD`:

   ```sh
   EMPTY_TREE=$(git hash-object -t tree /dev/null)
   COMMIT=$(git commit-tree "$EMPTY_TREE" -m "Initialize gh-pages")
   git update-ref refs/heads/gh-pages "$COMMIT"
   git push origin gh-pages
   ```

3. Create a GitHub release whose tag is exactly `workload-classic-<version>`,
   for example `workload-classic-0.1.3`. The tag has to match
   `<pkg folder name>-<version>`; on any other tag the workflow cancels itself.
4. The **Build and Release Extension Charts** workflow publishes the chart
   repository to `gh-pages`. GitHub usually enables Pages automatically when
   that branch first appears; if not, set Settings → Pages → Source to
   `gh-pages`. Your index is then served at
   `https://<owner>.github.io/<repo>`.

`build-extension-catalog.yml` publishes an OCI catalog image to `ghcr.io`, but
it validates the release tag against the **root** `package.json`
(`wc-dev-app-<version>`), whereas the chart workflow validates against the
package folder (`workload-classic-<version>`). A single release cannot satisfy
both while the root package is named `wc-dev-app`; rename it if you want the
catalog image as well.

## Licence

Apache-2.0. `pkg/workload-classic/list/workload-classic.vue` is derived from
`shell/list/workload.vue` in [rancher/dashboard](https://github.com/rancher/dashboard)
at tag `v2.9.0`, also Apache-2.0.
