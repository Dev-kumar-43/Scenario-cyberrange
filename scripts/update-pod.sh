#!/bin/bash
set -e

cd /mnt/c/Users/DevKumar/Desktop/Scenario-cyberrange

NS="lab-66184fa5-1a14-4cb6-a0eb-b2d933aee07d"
if ! kubectl get ns "$NS" >/dev/null 2>&1; then
  # Fallback to finding namespace with novnc
  for n in $(kubectl get namespaces -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | grep '^lab-'); do
    if kubectl -n "$n" get pods | grep -q 'lab-deployment'; then
      NS="$n"
      break
    fi
  done
fi

POD=$(kubectl -n "$NS" get pods -o jsonpath='{.items[0].metadata.name}')
echo "Found active lab namespace: $NS, Pod: $POD"

# 1. Copy patch_novnc.py and apply it
kubectl -n "$NS" exec -i "$POD" -- sh -c 'cat > /tmp/patch_novnc.py' < docker/kali-gui/patch_novnc.py
kubectl -n "$NS" exec -i "$POD" -- python3 /tmp/patch_novnc.py

# 2. Copy updated supervisord.conf
kubectl -n "$NS" exec -i "$POD" -- sh -c 'cat > /etc/supervisor/conf.d/supervisord.conf' < docker/kali-gui/supervisord.conf
echo "supervisord.conf copied to pod."

# 3. Check TigerVNC installation, install if not present
if ! kubectl -n "$NS" exec -i "$POD" -- which Xvnc >/dev/null 2>&1; then
  echo "Installing TigerVNC in pod..."
  kubectl -n "$NS" exec -i "$POD" -- apt-get update
  kubectl -n "$NS" exec -i "$POD" -- apt-get install -y --no-install-recommends tigervnc-standalone-server tigervnc-common
fi

kubectl -n "$NS" exec -i "$POD" -- which Xvnc
# 4. Trigger supervisord to reload configuration and launch Xvnc with RANDR
kubectl -n "$NS" exec -i "$POD" -- kill -HUP 1
echo "Done updating pod. Supervisord reloaded."

