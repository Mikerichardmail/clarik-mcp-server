import { describe, it, expect } from '@jest/globals';
import { checkRepoGuard } from './repo_guard.js';

describe('Clarik Safety: Repo Guard Interceptor', () => {
  describe('checkRepoGuard', () => {
    it('should allow modifications to unprotected files freely', async () => {
      const result = await checkRepoGuard('src/index.ts', 'edit');
      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('not in a protected pattern');
    });

    it('should intercept migrations files', async () => {
      const result = await checkRepoGuard('src/migrations/001_users.sql', 'edit');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Database migration file');
    });

    it('should intercept env config files', async () => {
      const resultA = await checkRepoGuard('.env', 'edit');
      const resultB = await checkRepoGuard('.env.production', 'delete');
      const resultC = await checkRepoGuard('.env.local', 'create');

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(false);
      expect(resultC.allowed).toBe(false);
    });

    it('should intercept secret files', async () => {
      const result = await checkRepoGuard('secrets.json', 'edit');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('secrets or sensitive data');
    });

    it('should intercept github actions workflows', async () => {
      const result = await checkRepoGuard('.github/workflows/deploy.yml', 'edit');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CI/CD workflow');
    });

    it('should intercept production and prod configurations', async () => {
      const resultA = await checkRepoGuard('production.json', 'edit');
      const resultB = await checkRepoGuard('prod.yaml', 'edit');
      const resultC = await checkRepoGuard('config/production.yml', 'edit');

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(false);
      expect(resultC.allowed).toBe(false);
    });

    it('should intercept production docker configs', async () => {
      const resultA = await checkRepoGuard('docker-compose.prod.yml', 'edit');
      const resultB = await checkRepoGuard('Dockerfile.prod', 'edit');

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(false);
    });

    it('should intercept certificate and key files', async () => {
      const resultA = await checkRepoGuard('server.key', 'edit');
      const resultB = await checkRepoGuard('cert.crt', 'edit');
      const resultC = await checkRepoGuard('ca.pem', 'edit');

      expect(resultA.allowed).toBe(false);
      expect(resultB.allowed).toBe(false);
      expect(resultC.allowed).toBe(false);
    });

    it('should intercept credentials files', async () => {
      const result = await checkRepoGuard('aws_credentials', 'edit');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Credentials file');
    });

    it('should handle Windows and Posix directory separators interchangeably', async () => {
      const resultUnix = await checkRepoGuard('migrations/001_users.sql', 'edit');
      const resultWin = await checkRepoGuard('migrations\\001_users.sql', 'edit');

      expect(resultUnix.allowed).toBe(false);
      expect(resultWin.allowed).toBe(false);
    });
  });
});
