import type { FhevmInstance } from "@/lib/fhevm/sdk";

type SignTypedData = (request: {
  domain: Record<string, unknown>;
  types: Record<string, readonly { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}) => Promise<`0x${string}`>;

interface Session {
  address: string;
  privateKey: string;
  publicKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
}

let session: Session | null = null;

/**
 * Creates one decryption authorisation per connected account and page session.
 * The keypair and signature live only in module memory. Nothing is written to
 * localStorage, cookies, IndexedDB, or any other persistent browser storage.
 */
export async function getUserDecryptSession(
  instance: FhevmInstance,
  address: `0x${string}`,
  contractAddresses: `0x${string}`[],
  signTypedData: SignTypedData,
): Promise<Session> {
  if (session?.address.toLowerCase() === address.toLowerCase()) return session;

  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const typedData = instance.createEIP712(
    keypair.publicKey,
    contractAddresses,
    startTimestamp,
    durationDays,
  );
  const signature = await signTypedData({
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message: typedData.message,
  });

  session = {
    address,
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
    signature,
    startTimestamp,
    durationDays,
  };
  return session;
}

