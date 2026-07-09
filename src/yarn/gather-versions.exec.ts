import { readFileSync, writeFileSync } from 'fs';

export function cliMain() {
  main(process.argv.slice(1), process.cwd());
}

export function main(argv: string[], packageDirectory: string) {
  if (argv.includes('--help')) {
    console.error('Usage: gather-versions [PKG=TYPE] [PKG=TYPE] [...]\n');
    console.error('Positionals:');
    console.error('  PKG\tPackage name.');
    console.error('  TYPE\tany-minor | future-minor | any-patch | future-patch | exact | any-future | any');
    console.error('');
    console.error('If $RESET_VERSIONS is "true", ignore the version specifier and just reset all packages to ^0.0.0');
    process.exitCode = 1;
    return;
  }

  const isReset = process.env.RESET_VERSIONS === 'true';

  // Set to 'true' by the monorepo release task while it bumps and builds packages.
  // Used to enforce the guard below only during a real release (not local dev/synth).
  const isRelease = process.env.RELEASE === 'true';

  const deps = Object.fromEntries(argv.map(x => x.split('=', 2) as [string, string]));

  // The PJ file we are updating
  const targetPjFile = `${packageDirectory ?? '.'}/package.json`;

  const manifest = JSON.parse(readFileSync(targetPjFile, 'utf-8'));
  const changeReport: any = {
    name: manifest.name,
    version: manifest.version,
  };

  for (const [dep, depType] of Object.entries(deps)) {
    const depVersion = dependencyInfo(dep, packageDirectory).version;

    // A dependency that still resolves to the 0.0.0 placeholder was not versioned before this
    // package gathered its dependency ranges: the dependency's bump task did not run (it was skipped
    // or failed), so its package.json still holds the projen 0.0.0 placeholder. Writing a range off
    // 0.0.0 publishes a broken '^0.0.0' (or '0.0.0'/'~0.0.0'/'>=0.0.0') dependency that npm resolves
    // to the ancient 0.0.0 artifact. Fail loudly instead of publishing it. Only enforced for
    // runtime/peer dependencies declared on this package, and only during a release, so local
    // dev/synth and the reset (unbump) path are unaffected.
    const isRuntimeOrPeerDep = Boolean(manifest.dependencies?.[dep]) || Boolean(manifest.peerDependencies?.[dep]);
    if (isRelease && !isReset && isRuntimeOrPeerDep && depVersion === '0.0.0') {
      throw new Error(
        `gather-versions: dependency '${dep}' of '${manifest.name}' resolved to the placeholder version 0.0.0. ` +
        `Its bump task did not run before '${manifest.name}' gathered versions (skipped or failed), so publishing ` +
        'now would ship a broken \'^0.0.0\' range. Re-run the release; if it recurs, check why the bump task for ' +
        `'${dep}' was skipped (see its task condition).`,
      );
    }

    const rangeVersion = versionForRange(depType, depVersion);

    const dependencyClasses = [
      ['dependencies', rangeVersion],
      ['peerDependencies', rangeVersion],
      // It doesn't matter what we do for devDependencies (might even do
      // nothing), but it feels like nice form to show the exact version we used
      // when we built this package.
      ['devDependencies', depVersion],
    ];

    for (const [depSection, computedVersion] of dependencyClasses) {
      const bumpForward = !isReset;
      const updatedRange = bumpForward ? computedVersion : '^0.0.0';

      if (manifest[depSection]?.[dep]) {
        manifest[depSection][dep] = updatedRange;

        // Also update the report so that we can print what we did.
        // The below syntax works regardless of whether depSection already
        // exists or not, and only adds depSection if there are changes in it.
        changeReport[depSection] = {
          ...changeReport[depSection],
          [dep]: updatedRange,
        };
      }
    }
  }

  // Print a report of what we did
  console.log('Updated versions', JSON.stringify(changeReport, undefined, 2));

  writeFileSync(targetPjFile, JSON.stringify(manifest, null, 2) + '\n');
}

function dependencyInfo(dependency: string, searchDirectory: string): any {
  // Search needs to be w.r.t. the current directory, otherwise it is w.r.t. the current
  // file and that doesn't work if `cdklabs-projen-project-types` is locally symlinked.

  // This will throw if the resolution fails
  const pjLoc = require.resolve(`${dependency}/package.json`, { paths: [searchDirectory] });
  return JSON.parse(readFileSync(pjLoc, 'utf-8'));
}

function versionForRange(depType: string, version: string) {
  const runtimePrefix = prefixFromRange(depType);

  switch (depType) {
    case 'future-minor':
    case 'future-patch':
    case 'any-future':
    case 'exact':
      return runtimePrefix + version;
    case 'any':
      return '*';
  }

  const details = semver(version);
  switch (depType) {
    case 'any-minor':
      return `${runtimePrefix}${details.major}`;
    case 'any-patch':
      return `${runtimePrefix}${details.major}.${details.minor}`;
  }

  return runtimePrefix + version;
}

/**
 * @see https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
 */
function semver(version: string) {
  const res = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.exec(version);

  if (!res) {
    throw new Error(`Cannot parse version: ${version}`);
  }

  return {
    version: res[0],
    major: res[1],
    minor: res[2],
    patch: res[3],
    prerelease: res[4],
    buildmetadata: res[5],
  };
}

function prefixFromRange(x: string): string {
  switch (x) {
    case 'any-minor':
    case 'future-minor':
      return '^';
    case 'any-patch':
    case 'future-patch':
      return '~';
    case 'any':
    case 'exact':
      return '';
    case 'any-future':
      return '>=';
    default:
      throw new Error(`Unknown range type: ${x}`);
  }
}
