import {describe, it, expect, beforeEach, vi} from 'vitest';
import * as git from '../src/git.js';
import * as github from '@actions/github';
import * as process from 'process';
import {fileURLToPath} from 'node:url';
import * as path from 'node:path';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(currentDir, '..');

describe('getBaseRef', () => {
  it('should return input base ref if provided', () => {
    try {
      process.env['INPUT_BASE-REF'] = 'origin/feature-branch';
      const baseRef = git.getBaseRef();
      expect(baseRef).toBe('origin/feature-branch');
    } finally {
      delete process.env['INPUT_BASE-REF'];
    }
  });

  it('should prepend origin if not set', () => {
    try {
      process.env['INPUT_BASE-REF'] = 'feature-branch';
      const baseRef = git.getBaseRef();
      expect(baseRef).toBe('origin/feature-branch');
    } finally {
      delete process.env['INPUT_BASE-REF'];
    }
  });

  it('should return pull request base ref if in PR context', () => {
    const originalPayload = github.context.payload;
    try {
      github.context.payload = {
        pull_request: {
          number: 303,
          base: {
            ref: 'develop'
          }
        }
      };
      const baseRef = git.getBaseRef();
      expect(baseRef).toBe('origin/develop');
    } finally {
      github.context.payload = originalPayload;
    }
  });

  it('should return default base ref if no input or PR context', () => {
    const originalPayload = github.context.payload;
    try {
      github.context.payload = {};
      const baseRef = git.getBaseRef();
      expect(baseRef).toBe('origin/main');
    } finally {
      github.context.payload = originalPayload;
    }
  });
});

describe('getFileFromRef', () => {
  beforeEach(() => {
    vi.mock(import('@actions/core'), async (importModule) => {
      const mod = await importModule();
      return {
        ...mod,
        info: vi.fn(),
        error: vi.fn()
      };
    });
  });

  it('should return file content from a given ref', () => {
    const content = git.getFileFromRef('HEAD', 'package.json', rootDir);
    expect(content).toBeDefined();
    expect(content).toContain('"name":');
  });

  it('should return null if file does not exist in the given ref', () => {
    const content = git.getFileFromRef('HEAD', 'nonexistentfile.txt', rootDir);
    expect(content).toBeNull();
  });
});
