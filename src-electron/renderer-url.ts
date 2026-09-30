// @nimi-authority: rule.inscape.privacy.r006
function loopbackOrigin(value: string): string {
  if (!value.trim()) return '';
  const parsed = new URL(value.trim());
  if (parsed.protocol !== 'http:' ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname.toLowerCase()) ||
      !parsed.port || Number(parsed.port) < 1 || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash)
    throw new Error('Nimi development renderer URL must be exact loopback.');
  return parsed.origin;
}

export function resolveDevelopmentRendererUrl(args: readonly string[], environmentValue: string, production: boolean): string {
  const prefix = '--nimi-dev-renderer-url=';
  const values = args.filter((value) => value.startsWith(prefix));
  if (production) {
    if (values.length) throw new Error('Production Inscape does not accept development renderer arguments.');
    return '';
  }
  if (values.length > 1) throw new Error('Nimi development renderer URL must be singular.');
  if (values.length) {
    const value = values[0].slice(prefix.length);
    if (!value.trim()) throw new Error('Nimi development renderer URL must not be empty.');
    return loopbackOrigin(value);
  }
  return loopbackOrigin(environmentValue);
}
