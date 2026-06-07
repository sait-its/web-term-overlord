# Overlord Kubernetes Deployment Guide

This guide provides a step-by-step approach to deploying Overlord, a Linux learning environment, within a Kubernetes cluster. The setup leverages Kubernetes PersistentVolumeClaims (PVCs) for storage and a Cloudflare Tunnel to securely expose the service over the internet. Follow the instructions below to provision storage, deploy the overlord-backend-service (AlmaLinux 10.2 container), the web-term-overlord-service (Web Terminal), and configure Cloudflare Tunnel for external access.

Enter `overlord` folder.

```shell
cd overlord
```



## Provision Storage

`dyn-iscsi-pvc-web-term-overlord.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: apps-web-term-overlord-iscsi-pvc
  namespace: sandbox-overlord
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: iscsi
  resources:
    requests:
      storage: 1Gi
```

```
kubectl apply -f dyn-iscsi-pvc-web-term-overlord.yaml

kubectl get pvc -n sandbox-overlord apps-web-term-overlord-iscsi-pvc
NAME                               STATUS   VOLUME                                     CAPACITY   ACCESS MODES   STORAGECLASS   VOLUMEATTRIBUTESCLASS   AGE
apps-web-term-overlord-iscsi-pvc   Bound    pvc-974e3a7f-7ae5-4807-9d05-03d757b02c14   1Gi        RWO            iscsi          <unset>                 19m

kubectl get pv | grep overlord
pvc-974e3a7f-7ae5-4807-9d05-03d757b02c14   1Gi        RWO            Delete           Bound    sandbox-overlord/apps-web-term-overlord-iscsi-pvc   iscsi          <unset>                          20m
```



## Deploy Service

> [!NOTE]
>
> This deployment uses the dynamic Democratic CSI iSCSI PVC `apps-web-term-overlord-iscsi-pvc`.
>
> The old static NFS PVC `apps-web-term-overlord-pvc` and PV `apps-web-term-overlord-pv` were removed after `logs.db` was copied from the old shared NFS path `/srv/nfsroot/nfs-pv/apps/web-term-overlord/logs.db` into the root of the new dynamically provisioned iSCSI PVC.
>
> The new PVC is dedicated to `web-term-overlord`. Since the app mounts a single database file at `/app/logs.db`, the deployment keeps `subPath`, but the path is now relative to the root of the new PVC: `subPath: logs.db`.
>
> Do **NOT** reintroduce the old shared-path layout: `subPath: apps/web-term-overlord/logs.db`. 

`overlord.yaml`

```yaml
---
# --- Backend Service (Overlord) ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overlord-backend-deployment
  namespace: sandbox-overlord
spec:
  replicas: 1
  selector:
    matchLabels:
      app: overlord-backend
  template:
    metadata:
      labels:
        app: overlord-backend
    spec:
      hostname: overlord
      imagePullSecrets:
        - name: dockerhub-image-pull-secret
      automountServiceAccountToken: false
      containers:
        - name: overlord
          image: hongsait/overlord:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 2222
          resources:
            limits:
              cpu: "2"
              memory: "1Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: overlord-backend-service
  namespace: sandbox-overlord
spec:
  selector:
    app: overlord-backend
  ports:
    - protocol: TCP
      port: 2222
      targetPort: 2222
  type: ClusterIP

---
# --- Frontend Service (Web Term) ---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-term-overlord-deployment
  namespace: sandbox-overlord
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web-term-overlord
  template:
    metadata:
      labels:
        app: web-term-overlord
    spec:
      imagePullSecrets:
        - name: dockerhub-image-pull-secret
      automountServiceAccountToken: false
      containers:
        - name: web-term-overlord
          image: hongsait/web-term-overlord:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
          env:
            - name: BACKEND_SSH_HOST
              value: "overlord-backend-service"
            - name: BACKEND_SSH_PORT
              value: "2222"
            - name: TIMEZONE
              value: "America/Edmonton"
          resources:
            limits:
              cpu: "2"
              memory: "1Gi"
          volumeMounts:
            - name: data-volume
              mountPath: /app/logs.db
              subPath: logs.db
      volumes:
        - name: data-volume
          persistentVolumeClaim:
            claimName: apps-web-term-overlord-iscsi-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: web-term-overlord-service
  namespace: sandbox-overlord
spec:
  selector:
    app: web-term-overlord
  ports:
    - protocol: TCP
      port: 8080
      targetPort: 8080
  type: ClusterIP
```

