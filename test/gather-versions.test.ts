import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { main } from '../src/yarn/gather-versions.exec';

// Test the actual gather-versions script
test('gather-versions updates all package versions respecting existing ranges', async () => {
  await withTempDir(async (dir) => {
    await writeJsonFiles(dir, {
      'node_modules/depA/package.json': {
        name: 'depA',
        version: '1.2.3',
      },
      'node_modules/depB/package.json': {
        name: 'depB',
        version: '4.5.6',
      },
      'node_modules/depC/package.json': {
        name: 'depC',
        version: '7.8.9',
      },
      'package.json': {
        name: 'root',
        dependencies: {
          depA: '0.0.0',
        },
        devDependencies: {
          depB: '^0.0.0',
        },
        peerDependencies: {
          depC: '>= 0.0.0',
        },
      },
    });

    // WHEN
    main(['depA', 'depB', 'depC'], dir);

    // THEN
    expect(JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'))).toEqual({
      name: 'root',
      dependencies: {
        depA: '1.2.3',
      },
      devDependencies: {
        depB: '^4.5.6',
      },
      peerDependencies: {
        depC: '>= 7.8.9',
      },
    });
  });
});

/**
 * Runs an async function in a temporary directory that gets cleaned up afterwards
 */
async function withTempDir<T>(
  fn: (tempDir: string) => Promise<T>,
): Promise<T> {
  const oldCwd = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'temp-'));
  try {
    return await fn(tempDir);
  } finally {
    process.chdir(oldCwd);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

/**
 * Writes JSON files to disk based on a mapping of filenames to data
 */
async function writeJsonFiles(root: string, files: Record<string, any>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([filename, data]) => {
      const fullPath = path.join(root, filename);

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    }),
  );
}
