const DATABASE_NAME = "rfxchange-mobile-workspaces";
const STORE_NAME = "rfx-attachments";
const VERSION = 1;

export interface DeviceAttachmentRecord {
  id: string;
  workspaceId: string;
  nodeId: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  blob: Blob;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Device attachment storage is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, VERSION);
    request.onerror = () => reject(request.error ?? new Error("Unable to open device attachment storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("workspaceId", "workspaceId", { unique: false });
        store.createIndex("workspaceNode", ["workspaceId", "nodeId"], { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function completeTransaction<T>(request: IDBRequest<T>, transaction: IDBTransaction): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("Device attachment storage failed."));
    transaction.onerror = () => reject(transaction.error ?? new Error("Device attachment storage failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

export async function storeDeviceAttachment(workspaceId: string, nodeId: string, file: File): Promise<DeviceAttachmentRecord> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  const record: DeviceAttachmentRecord = {
    id: `${workspaceId}:${nodeId}:${crypto.randomUUID()}`,
    workspaceId,
    nodeId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    createdAt: new Date().toISOString(),
    blob: file,
  };
  await completeTransaction(store.put(record), transaction);
  db.close();
  return record;
}

export async function listDeviceAttachments(workspaceId: string, nodeId?: string): Promise<DeviceAttachmentRecord[]> {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const index = nodeId ? store.index("workspaceNode") : store.index("workspaceId");
  const key = nodeId ? [workspaceId, nodeId] : workspaceId;
  const records = await completeTransaction(index.getAll(key), transaction);
  db.close();
  return records;
}

export async function removeDeviceAttachment(id: string) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  await completeTransaction(store.delete(id), transaction);
  db.close();
}

export function formatAttachmentSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
