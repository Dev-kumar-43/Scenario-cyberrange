# Multus CNI Installation & Configuration Guide for K3s / Kubernetes

This guide documents the exact configuration required to deploy Multus CNI on the CyberRange Kubernetes cluster to enable multi-homed secondary network interfaces.

---

## 1. Overview
Multus CNI is a container network interface plugin for Kubernetes that allows pods to attach to multiple network interfaces.
In CyberRange:
- **Default interface (`eth0`)**: Managed by cluster CNI (Flannel) for control-plane access, VNC nodePort proxying, and WebSocket terminal exec.
- **Secondary interface (`net1`)**: Created via Multus with an isolated bridge, macvlan, or ipvlan attachment definition, providing a dedicated layer-2 internal attack network between Kali and target VMs.

---

## 2. Prerequisites
Verify K3s CNI directory structure on the host node:
- CNI Config directory: `/var/lib/rancher/k3s/agent/etc/cni/net.d`
- CNI Binaries directory: `/var/lib/rancher/k3s/agent/opt/cni/bin`

Ensure basic standard CNI plugins (`bridge`, `host-local`, `tuning`) are present in the CNI bin directory.

---

## 3. Multus DaemonSet Installation

Apply the thin Multus daemonset manifest:

```bash
kubectl apply -f https://raw.githubusercontent.com/k8snetworkplumbingwg/multus-cni/master/deployments/multus-daemonset.yml
```

Or for K3s specifically, specify the K3s CNI directories:

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: kube-multus-ds
  namespace: kube-system
  labels:
    tier: node
    app: multus
spec:
  selector:
    matchLabels:
      name: multus
  template:
    metadata:
      labels:
        name: multus
        tier: node
        app: multus
    spec:
      hostNetwork: true
      tolerations:
        - operator: Exists
          effect: NoSchedule
      serviceAccountName: multus
      containers:
        - name: kube-multus
          image: ghcr.io/k8snetworkplumbingwg/multus-cni:v4.1.4-thick
          command: ["/usr/src/multus-cni/bin/multus-daemon"]
          resources:
            requests:
              cpu: "100m"
              memory: "50Mi"
            limits:
              cpu: "200m"
              memory: "100Mi"
          securityContext:
            privileged: true
          volumeMounts:
            - name: cni
              mountPath: /host/etc/cni/net.d
            - name: cnibin
              mountPath: /host/opt/cni/bin
      volumes:
        - name: cni
          hostPath:
            path: /var/lib/rancher/k3s/agent/etc/cni/net.d
        - name: cnibin
          hostPath:
            path: /var/lib/rancher/k3s/agent/opt/cni/bin
```

---

## 4. NetworkAttachmentDefinition per Scenario

Once Multus is installed, an isolated internal layer-2 bridge network can be provisioned per scenario namespace:

```yaml
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: scenario-internal-net
  namespace: scenario-<sessionId>
spec:
  config: '{
    "cniVersion": "0.3.1",
    "name": "scenario-internal-net",
    "type": "bridge",
    "bridge": "br-<sessionId>",
    "isGateway": true,
    "ipMasq": false,
    "ipam": {
      "type": "host-local",
      "subnet": "192.168.100.0/24",
      "rangeStart": "192.168.100.10",
      "rangeEnd": "192.168.100.50"
    }
  }'
```

Pods can then annotate their spec with:
```yaml
metadata:
  annotations:
    k8s.v1.cni.cncf.io/networks: scenario-internal-net
```

---

## 5. Security & Isolation Note
Multus provides secondary interface plumbings, but **does not replace zero-trust egress blocking**.
Kubernetes `NetworkPolicy` must always be applied in tandem to ensure pods cannot send unauthorized packets outside the scenario boundary.
