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
