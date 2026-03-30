import CryptoJS from "crypto-js";
import { openDB } from "idb";

// This is a placeholder secret key. In a real application, this should be
// an environment variable or loaded securely.
const SECRET_KEY = "c02d8215de90df52a29aacd73ec9d78743f5f793fbc6fbafb5d7249298905dbb";

// Get or create a unique tab ID
function getTabId() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    let tabId = sessionStorage.getItem('tabId');
    if (!tabId) {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('tabId', tabId);
    }
    return tabId;
  }
  return 'default';
}

// Create a tab-specific memory store
const getMemoryStore = () => {
  const tabId = getTabId();
  if (!window.tabMemoryStore) {
    window.tabMemoryStore = {};
  }
  if (!window.tabMemoryStore[tabId]) {
    window.tabMemoryStore[tabId] = { user: null, token: null };
  }
  return window.tabMemoryStore[tabId];
};

// Cache the database connection
let dbPromise = null;

async function openSecureDB() {
  if (dbPromise) {
    return dbPromise;
  }
  
  dbPromise = openDB("SecureAppDB", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("secureStore")) {
        db.createObjectStore("secureStore");
      }
    },
  });
  
  return dbPromise;
}

// Save data to tab-specific in-memory cache and IndexedDB
export async function saveSecure(key, value) {
  const memoryStore = getMemoryStore();
  memoryStore[key] = value;
  
  try {
    const tabId = getTabId();
    const dataToStore = { tabId, value };
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(dataToStore), SECRET_KEY).toString();
    const db = await openSecureDB();
    await db.put("secureStore", encrypted, `${key}_${tabId}`);
  } catch (error) {
    // Failed to save data securely
  }
}

// Load data from IndexedDB and cache it in tab-specific memory
export async function loadSecure(key) {
  const tabId = getTabId();
  const memoryStore = getMemoryStore();
  
  // Return from tab-specific memory cache immediately if available
  if (memoryStore[key]) {
    return memoryStore[key];
  }
  
  try {
    const db = await openSecureDB();
    const encrypted = await db.get("secureStore", `${key}_${tabId}`);
    if (encrypted) {
      const bytes = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      // Check if decryption was successful
      if (decrypted) {
        const parsedData = JSON.parse(decrypted);
        if (parsedData.tabId === tabId) {
          memoryStore[key] = parsedData.value;
        }
      }
    }
  } catch (error) {
    memoryStore[key] = null;
  }
  return memoryStore[key];
}

// Clears only the current tab's data from secure storage (IndexedDB)
export async function clearSecureData() {
  const tabId = getTabId();
  const memoryStore = getMemoryStore();
  memoryStore.user = null;
  memoryStore.token = null;
  
  try {
    const db = await openSecureDB();
    
    // Delete only the current tab's data
    await db.delete("secureStore", `user_${tabId}`);
    await db.delete("secureStore", `token_${tabId}`);
  } catch (error) {
    // Failed to clear secure storage for this tab
  }
}

// A utility function to load both user and token at once
export async function getStoredAuth() {
  // Load both in parallel for better performance
  const [user, token] = await Promise.all([
    loadSecure("user"),
    loadSecure("token")
  ]);
  return { user, token };
}

// Clears ALL data from secure storage (for when needed)
export async function clearAllSecureData() {
  if (window.tabMemoryStore) {
    window.tabMemoryStore = {};
  }
  
  try {
    const db = await openSecureDB();
    await db.clear("secureStore");
  } catch (error) {
    // Failed to clear all secure storage
  }
}