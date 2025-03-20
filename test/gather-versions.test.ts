import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { main } from '../src/yarn/gather-versions.exec';
import { yarn } from '../src';
import { Project, TaskRuntime } from 'projen';
import { TypeScriptWorkspaceOptions } from '../src/yarn';

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

const NO_DEVDEPS: Partial<TypeScriptWorkspaceOptions> = {
  // We're actually installing these, so cut down on deps
  jest: false,
  eslint: false,
  prettier: false,
};

test('make sure a run of gather-versions writes the right version to package.json', async () => {
  // GIVEN
  const parent = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
    release: true,
  });

  const dep = new yarn.TypeScriptWorkspace({
    parent,
    name: '@cdklabs/one',
    ...NO_DEVDEPS,
  });

  // WHEN
  const pack = new yarn.TypeScriptWorkspace({
    parent,
    name: '@cdklabs/two',
    deps: [dep.customizeReference({ versionType: 'exact' })],
    ...NO_DEVDEPS,
  });

  // THEN
  parent.synth();
  // Running this script requires the package to have been compiled before we see any updates to the script
  await addSymlinkToMe(parent);
  new TaskRuntime(pack.outdir).runTask('gather-versions');

  const packageJson = JSON.parse(await fs.readFile(path.join(pack.outdir, 'package.json'), 'utf-8'));
  expect(Object.entries(packageJson.dependencies)).toContainEqual([
    '@cdklabs/one', '0.0.0',
  ]);
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
