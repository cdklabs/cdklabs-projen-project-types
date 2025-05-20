import { readFileSync, writeFileSync } from 'fs';

export function cliMain() {
  main(process.argv.slice(1), process.cwd());
}

export function main(argv: string[], packageDirectory: string) {
  if (argv.includes('--help')) {
    console.error('Usage: gather-versions [PKG=TYPE] [PKG=TYPE] [...]\n');
    console.error('Positionals:');
    console.error('  PKG\tPackage name.');
    console.error('  TYPE\tmajor | minor | exact | minimal | current-major | current-minor | any');
    console.error('');
    console.error('If $RESET_VERSIONS is "true", ignore the version specifier and just reset all packages to ^0.0.0');
    process.exitCode = 1;
    return;
  }

  const isReset = process.env.RESET_VERSIONS === 'true';

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
    case 'major':
    case 'minor':
    case 'exact':
    case 'minimal':
      return runtimePrefix + version;
    case 'any':
      return '*';
  }

  const details = semver(version);
  switch (depType) {
    case 'current-major':
      return `${runtimePrefix}${details.major}`;
    case 'current-minor':
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
    case 'current-major':
    case 'major':
      return '^';
    case 'current-minor':
    case 'minor':
      return '~';
    case 'any':
    case 'exact':
      return '';
    case 'minimal':
      return '>=';
    default:
      throw new Error(`Unknown range type: ${x}`);
  }
}
