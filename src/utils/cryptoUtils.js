// cryptoUtils.js
import CryptoJS from 'crypto-js';

// IMPORTANT: In a real application, this key should be an environment variable
// and should not be hardcoded in client-side code.
const SECRET_KEY = '8b210831809947c21c0dd3ba3294484d7b190857d48d37f3404cf103cc9d6eb1';

export const encryptId = (id) => {
  if (!id) return '';
  try {
    const encrypted = CryptoJS.AES.encrypt(String(id), SECRET_KEY).toString();
    // Make the encrypted string URL-safe by replacing problematic characters
    return encrypted.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (error) {
    return id; // Fallback to original ID on error
  }
};

export const decryptId = (encryptedId) => {
  if (!encryptedId) return '';
  try {
    // Reverse the URL-safe replacements
    const urlSafe = encryptedId.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding back if needed. The length must be a multiple of 4 for Base64.
    const padding = (4 - (urlSafe.length % 4)) % 4;
    const padded = urlSafe + '='.repeat(padding);
    
    const bytes = CryptoJS.AES.decrypt(padded, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    // Return null if decryption fails (e.g., wrong key or corrupted data)
    if (!decrypted) {
      return null;
    }
    
    return decrypted;

  } catch (error) {
    return null; // Return null on error to indicate failure
  }
};

/**
 * Generates a random UUID string in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, A, or B.
 * This is a fallback implementation for environments where crypto.randomUUID is not available.
 * @returns {string} A UUID string
 */
export function generateUUID() {
  // Check if crypto.randomUUID is available (modern browsers)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
