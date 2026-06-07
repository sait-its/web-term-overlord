# Overlord Helm Chart

This chart deploys Overlord into the `sandbox-overlord` namespace with the dynamic Democratic CSI iSCSI PVC currently used by `web-term-overlord`.

## Install or Upgrade

From this `overlord` directory:

```shell
helm upgrade --install overlord . --namespace sandbox-overlord --create-namespace
```

If the PVC already exists and should not be managed by this release:

```shell
helm upgrade --install overlord . \
  --namespace sandbox-overlord \
  --set persistence.create=false
```

If the existing Deployment, Service, or NetworkPolicy was created with `kubectl apply`, delete or adopt those resources before installing the chart. Helm will not take ownership of pre-existing resources unless they have the Helm ownership metadata.

Render the manifests without applying them:

```shell
helm template overlord .
```

Validate the chart:

```shell
helm lint .
```

## Roll Out Images

Use the update script to run a Helm upgrade and wait for the backend Deployment rollout:

```shell
./update-overlord-images.sh
```

The script defaults to `hongsait/overlord:latest` and forces a backend rollout by updating the backend pod template restart annotation through Helm.

Set `UPDATE_FRONTEND=true` when the web terminal image/config also changed:

```shell
UPDATE_FRONTEND=true ./update-overlord-images.sh
```

The frontend uses an iSCSI `ReadWriteOnce` PVC, so its Deployment uses `strategy.type: Recreate`.

## Export Data

Export a snapshot of the Overlord web terminal PVC root:

```shell
./export-overlord-data.sh
```

The script creates a `VolumeSnapshot`, restores it into a temporary PVC, mounts that restored PVC read-only in a helper pod, streams a compressed tar archive locally, and removes the temporary Kubernetes resources on exit. Backups are written to `overlord/backups/` by default.

Override the output file when needed:

```shell
OUTPUT_FILE=/tmp/overlord-data.tar.gz ./export-overlord-data.sh
```

## Import Data

Import a previously exported archive into the Overlord web terminal PVC:

```shell
./import-overlord-data.sh backups/overlord-data-20260607T000000Z.tar.gz
```

By default, the script scales `web-term-overlord-deployment` to `0`, waits for web terminal pods to terminate, mounts `apps-web-term-overlord-iscsi-pvc` in a helper pod, clears the PVC root, extracts the archive, removes the helper pod, and restores the original replica count.

Set `CLEAR_EXISTING=false` to overlay the archive without deleting existing files first. Set `QUIESCE=false` only if you intentionally want to import while the web terminal is running.

## Values

The default values preserve the existing manifest behavior:

- Namespace: `sandbox-overlord`
- Backend Deployment: `overlord-backend-deployment`
- Backend Service: `overlord-backend-service`
- Backend image: `hongsait/overlord:latest`
- Frontend Deployment: `web-term-overlord-deployment`
- Frontend Service: `web-term-overlord-service`
- Frontend image: `hongsait/web-term-overlord:latest`
- PVC: `apps-web-term-overlord-iscsi-pvc`
- PVC storage class: `iscsi`
- PVC size: `1Gi`
- NetworkPolicy: `isolate-student-backend`

The dynamic PVC is dedicated to `web-term-overlord`. Since the app mounts a single database file at `/app/logs.db`, the deployment keeps `subPath`, but the path is relative to the root of the dynamic PVC:

```yaml
subPath: logs.db
```

Do **not** reintroduce the old shared-path layout:

```yaml
subPath: apps/web-term-overlord/logs.db
```

## Security

The chart installs the backend isolation `NetworkPolicy` by default.

It allows only pods labeled `app=web-term-overlord` in the same namespace to connect to the backend on TCP/2222, and it denies all backend egress. This keeps the backend focused on accepting SSH traffic from the frontend and prevents outbound network access from the backend pod.

NetworkPolicy enforcement depends on the cluster CNI. CNIs such as Cilium, Calico, and Antrea enforce NetworkPolicy; a CNI without NetworkPolicy support may accept the object without enforcing it.
