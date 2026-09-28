import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import path from 'path';

// Singleton Kubernetes Config
const kc = new k8s.KubeConfig();

// Attempt to load KubeConfig from multiple standard locations:
// 1. KUBECONFIG environment variable
// 2. User home directory ~/.kube/config
// 3. System K3s configuration /etc/rancher/k3s/k3s.yaml
// 4. Default fallback
const homeKubeConfig = process.env.HOME ? path.join(process.env.HOME, '.kube', 'config') : '';
const k3sConfigPath = '/etc/rancher/k3s/k3s.yaml';

if (process.env.KUBECONFIG && fs.existsSync(process.env.KUBECONFIG)) {
  console.log(`[k8s]: Loading KubeConfig from KUBECONFIG env: ${process.env.KUBECONFIG}`);
  kc.loadFromFile(process.env.KUBECONFIG);
} else if (homeKubeConfig && fs.existsSync(homeKubeConfig)) {
  console.log(`[k8s]: Loading KubeConfig from home: ${homeKubeConfig}`);
  kc.loadFromFile(homeKubeConfig);
} else if (fs.existsSync(k3sConfigPath)) {
  console.log(`[k8s]: Loading KubeConfig from K3s default: ${k3sConfigPath}`);
  kc.loadFromFile(k3sConfigPath);
} else {
  kc.loadFromDefault();
}

// If cluster server URL starts with http:// (e.g. unencrypted local proxy or fallback),
// ensure skipTLSVerify is set to avoid client-node rejecting HTTP connections.
const currentCluster = kc.getCurrentCluster();
if (currentCluster && currentCluster.server.startsWith('http://') && currentCluster.skipTLSVerify === undefined) {
  (currentCluster as any).skipTLSVerify = true;
}

// Create API clients
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

/**
 * Initializes the Kubernetes client by authenticating and testing
 * the connection by listing active namespaces.
 *
 * @returns A list of namespace names if successful.
 */
export const initK8s = async (): Promise<string[]> => {
  try {
    console.log('[k8s]: Attempting to authenticate with local Kubernetes cluster...');
    
    // Call the Kubernetes API to list namespaces
    const response = await k8sApi.listNamespace();
    
    // Extract namespace names from the response
    const namespaces = response.items
      .map((ns) => ns.metadata?.name)
      .filter((name): name is string => name !== undefined);

    console.log('[k8s]: Successfully connected to Kubernetes.');
    console.log(`[k8s]: Found ${namespaces.length} namespaces:`, namespaces.join(', '));
    
    return namespaces;
  } catch (error: any) {
    console.warn('[k8s]: Failed to connect to Kubernetes cluster. Ensure Minikube/K3s is running.');
    return [];
  }
};

// Export the initialized clients for use in other files
export { k8sApi, appsApi, networkingApi, customObjectsApi, kc };
