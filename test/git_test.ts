import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  afterEach,
  type MockInstance
} from 'vitest';
import * as git from '../src/git.js';
import * as github from '@actions/github';
import * as process from 'process';
import {fileURLToPath} from 'node:url';
import * as path from 'node:path';
import * as importedCore from '@actions/core';

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
  let errorSpy: MockInstance<(typeof importedCore)['error']>;

  beforeEach(() => {
    errorSpy = vi.spyOn(importedCore, 'error');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return file content from a given ref', () => {
    const content = git.getFileFromRef('HEAD', 'package.json', rootDir);
    expect(content).toBeDefined();
    expect(content).toContain('"name":');
    expect(errorSpy.mock.calls).toEqual([]);
  });

  it('should return null if file does not exist in the given ref', () => {
    const content = git.getFileFromRef('HEAD', 'nonexistentfile.txt', rootDir);
    expect(content).toBeNull();
    expect(errorSpy.mock.calls).toEqual([
      [
        'Failed to get file from ref "HEAD:nonexistentfile.txt": Error: Command failed: git show HEAD:nonexistentfile.txt\n' +
          "fatal: path 'nonexistentfile.txt' does not exist in 'HEAD'\n"
      ]
    ]);
  });
});

describe('tryGetJSONFromRef', () => {
  let errorSpy: MockInstance<(typeof importedCore)['error']>;

  beforeEach(() => {
    errorSpy = vi.spyOn(importedCore, 'error');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for non-existent file', () => {
    const result = git.tryGetJSONFromRef('HEAD', 'nonexistent.json', rootDir);
    expect(result).toBeNull();
    expect(errorSpy.mock.calls).toEqual([
      [
        'Failed to get file from ref "HEAD:nonexistent.json": Error: Command failed: git show HEAD:nonexistent.json\n' +
          "fatal: path 'nonexistent.json' does not exist in 'HEAD'\n"
      ]
    ]);
  });

  it('returns null for invalid JSON content', () => {
    const result = git.tryGetJSONFromRef('HEAD', 'README.md', rootDir);
    expect(result).toBeNull();
    expect(errorSpy.mock.calls).toEqual([
      [
        `Failed to get json from ref "HEAD:README.md": SyntaxError: Unexpected token '#', "# e18e/act"... is not valid JSON`
      ]
    ]);
  });

  it('returns parsed JSON object for valid JSON content', () => {
    const result = git.tryGetJSONFromRef('HEAD', 'package.json', rootDir);
    expect(result).toBeDefined();
    expect(result).toHaveProperty('name');
    expect(errorSpy.mock.calls).toEqual([]);
  });
});
