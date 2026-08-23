import * as k8s from '@kubernetes/client-node';

// Singleton Kubernetes Config
const kc = new k8s.KubeConfig();

// Load the default credentials.
// For local development on Kali, this will use ~/.kube/config
// In a production K3s cluster, this would use the in-cluster service account if deployed there.
kc.loadFromDefault();

// Create API clients
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const appsApi = kc.makeApiClient(k8s.AppsV1Api);
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
  } catch (error) {
    console.warn('[k8s]: Failed to connect to Kubernetes cluster. Ensure Minikube/K3s is running.');
    // Don't crash the server during development if K8s is down
    return [];
  }
};

// Export the initialized clients for use in other files
export { k8sApi, appsApi, customObjectsApi, kc };