```
kubectl apply -f overlord.yaml

kubectl get svc overlord-backend-service -n sandbox-overlord
NAME                       TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
overlord-backend-service   ClusterIP   10.108.32.179   <none>        2222/TCP   67d

kubectl get svc web-term-overlord-service -n sandbox-overlord
NAME                        TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
web-term-overlord-service   ClusterIP   10.103.74.21   <none>        8080/TCP   67d
```



## Security

To apply the security policy:

```shell
kubectl apply -f backend-isolation-policy.yaml
```

The `NetworkPolicy` defined in `backend-isolation-policy.yaml` isolates the **backend SSH container** so it can only be reached by the web terminal frontend, and so the backend itself cannot initiate outbound network connections.

In the app, the important flow is:

```text
User browser
   ↓
Cloudflare tunnel
   ↓
web-term-overlord pod
   ↓ TCP 2222
overlord-backend pod
```

The backend should not need to talk to the internet, DNS, other namespaces, or other pods. It only needs to accept SSH traffic from the frontend.

### What the policy applies to

```yaml
podSelector:
  matchLabels:
    app: overlord-backend
```

This means the policy applies only to pods with:

```yaml
app: overlord-backend
```

So it protects this deployment:

```text
overlord-backend-deployment
```

It does **not** apply to the frontend, Cloudflare tunnel, or other pods.

### Ingress: who can connect to the backend

```yaml
ingress:
  - from:
      - podSelector:
          matchLabels:
            app: web-term-overlord
    ports:
      - protocol: TCP
        port: 2222
```

This says:

Only pods in the same namespace with label:

```yaml
app: web-term-overlord
```

may connect to the backend on:

```text
TCP/2222
```

That is exactly what the frontend uses:

```yaml
BACKEND_SSH_HOST: overlord-backend-service
BACKEND_SSH_PORT: 2222
```

So the frontend can still connect, but other pods in `sandbox-overlord` cannot directly SSH into the backend.

This is good because the backend is the sensitive component. It is where shell interaction likely happens. You do not want random pods in the namespace to reach it.

### Egress: what the backend can connect to

```yaml
policyTypes:
  - Ingress
  - Egress
```

and:

```yaml
egress: []
```

This is the strongest part of the policy.

It means the backend is not allowed to initiate outbound traffic to anything:

- No internet
- No DNS
- No other pods
- No Kubernetes API
- No package downloads
- No callbacks
- No reverse shells
- No data exfiltration over the network

That is good for a sandbox environment because even if someone gets code execution inside the backend, the pod cannot easily phone home, scan the cluster, download tools, or connect to external hosts.

### Why this is good security

This follows the principle of least privilege.

The backend only needs one network permission:

```text
Accept TCP/2222 from web-term-overlord
```

Everything else is denied.

That reduces risk from:

- student code trying to access the internet
- malicious scripts trying to download tools
- reverse shell attempts
- credential or data exfiltration
- lateral movement to other pods
- cluster service discovery
- direct access from unrelated pods

It also creates a clean separation:

- Frontend: allowed to expose UI and connect to backend
- Backend: isolated execution target

The backend becomes a much safer place to run untrusted or semi-trusted commands.

### One important caveat

NetworkPolicy only works if the cluster CNI enforces it.

For example, CNIs like Calico, **Cilium**, Antrea, and some others support NetworkPolicy. If the CNI does not enforce NetworkPolicy, this YAML may apply successfully but not actually block traffic.

You can test it with temporary pods:

```bash
kubectl run test-client \
  -n sandbox-overlord \
  --rm -it \
  --image=busybox:1.36 \
  -- sh
```

From inside that pod, this should fail:

```sh
nc -vz overlord-backend-service 2222
```

But from the `web-term-overlord` pod, the app should still connect successfully.

### Another caveat: same-namespace selector

This rule:

```yaml
podSelector:
  matchLabels:
    app: web-term-overlord
```

without a `namespaceSelector` means “pods in the same namespace.”

That is good here because both frontend and backend are in:

```text
sandbox-overlord
```

It also prevents a pod in another namespace from connecting, even if it has the same label.
