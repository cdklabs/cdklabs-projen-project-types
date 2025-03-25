import { readFileSync, writeFileSync } from 'fs';

export function cliMain() {
  main(process.argv.slice(1), process.cwd());
}

export function main(argv: string[], packageDirectory: string) {
  if (argv.includes('--help')) {
    console.error('Usage: gather-versions [PKG=TYPE] [PKG=TYPE] [...]\n');
    console.error('Positionals:');
    console.error('  PKG\tPackage name.');
    console.error('  TYPE\tmajor | minor | exact | minimal');
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
    const runtimePrefix = prefixFromRange(depType);

    const dependencyClasses = [
      ['dependencies', runtimePrefix],
      ['peerDependencies', runtimePrefix],
      // It doesn't matter what we do for devDependencies (might even do
      // nothing), but it feels like nice form to show the exact version we used
      // when we built this package.
      ['devDependencies', ''],
    ];

    for (const [depSection, prefix] of dependencyClasses) {
      const bumpForward = !isReset;
      const updatedRange = bumpForward ? prefix + depVersion : '^0.0.0';

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

function prefixFromRange(x: string): string {
  switch (x) {
    case 'major':
      return '^';
    case 'minor':
      return '~';
    case 'exact':
      return '';
    case 'minimal':
      return '>=';
    default:
      throw new Error(`Unknown range type: ${x}`);
  }
}
