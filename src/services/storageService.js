import { getCurrentUserId, getUserStoragePrefix } from "./userService.js";

const dbName = "ai-investment-workbench";
const dbVersion = 1;
const stores = ["reports", "history"];

export async function saveReport(report) {
  return saveRecord("reports", report);
}

export async function getReports() {
  return getAllRecords("reports");
}

export async function saveHistory(history) {
  return saveRecord("history", history);
}

export async function getHistory() {
  return getAllRecords("history");
}

async function saveRecord(storeName, record) {
  const item = { ...record, userId: record.userId ?? getCurrentUserId(), id: record.id ?? `${Date.now()}` };
  try {
    const db = await openDb();
    await requestToPromise(db.transaction(storeName, "readwrite").objectStore(storeName).put(item));
    return item;
  } catch {
    const list = getLocal(storeName);
    setLocal(storeName, [item, ...list.filter((entry) => entry.id !== item.id)].slice(0, 100));
    return item;
  }
}

async function getAllRecords(storeName) {
  try {
    const db = await openDb();
    const records = await requestToPromise(db.transaction(storeName, "readonly").objectStore(storeName).getAll());
    return records
      .filter((record) => !record.userId || record.userId === getCurrentUserId())
      .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  } catch {
    return getLocal(storeName);
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = window.indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      stores.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getLocal(storeName) {
  try {
    return JSON.parse(window.localStorage.getItem(`storage:${getUserStoragePrefix()}${storeName}`) ?? "[]");
  } catch {
    return [];
  }
}

function setLocal(storeName, records) {
  try {
    window.localStorage.setItem(`storage:${getUserStoragePrefix()}${storeName}`, JSON.stringify(records));
  } catch {
    // Storage is best-effort in the static prototype.
  }
}
