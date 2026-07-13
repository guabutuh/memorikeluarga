// Web Crypto API helpers for Zero-Knowledge End-to-End Encryption
// Derived from the family PIN using PBKDF2 and AES-GCM 256-bit encryption

/**
 * Derives a CryptoKey from a PIN and salt using PBKDF2
 */
async function deriveKey(pin, salt, iterations = 100000) {
  const encoder = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string (e.g. file base64 data or metadata JSON) using a PIN
 */
export async function encryptData(plaintext, pin) {
  try {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(plaintext);
    
    // Generate random salt (16 bytes) and IV (12 bytes)
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from PIN and Salt
    const key = await deriveKey(pin, salt);
    
    // Encrypt
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      dataBytes
    );
    
    // Convert to Base64 strings for easy storage
    const saltBase64 = btoa(String.fromCharCode(...salt));
    const ivBase64 = btoa(String.fromCharCode(...iv));
    const ciphertextBase64 = btoa(
      String.fromCharCode(...new Uint8Array(ciphertext))
    );
    
    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      salt: saltBase64,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Gagal mengenkripsi data. Pastikan browser Anda mendukung Web Crypto.');
  }
}

/**
 * Decrypts a ciphertext using a PIN and the stored salt and IV
 */
export async function decryptData(encryptedObj, pin) {
  try {
    const { ciphertext, iv, salt } = encryptedObj;
    
    // Decode from Base64
    const saltBytes = new Uint8Array(
      atob(salt).split('').map((char) => char.charCodeAt(0))
    );
    const ivBytes = new Uint8Array(
      atob(iv).split('').map((char) => char.charCodeAt(0))
    );
    const ciphertextBytes = new Uint8Array(
      atob(ciphertext).split('').map((char) => char.charCodeAt(0))
    );
    
    // Derive key
    const key = await deriveKey(pin, saltBytes);
    
    // Decrypt
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
      },
      key,
      ciphertextBytes
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('PIN salah atau data rusak.');
  }
}
