import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // 128 bits for CBC

// Get encryption key from environment or generate a default one
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // If key is provided in env, hash it to ensure it's exactly 32 bytes
    return crypto.createHash('sha256').update(envKey).digest();
  }
  
  // Default key for development (should be set in production!)
  console.warn('ENCRYPTION_KEY not found in environment variables. Using default key for development.');
  return crypto.createHash('sha256').update('smart-newsletter-default-key-2024').digest();
}

/**
 * Encrypts a string using AES-256-CBC
 * @param text - The plain text to encrypt
 * @returns Encrypted string in format: iv:encryptedData (all base64 encoded)
 */
export function encryptApiKey(text: string): string {
  if (!text || text.trim() === '') {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Combine iv and encrypted data
    return `${iv.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypts a string that was encrypted with encryptApiKey
 * @param encryptedText - The encrypted string in format: iv:encryptedData
 * @returns The decrypted plain text
 */
export function decryptApiKey(encryptedText: string): string {
  if (!encryptedText || encryptedText.trim() === '') {
    return '';
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, encryptedData] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Checks if a string appears to be encrypted (has the correct format)
 * @param text - The text to check
 * @returns True if the text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 2 && 
         parts.every(part => {
           try {
             Buffer.from(part, 'base64');
             return true;
           } catch {
             return false;
           }
         });
}

/**
 * Safely encrypts API keys object, handling empty/undefined values
 * @param apiKeys - Object containing API keys
 * @returns Object with encrypted API keys
 */
export function encryptApiKeys(apiKeys: { gemini?: string }): { gemini: string } {
  return {
    gemini: apiKeys.gemini ? encryptApiKey(apiKeys.gemini) : ''
  };
}

/**
 * Safely decrypts API keys object, handling empty/undefined values
 * @param encryptedApiKeys - Object containing encrypted API keys
 * @returns Object with decrypted API keys
 */
export function decryptApiKeys(encryptedApiKeys: { gemini?: string }): { gemini: string } {
  return {
    gemini: encryptedApiKeys.gemini && isEncrypted(encryptedApiKeys.gemini) 
      ? decryptApiKey(encryptedApiKeys.gemini) 
      : encryptedApiKeys.gemini || ''
  };
}