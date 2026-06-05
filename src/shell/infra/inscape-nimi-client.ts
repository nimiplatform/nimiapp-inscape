import type { NimiClient } from '@nimiplatform/sdk';

let inscapeClient: NimiClient | null = null;

export function setInscapeNimiClient(client: NimiClient | null): void {
  inscapeClient = client;
}

export function hasInscapeNimiClient(): boolean {
  return inscapeClient !== null;
}

export function getInscapeNimiClient(): NimiClient {
  if (!inscapeClient) {
    throw new Error('Inscape Nimi client is not initialized. Run bootstrap before using Runtime surfaces.');
  }
  return inscapeClient;
}
