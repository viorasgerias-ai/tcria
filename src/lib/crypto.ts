/**
 * Deterministic canonical JSON and SHA-256 hashing.
 * Matches Python's:
 * json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")
 * and hashlib.sha256(data).hexdigest()
 */

// Pure-JS SHA-256 for instant synchronous execution (and verified against Web Crypto)
function sha256Sync(data: Uint8Array): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const K: number[] = [];
  const H: number[] = [];

  let primeCounter = 0;
  const isPrime = (n: number) => {
    for (let factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        H[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      K[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  const length = data.length;
  const bitLength = length * 8;
  const newLength = ((length + 9 + 63) & ~63);
  const words = new Uint32Array(newLength / 4);

  for (let i = 0; i < length; i++) {
    words[i >>> 2] |= data[i] << (24 - (i % 4) * 8);
  }
  words[length >>> 2] |= 0x80 << (24 - (length % 4) * 8);

  // Big endian length at the end
  const highBits = Math.floor(bitLength / 0x100000000);
  const lowBits = bitLength >>> 0;
  words[words.length - 2] = highBits;
  words[words.length - 1] = lowBits;

  const w = new Uint32Array(64);

  for (let i = 0; i < words.length; i += 16) {
    let a = H[0], b = H[1], c = H[2], d = H[3];
    let e = H[4], f = H[5], g = H[6], h = H[7];

    for (let j = 0; j < 64; j++) {
      if (j < 16) {
        w[j] = words[i + j];
      } else {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[j] + w[j]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
  }
  return hex;
}

/**
 * Serializes any JavaScript value to canonical JSON string
 * matching Python's sort_keys=True, separators=(',', ':'), allow_nan=False
 */
export function canonicalString(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new ValueError('Valores NaN ou Infinity não são permitidos em JSON canônico');
      }
      return JSON.stringify(value);
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalString).join(',') + ']';
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalString(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

const textEncoder = new TextEncoder();

export function canonical(value: unknown): Uint8Array {
  return textEncoder.encode(canonicalString(value));
}

export function digest(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? textEncoder.encode(data) : data;
  return sha256Sync(bytes);
}

export function field_state(value: unknown): 'MISSING' | 'INVALID' | 'PRESENT' | 'EMPTY' {
  if (value === null || value === undefined) {
    return 'MISSING';
  }
  if (typeof value !== 'string') {
    return 'INVALID';
  }
  return value.trim().length > 0 ? 'PRESENT' : 'EMPTY';
}

export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValueError';
  }
}

export function anchorValue(value: string): string {
  const cleaned = value.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleaned)) {
    throw new ValueError('Informe a referência SHA-256 guardada: 64 caracteres hexadecimais.');
  }
  return cleaned;
}

export function uuid4Hex(): string {
  // Generates 32 lowercase hex chars matching Python's uuid4().hex
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').toLowerCase();
  }
  // Fallback
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}
