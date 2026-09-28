#!/bin/bash
set -e

cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange

echo "======================================================="
echo "Deploying Cyber-Range AttackBox to K3s"
echo "======================================================="

echo "[1/4] Removing stale image tags from containerd (k8s.io namespace)..."
sudo k3s ctr -n k8s.io images rm cyber-range-gui:latest docker.io/library/cyber-range-gui:latest 2>/dev/null || true

echo "[2/4] Importing fresh cyber-range-gui:latest (3.73GB AttackBox) into containerd..."
docker save cyber-range-gui:latest | sudo k3s ctr -n k8s.io images import -

# Also tag as cyber-range-gui:latest explicitly
sudo k3s ctr -n k8s.io images tag docker.io/library/cyber-range-gui:latest cyber-range-gui:latest 2>/dev/null || true

echo "[3/4] Locating active lab deployment..."
NS=""
for n in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep '^lab-'); do
    if kubectl -n "$n" get deployment lab-deployment >/dev/null 2>&1; then
        NS="$n"
        echo "Found active lab namespace: $NS"
        break
    fi
done

if [ -z "$NS" ]; then
    echo "No active lab-deployment found. Images imported and ready for new session launch."
    exit 0
fi

echo "[4/4] Rolling out new AttackBox pod in $NS..."
kubectl -n "$NS" delete pod -l app=lab-app --now
echo "Waiting for new pod to reach Running state..."
kubectl -n "$NS" wait --for=condition=Ready pod -l app=lab-app --timeout=60s

NEW_POD=$(kubectl -n "$NS" get pods -l app=lab-app -o jsonpath='{.items[0].metadata.name}')
echo "AttackBox pod is READY: $NEW_POD in $NS"
kubectl -n "$NS" get pod "$NEW_POD" -o wide
