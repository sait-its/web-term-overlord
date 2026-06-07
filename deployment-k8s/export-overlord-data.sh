#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-sandbox-overlord}"
PVC_NAME="${PVC_NAME:-apps-web-term-overlord-iscsi-pvc}"
MOUNT_PATH="${MOUNT_PATH:-/overlord-data}"
HELPER_IMAGE="${HELPER_IMAGE:-busybox:1.36}"
TIMEOUT="${TIMEOUT:-180s}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$SCRIPT_DIR/backups}"
TIMESTAMP="${TIMESTAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
OUTPUT_FILE="${OUTPUT_FILE:-$OUTPUT_DIR/overlord-data-$TIMESTAMP.tar.gz}"
RESOURCE_SUFFIX="${RESOURCE_SUFFIX:-$(date -u +%Y%m%d%H%M%S)}"
SNAPSHOT_CLASS="${SNAPSHOT_CLASS:-iscsi}"
SNAPSHOT_NAME="${SNAPSHOT_NAME:-overlord-backup-$RESOURCE_SUFFIX}"
RESTORE_PVC_NAME="${RESTORE_PVC_NAME:-overlord-backup-restore-$RESOURCE_SUFFIX}"
STORAGE_CLASS="${STORAGE_CLASS:-}"
RESTORE_ACCESS_MODE="${RESTORE_ACCESS_MODE:-ReadWriteOnce}"
RESTORE_PVC_SIZE="${RESTORE_PVC_SIZE:-}"
POD_NAME="${POD_NAME:-overlord-backup-$RESOURCE_SUFFIX}"

cleanup() {
  kubectl delete pod "$POD_NAME" -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl delete pvc "$RESTORE_PVC_NAME" -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
  kubectl delete volumesnapshot "$SNAPSHOT_NAME" -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
}

trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"

if [[ -z "$STORAGE_CLASS" ]]; then
  STORAGE_CLASS="$(kubectl get pvc "$PVC_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.storageClassName}')"
fi

if [[ -z "$RESTORE_PVC_SIZE" ]]; then
  RESTORE_PVC_SIZE="$(kubectl get pvc "$PVC_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.resources.requests.storage}')"
fi

kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: $SNAPSHOT_NAME
  namespace: $NAMESPACE
spec:
  volumeSnapshotClassName: $SNAPSHOT_CLASS
  source:
    persistentVolumeClaimName: $PVC_NAME
EOF

kubectl wait "volumesnapshot/$SNAPSHOT_NAME" \
  -n "$NAMESPACE" \
  --for=jsonpath='{.status.readyToUse}'=true \
  --timeout="$TIMEOUT"

kubectl apply -f - <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: $RESTORE_PVC_NAME
  namespace: $NAMESPACE
spec:
  storageClassName: $STORAGE_CLASS
  accessModes:
    - $RESTORE_ACCESS_MODE
  resources:
    requests:
      storage: $RESTORE_PVC_SIZE
  dataSource:
    apiGroup: snapshot.storage.k8s.io
    kind: VolumeSnapshot
    name: $SNAPSHOT_NAME
EOF

kubectl wait --for=jsonpath='{.status.phase}'=Bound "pvc/$RESTORE_PVC_NAME" -n "$NAMESPACE" --timeout="$TIMEOUT"

kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $POD_NAME
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
    - name: backup
      image: $HELPER_IMAGE
      command:
        - sh
        - -c
        - sleep 3600
      volumeMounts:
        - name: overlord-data
          mountPath: $MOUNT_PATH
          readOnly: true
  volumes:
    - name: overlord-data
      persistentVolumeClaim:
        claimName: $RESTORE_PVC_NAME
        readOnly: true
EOF

kubectl wait --for=condition=Ready "pod/$POD_NAME" -n "$NAMESPACE" --timeout="$TIMEOUT"

kubectl exec "$POD_NAME" -n "$NAMESPACE" -- tar -C "$MOUNT_PATH" -czf - . > "$OUTPUT_FILE"

echo "Exported snapshot of $PVC_NAME:$MOUNT_PATH to $OUTPUT_FILE"
