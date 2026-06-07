#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 <overlord-data.tar.gz>" >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

BACKUP_FILE="$1"

if [[ ! -r "$BACKUP_FILE" ]]; then
  echo "Backup file is not readable: $BACKUP_FILE" >&2
  exit 1
fi

tar -tzf "$BACKUP_FILE" >/dev/null

NAMESPACE="${NAMESPACE:-sandbox-overlord}"
PVC_NAME="${PVC_NAME:-apps-web-term-overlord-iscsi-pvc}"
MOUNT_PATH="${MOUNT_PATH:-/overlord-data}"
HELPER_IMAGE="${HELPER_IMAGE:-busybox:1.36}"
TIMEOUT="${TIMEOUT:-180s}"
WAIT_SECONDS="${WAIT_SECONDS:-180}"
DEPLOYMENT="${DEPLOYMENT:-web-term-overlord-deployment}"
APP_LABEL="${APP_LABEL:-app=web-term-overlord}"
QUIESCE="${QUIESCE:-true}"
CLEAR_EXISTING="${CLEAR_EXISTING:-true}"
RESTORE_DEPLOYMENT_ON_EXIT="${RESTORE_DEPLOYMENT_ON_EXIT:-true}"
RESOURCE_SUFFIX="${RESOURCE_SUFFIX:-$(date -u +%Y%m%d%H%M%S)}"
POD_NAME="${POD_NAME:-overlord-import-$RESOURCE_SUFFIX}"
ORIGINAL_REPLICAS=""
SCALED_DOWN=false

restore_deployment() {
  if [[ "$SCALED_DOWN" == "true" && "$RESTORE_DEPLOYMENT_ON_EXIT" == "true" ]]; then
    kubectl scale "deployment/$DEPLOYMENT" -n "$NAMESPACE" --replicas="$ORIGINAL_REPLICAS"
    if [[ "$ORIGINAL_REPLICAS" != "0" ]]; then
      kubectl rollout status "deployment/$DEPLOYMENT" -n "$NAMESPACE" --timeout="$TIMEOUT"
    fi
    SCALED_DOWN=false
  fi
}

cleanup() {
  kubectl delete pod "$POD_NAME" -n "$NAMESPACE" --ignore-not-found=true >/dev/null 2>&1 || true
  restore_deployment
}

trap cleanup EXIT

if [[ "$QUIESCE" == "true" ]]; then
  ORIGINAL_REPLICAS="$(kubectl get "deployment/$DEPLOYMENT" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')"
  if [[ -z "$ORIGINAL_REPLICAS" ]]; then
    ORIGINAL_REPLICAS=1
  fi

  kubectl scale "deployment/$DEPLOYMENT" -n "$NAMESPACE" --replicas=0
  SCALED_DOWN=true

  deadline=$((SECONDS + WAIT_SECONDS))
  while true; do
    pods="$(kubectl get pods -n "$NAMESPACE" -l "$APP_LABEL" -o jsonpath='{.items[*].metadata.name}')"
    if [[ -z "$pods" ]]; then
      break
    fi
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for web-term-overlord pods to terminate: $pods" >&2
      exit 1
    fi
    sleep 2
  done
fi

kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: $POD_NAME
  namespace: $NAMESPACE
spec:
  restartPolicy: Never
  containers:
    - name: import
      image: $HELPER_IMAGE
      command:
        - sh
        - -c
        - sleep 3600
      volumeMounts:
        - name: overlord-data
          mountPath: $MOUNT_PATH
  volumes:
    - name: overlord-data
      persistentVolumeClaim:
        claimName: $PVC_NAME
EOF

kubectl wait --for=condition=Ready "pod/$POD_NAME" -n "$NAMESPACE" --timeout="$TIMEOUT"

if [[ "$CLEAR_EXISTING" == "true" ]]; then
  kubectl exec "$POD_NAME" -n "$NAMESPACE" -- sh -c "find '$MOUNT_PATH' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"
fi

kubectl exec -i "$POD_NAME" -n "$NAMESPACE" -- tar -C "$MOUNT_PATH" -xzf - < "$BACKUP_FILE"

cleanup
trap - EXIT

echo "Imported $BACKUP_FILE into $PVC_NAME:$MOUNT_PATH"
