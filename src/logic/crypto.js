// src/logic/crypto.js
// Web Crypto API를 사용한 하이브리드 암호화 유틸리티 (RSA-OAEP + AES-GCM)

// 1. RSA 키 쌍 생성
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  return keyPair;
}

// 2. 공개키를 Base64 문자열로 내보내기 (Firebase 저장용)
export async function exportPublicKey(publicKey) {
  const exported = await crypto.subtle.exportKey('spki', publicKey);
  const exportedAsString = String.fromCharCode.apply(null, new Uint8Array(exported));
  return btoa(exportedAsString);
}

// 3. Base64 문자열에서 공개키 객체로 가져오기
export async function importPublicKey(pemString) {
  const binaryDerString = atob(pemString);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'spki',
    binaryDer.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    true,
    ['encrypt']
  );
}

// 4. 데이터를 Base64로 인코딩하는 헬퍼
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 5. 하이브리드 암호화 (AES-GCM으로 데이터 암호화 후, AES 키를 RSA로 암호화)
export async function encryptData(publicKeyPem, dataObj) {
  try {
    const publicKey = await importPublicKey(publicKeyPem);
    
    // 5-1. 임의의 256비트 AES-GCM 키 생성
    const aesKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );

    // 5-2. 데이터를 JSON 문자열로 변환 후 인코딩
    const dataStr = JSON.stringify(dataObj);
    const encodedData = new TextEncoder().encode(dataStr);

    // 5-3. AES-GCM으로 데이터 암호화 (IV 필요)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      aesKey,
      encodedData
    );

    // 5-4. AES 키를 raw 포맷으로 추출하여 RSA 공개키로 암호화
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const encryptedAesKey = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      rawAesKey
    );

    // 5-5. 파이어베이스에 저장할 수 있도록 모두 Base64로 변환하여 반환
    return {
      encryptedAesKey: arrayBufferToBase64(encryptedAesKey),
      encryptedData: arrayBufferToBase64(encryptedData),
      iv: arrayBufferToBase64(iv)
    };
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
}

// 6. 하이브리드 복호화
export async function decryptData(privateKey, encryptedPayload) {
  if (!encryptedPayload || !encryptedPayload.encryptedAesKey) return null;
  
  try {
    const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedPayload.encryptedAesKey);
    const encryptedDataBuffer = base64ToArrayBuffer(encryptedPayload.encryptedData);
    const ivBuffer = base64ToArrayBuffer(encryptedPayload.iv);

    // 6-1. RSA 개인키로 AES 키 복호화
    const rawAesKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      encryptedAesKeyBuffer
    );

    // 6-2. 복호화된 raw AES 키를 CryptoKey 객체로 가져오기
    const aesKey = await crypto.subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      true,
      ['decrypt']
    );

    // 6-3. AES 키로 실제 데이터 복호화
    const decryptedDataBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer },
      aesKey,
      encryptedDataBuffer
    );

    // 6-4. JSON 파싱
    const decodedStr = new TextDecoder().decode(decryptedDataBuffer);
    return JSON.parse(decodedStr);
  } catch (error) {
    console.error("Decryption failed:", error);
    return null;
  }
}
