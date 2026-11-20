import { installNimiShellRuntimeBridge } from '@nimiplatform/kit/shell/renderer/bridge';
import { createDesktopNimiAppSession } from '@nimiplatform/kit/auth/app/desktop';
import { mountInscape } from './shell/mount-inscape.js';

installNimiShellRuntimeBridge();
const dispose = mountInscape(createDesktopNimiAppSession(), { kind: 'desktop' });
if (import.meta.hot) import.meta.hot.dispose(dispose);
