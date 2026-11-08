/* Client-side encryption. GitHub only ever sees the envelope written by seal():
   AES-GCM 256 with a key derived from the passphrase (PBKDF2, SHA-256). The passphrase never leaves the device;
   the derived key is kept as a non-extractable CryptoKey in IndexedDB. */
const Vault = {
  ITERATIONS: 600000,
  FORMAT: 'aes-gcm-v1',

  b64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  },
  unb64(s) { return Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)); },

  newSalt() { return this.b64(crypto.getRandomValues(new Uint8Array(16))); },

  async deriveKey(passphrase, salt, iterations = this.ITERATIONS) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: this.unb64(salt), iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  async seal(text, key, salt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
    return JSON.stringify({ app: 'teamboard', format: this.FORMAT,
      kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: this.ITERATIONS, salt }, iv: this.b64(iv), data: this.b64(data) }, null, 1);
  },

  parse(envelopeText) {
    let e;
    try { e = JSON.parse(envelopeText); } catch { e = null; }
    if (!e || e.app !== 'teamboard' || e.format !== this.FORMAT) throw new Error('Die Datei im Repository ist keine verschlüsselte Teamboard-Datei.');
    return e;
  },

  /* Throws a readable error if the key does not fit (wrong passphrase or file re-created with a new salt). */
  async open(envelope, key) {
    try {
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(envelope.iv) }, key, this.unb64(envelope.data));
      return new TextDecoder().decode(plain);
    } catch {
      const e = new Error('Das Passwort passt nicht zu den Daten im Repository.');
      e.wrongKey = true;
      throw e;
    }
  },
};
