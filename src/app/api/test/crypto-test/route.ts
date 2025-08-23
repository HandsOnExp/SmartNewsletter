import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { encryptApiKey, decryptApiKey, encryptApiKeys, decryptApiKeys, isEncrypted } from '@/lib/crypto';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    console.log('Running crypto tests...');

    // Test 1: Basic encryption/decryption
    const testKey = 'sk-test123456789';
    const encrypted = encryptApiKey(testKey);
    const decrypted = decryptApiKey(encrypted);
    
    console.log('Test 1 - Basic encrypt/decrypt:');
    console.log('Original:', testKey);
    console.log('Encrypted:', encrypted);
    console.log('Decrypted:', decrypted);
    console.log('Match:', testKey === decrypted);

    // Test 2: Empty string handling
    const emptyEncrypted = encryptApiKey('');
    const emptyDecrypted = decryptApiKey('');
    
    console.log('\nTest 2 - Empty string handling:');
    console.log('Empty encrypted:', emptyEncrypted);
    console.log('Empty decrypted:', emptyDecrypted);

    // Test 3: API keys object encryption/decryption
    const testApiKeys = {
      cohere: 'co_test_key_123',
      gemini: 'AIza_test_key_456'
    };
    
    const encryptedKeys = encryptApiKeys(testApiKeys);
    const decryptedKeys = decryptApiKeys(encryptedKeys);
    
    console.log('\nTest 3 - API keys object encrypt/decrypt:');
    console.log('Original:', testApiKeys);
    console.log('Encrypted:', encryptedKeys);
    console.log('Decrypted:', decryptedKeys);
    console.log('Cohere match:', testApiKeys.cohere === decryptedKeys.cohere);
    console.log('Gemini match:', testApiKeys.gemini === decryptedKeys.gemini);

    // Test 4: isEncrypted function
    const plainText = 'plain-text-key';
    const encryptedText = encryptApiKey('test-key-for-detection');
    
    console.log('\nTest 4 - Encryption detection:');
    console.log('Plain text is encrypted?', isEncrypted(plainText));
    console.log('Encrypted text is encrypted?', isEncrypted(encryptedText));

    // Test results
    const allTests = [
      testKey === decrypted,
      emptyEncrypted === '',
      emptyDecrypted === '',
      testApiKeys.cohere === decryptedKeys.cohere,
      testApiKeys.gemini === decryptedKeys.gemini,
      !isEncrypted(plainText),
      isEncrypted(encryptedText)
    ];

    const allPassed = allTests.every(test => test);

    return NextResponse.json({
      success: true,
      message: 'Crypto tests completed',
      results: {
        allTestsPassed: allPassed,
        individualTests: {
          basicEncryptDecrypt: testKey === decrypted,
          emptyStringHandling: emptyEncrypted === '' && emptyDecrypted === '',
          apiKeysObjectHandling: testApiKeys.cohere === decryptedKeys.cohere && testApiKeys.gemini === decryptedKeys.gemini,
          encryptionDetection: !isEncrypted(plainText) && isEncrypted(encryptedText)
        },
        samples: {
          original: testKey,
          encrypted: encrypted.substring(0, 50) + '...',
          encryptedLength: encrypted.length,
          decrypted: decrypted
        }
      }
    });

  } catch (error) {
    console.error('Crypto test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json({
    success: false,
    error: 'Method not allowed. Use GET to run crypto tests.'
  }, { status: 405 });
}