import { createWebNimiAppSession, type NimiRemoteAppConfig } from '@nimiplatform/kit/auth/app/web';
import { mountInscape } from './shell/mount-inscape.js';

declare const __NIMI_APP_WEB_CONFIG__: NimiRemoteAppConfig;
const dispose = mountInscape(createWebNimiAppSession(__NIMI_APP_WEB_CONFIG__), { kind: 'web' });
if (import.meta.hot) import.meta.hot.dispose(dispose);
