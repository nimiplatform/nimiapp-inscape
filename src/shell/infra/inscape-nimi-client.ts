import type { NimiLocalAppClient } from '@nimiplatform/sdk/app';

let inscapeClient: NimiLocalAppClient | null = null;

export function setInscapeNimiClient(client: NimiLocalAppClient | null): void {
  inscapeClient = client;
}

export function hasInscapeNimiClient(): boolean {
  return inscapeClient !== null;
}

export function getInscapeNimiClient(): NimiLocalAppClient {
  if (!inscapeClient) throw new Error('Inscape Runtime access is unavailable.');
  return inscapeClient;
}
