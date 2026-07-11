import { isIP } from 'node:net';

export type DnsLookup = (hostname: string) => Promise<readonly string[]>;

export interface UrlPolicy {
  lookup: DnsLookup;
  allowedProtocols?: readonly ('http:' | 'https:')[];
}

const defaultLookup: DnsLookup = async (hostname) => {
  const { lookup } = await import('node:dns/promises');
  return (await lookup(hostname, { all: true, verbatim: true })).map(({ address }) => address);
};

function ipv4Number(address: string): number {
  return address.split('.').reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inV4Range(value: number, network: number, bits: number): boolean {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (network & mask);
}

export function isPublicAddress(input: string): boolean {
  const address = input.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(address) === 4) {
    const value = ipv4Number(address);
    return ![
      [ipv4Number('0.0.0.0'), 8], [ipv4Number('10.0.0.0'), 8],
      [ipv4Number('100.64.0.0'), 10], [ipv4Number('127.0.0.0'), 8],
      [ipv4Number('169.254.0.0'), 16], [ipv4Number('172.16.0.0'), 12],
      [ipv4Number('192.0.0.0'), 24], [ipv4Number('192.0.2.0'), 24],
      [ipv4Number('192.168.0.0'), 16], [ipv4Number('198.18.0.0'), 15],
      [ipv4Number('198.51.100.0'), 24], [ipv4Number('203.0.113.0'), 24],
      [ipv4Number('224.0.0.0'), 4], [ipv4Number('240.0.0.0'), 4],
    ].some(([network, bits]) => inV4Range(value, network, bits));
  }
  if (isIP(address) === 6) {
    if (address === '::' || address === '::1') return false;
    const mapped = address.match(/^::ffff:(.+)$/);
    if (mapped) {
      if (isIP(mapped[1]) === 4) return isPublicAddress(mapped[1]);
      const halves = mapped[1].split(':').map((part) => Number.parseInt(part, 16));
      if (halves.length === 2 && halves.every(Number.isFinite)) {
        return isPublicAddress(`${halves[0] >> 8}.${halves[0] & 255}.${halves[1] >> 8}.${halves[1] & 255}`);
      }
      return false;
    }
    const first = Number.parseInt(address.split(':')[0] || '0', 16);
    return !((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xffc0) === 0xfec0 || (first & 0xff00) === 0xff00);
  }
  return false;
}

export async function assertPublicHttpUrl(input: string | URL, lookup: DnsLookup = defaultLookup): Promise<URL> {
  let url: URL;
  try { url = input instanceof URL ? new URL(input.href) : new URL(input); }
  catch { throw new Error('URL must be a public HTTP(S) destination'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must be a public HTTP(S) destination');
  if (url.username || url.password) throw new Error('URL credentials are forbidden');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [hostname] : await lookup(hostname);
  if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
    throw new Error('URL resolves to a non-public destination');
  }
  return url;
}

export async function resolveAndValidateDestination(base: string | URL, destination: string, lookup: DnsLookup = defaultLookup): Promise<URL> {
  return assertPublicHttpUrl(new URL(destination, base), lookup);
}
