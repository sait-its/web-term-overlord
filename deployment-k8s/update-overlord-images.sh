#!/usr/bin/env bash

set -euo pipefail

NAMESPACE="${NAMESPACE:-sandbox-overlord}"
RELEASE="${RELEASE:-overlord}"

BACKEND_DEPLOYMENT="${OVERLORD_BACKEND_DEPLOYMENT:-overlord-backend-deployment}"
FRONTEND_DEPLOYMENT="${WEB_TERM_OVERLORD_DEPLOYMENT:-web-term-overlord-deployment}"

# Set UPDATE_FRONTEND=true when the web terminal image/config also changed.
UPDATE_FRONTEND="${UPDATE_FRONTEND:-false}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="${CHART_DIR:-$SCRIPT_DIR}"
BACKEND_IMAGE_REPOSITORY="${BACKEND_IMAGE_REPOSITORY:-hongsait/overlord}"
BACKEND_IMAGE_TAG="${BACKEND_IMAGE_TAG:-latest}"
FRONTEND_IMAGE_REPOSITORY="${FRONTEND_IMAGE_REPOSITORY:-hongsait/web-term-overlord}"
FRONTEND_IMAGE_TAG="${FRONTEND_IMAGE_TAG:-latest}"
ROLLOUT_RESTART_AT="${ROLLOUT_RESTART_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

if [[ ! -f "$CHART_DIR/Chart.yaml" ]]; then
  echo "Chart not found: $CHART_DIR" >&2
  exit 1
fi

helm_args=(
  upgrade
  --install "$RELEASE" "$CHART_DIR"
  --namespace "$NAMESPACE"
  --create-namespace
  --set-string "backend.image.repository=$BACKEND_IMAGE_REPOSITORY"
  --set-string "backend.image.tag=$BACKEND_IMAGE_TAG"
  --set-string "rollout.backendRestartAt=$ROLLOUT_RESTART_AT"
)

if [[ "$UPDATE_FRONTEND" == "true" ]]; then
  helm_args+=(
    --set-string "frontend.image.repository=$FRONTEND_IMAGE_REPOSITORY"
    --set-string "frontend.image.tag=$FRONTEND_IMAGE_TAG"
    --set-string "rollout.frontendRestartAt=$ROLLOUT_RESTART_AT"
  )
fi

echo "Upgrading Helm release: $RELEASE"
helm "${helm_args[@]}"
echo

echo "Waiting for backend deployment: $BACKEND_DEPLOYMENT"
kubectl rollout status "deployment/$BACKEND_DEPLOYMENT" -n "$NAMESPACE" --timeout=180s
echo

if [[ "$UPDATE_FRONTEND" == "true" ]]; then
  echo "Waiting for frontend deployment: $FRONTEND_DEPLOYMENT"
  echo "Note: frontend uses an iSCSI RWO PVC, so the deployment should use strategy.type=Recreate."
  kubectl rollout status "deployment/$FRONTEND_DEPLOYMENT" -n "$NAMESPACE" --timeout=180s
else
  echo "Skipping frontend restart. Set UPDATE_FRONTEND=true to restart $FRONTEND_DEPLOYMENT."
  echo "Use it when the frontend image changed too:"
  echo "  UPDATE_FRONTEND=true ./update-overlord-images.sh"
fi

echo
echo "Done."
