import { readFileSync, writeFileSync } from 'fs';

export function cliMain() {
  main(process.argv.slice(1), process.cwd());
}

export function main(argv: string[], packageDirectory: string) {
  if (argv.includes('--help') || argv.length < 2) {
    console.log('Usage: gather-versions [DEPENDENCIES]\n');
    console.log('Positionals:');
    console.log('  DEPENDENCIES\tNames of the dependencies to gather versions from.');
    return;
  }

  const [...deps] = argv;

  // The PJ file we are updating
  const targetPjFile = `${packageDirectory ?? '.'}/package.json`;

  const manifest = JSON.parse(readFileSync(targetPjFile, 'utf-8'));
  const changeReport: any = {
    name: manifest.name,
    version: manifest.version,
  };

  for (const dep of deps) {
    const depVersion = dependencyInfo(dep, packageDirectory).version;

    for (const depSection of ['dependencies', 'devDependencies', 'peerDependencies']) {
      if (manifest[depSection]?.[dep]) {
        manifest[depSection][dep] = replaceVersion(manifest[depSection][dep], depVersion);

        changeReport[depSection] = {
          ...changeReport[depSection],
          [dep]: manifest[depSection][dep],
        };
      }
    }
  }

  // Print a report of what we did
  console.log('New versions', JSON.stringify(changeReport, undefined, 2));

  writeFileSync(targetPjFile, JSON.stringify(manifest, null, 2) + '\n');
}

function dependencyInfo(dependency: string, searchDirectory: string): any {
  // Search needs to be w.r.t. the current directory, otherwise it is w.r.t. the current
  // file and that doesn't work if `cdklabs-projen-project-types` is locally symlinked.
  const pjLoc = require.resolve(`${dependency}/package.json`, { paths: [searchDirectory] });
  if (!pjLoc) {
    throw new Error(`Could not find ${dependency} in ${searchDirectory}`);
  }
  return JSON.parse(readFileSync(pjLoc, 'utf-8'));
}

/**
 * In a semver range, replace the string `0.0.0` with a different version
 *
 * If the semver range contains symbols like `^` or `>=`, they will be left
 * in.
 */
function replaceVersion(versionRange: string, version: string): string {
  return versionRange.replace(/0\.0\.0/g, version);
}
