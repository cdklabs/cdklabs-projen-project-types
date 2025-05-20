import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { Project, TaskRuntime } from 'projen';
import { yarn } from '../src';
import { TypeScriptWorkspaceOptions, VersionType } from '../src/yarn';
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
          depA: '*',
          depB: '*',
        },
        devDependencies: {
          depB: '^0.0.0',
        },
        peerDependencies: {
          depC: '^0.0.0',
        },
      },
    });

    // WHEN
    main(['depA=exact', 'depB=major', 'depC=minimal'], dir);

    // THEN
    expect(JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'))).toEqual({
      name: 'root',
      dependencies: {
        depA: '1.2.3',
        depB: '^4.5.6',
      },
      devDependencies: {
        depB: '4.5.6', // devDependency always point
      },
      peerDependencies: {
        depC: '>=7.8.9',
      },
    });
  });
});

test('if RESET_VERSIONS is true, gather-versions ignores command line and reverts ^0.0.0', async () => {
  await withTempDir(async (dir) => {
    await writeJsonFiles(dir, {
      'node_modules/depA/package.json': {
        name: 'depA',
        version: '0.0.0',
      },
      'package.json': {
        name: 'root',
        dependencies: {
          depA: '1.2.3',
        },
      },
    });

    // WHEN
    process.env.RESET_VERSIONS = 'true';
    main(['depA=exact'], dir);
    delete process.env.RESET_VERSIONS;

    // THEN
    expect(JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf-8'))).toEqual({
      name: 'root',
      dependencies: {
        depA: '^0.0.0',
      },
    });
  });
});

const NO_DEVDEPS: Partial<TypeScriptWorkspaceOptions> = {
  // We're actually installing these, so cut down on deps
  jest: false,
  eslint: false,
  prettier: false,
};

test.each([0, 1, 2])('make sure gather-versions works for %p dependencies', async (N) => {
  // GIVEN
  const parent = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
    release: true,
  });
  let deps: yarn.TypeScriptWorkspace[] = [];
  for (let i = 0; i < N; i++) {
    deps.push(new yarn.TypeScriptWorkspace({
      parent,
      name: `@cdklabs/dep${i}`,
      ...NO_DEVDEPS,
    }));
  }

  // WHEN
  const pack = new yarn.TypeScriptWorkspace({
    parent,
    name: '@cdklabs/two',
    deps: deps.map(dep => dep.customizeReference({ versionType: 'exact' })),
    ...NO_DEVDEPS,
  });

  // THEN
  parent.synth();
  // Running this script requires the package to have been compiled before we see any updates to the script
  await addSymlinkToMe(parent);
  new TaskRuntime(pack.outdir).runTask('gather-versions');

  const packageJson = JSON.parse(await fs.readFile(path.join(pack.outdir, 'package.json'), 'utf-8'));
  for (let i = 0; i < N; i++) {
    expect(Object.entries(packageJson.dependencies)).toContainEqual([
      `@cdklabs/dep${i}`, '0.0.0',
    ]);
  }
}, 60_000); // Needs to install real packages

test('gather-versions with different reference types', async () => {
  const expected: Record<VersionType, string> = {
    'major': '^0.0.0',
    'minor': '~0.0.0',
    'exact': '0.0.0',
    'minimal': '>=0.0.0',
    'current-major': '^0',
    'current-minor': '~0.0',
    'any': '*',
  };

  // GIVEN
  const parent = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
    release: true,
  });

  let deps: yarn.IWorkspaceReference[] = [];
  for (const refType of Object.keys(expected) as VersionType[]) {
    deps.push((new yarn.TypeScriptWorkspace({
      parent,
      name: `@cdklabs/dep-${refType}`,
      ...NO_DEVDEPS,
    })).customizeReference({ versionType: refType }));
  }

  // WHEN
  const pack = new yarn.TypeScriptWorkspace({
    parent,
    name: '@cdklabs/pack',
    deps,
    ...NO_DEVDEPS,
  });

  // THEN
  parent.synth();
  // Running this script requires the package to have been compiled before we see any updates to the script
  await addSymlinkToMe(parent);
  new TaskRuntime(pack.outdir).runTask('gather-versions');

  const packageJson = JSON.parse(await fs.readFile(path.join(pack.outdir, 'package.json'), 'utf-8'));
  for (const [refType, expectedVersion] of Object.entries(expected)) {
    expect(Object.entries(packageJson.dependencies)).toContainEqual([
      `@cdklabs/dep-${refType}`, expectedVersion,
    ]);
  }
}, 60_000); // Needs to install real packages

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

/**
 * (Temporarily) symlink this package into the `node_modules` directory of a project.
 *
 * This is necessary because running our script does a `require.resolve('cdklabs-projen-project-types')`.
 */
async function addSymlinkToMe(project: Project) {
  const pkgRoot = path.join(__dirname, '..');

  const name = JSON.parse(await fs.readFile(`${pkgRoot}/package.json`, 'utf-8')).name;
  const symlinkName = `${project.outdir}/node_modules/${name}`;
  await fs.symlink(pkgRoot, symlinkName);
}
