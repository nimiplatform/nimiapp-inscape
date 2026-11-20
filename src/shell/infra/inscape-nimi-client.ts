import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';

let inscapeClient: NimiAppRuntimeClient | null = null;

export function setInscapeNimiClient(client: NimiAppRuntimeClient | null): void {
  inscapeClient = client;
}

export function hasInscapeNimiClient(): boolean {
  return inscapeClient !== null;
}

export function getInscapeNimiClient(): NimiAppRuntimeClient {
  if (!inscapeClient) throw new Error('Inscape Runtime access is unavailable.');
  return inscapeClient;
}
