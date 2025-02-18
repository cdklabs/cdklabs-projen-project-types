import { readFileSync, writeFileSync } from 'fs';

function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: gather-versions [PACKAGE] [VERSION-MATCH] --deps [DEPENDENCIES]\n');
    console.log('Positionals:');
    console.log('  PACKAGE\tThe name of the package to gather versions for');
    console.log('  VERSION-MATCH\tHow dependency constraints are defined. One of: MAJOR (^), MINOR (~), EXACT');
    console.log('  DEPENDENCIES\tNames of the dependencies to gather versions from.');
    return;
  }

  const [packageName, versionMatch, _dashDashDeps, ...deps] = process.argv.slice(1);

  const manifest = dependencyInfo(packageName);

  const prefix = versionConstraint(versionMatch);

  for (const dep of deps) {
    const depVersion = dependencyInfo(dep).version;
    console.log(dep, depVersion);
    if (manifest.devDependencies?.[dep]) {
      manifest.devDependencies[dep] = prefix + depVersion;
    }
    if (manifest.dependencies?.[dep]) {
      manifest.dependencies[dep] = prefix + depVersion;
    }

    writeFileSync('package.json', JSON.stringify(manifest, null, 2) + '\n');
  }
}

function dependencyInfo(dependency: string): any {
  // Search needs to be w.r.t. the current directory, otherwise it is w.r.t. the current
  // file and that doesn't work if `cdklabs-projen-project-types` is locally symlinked.
  return JSON.parse(readFileSync(require.resolve(`${dependency}/package.json`, { paths: [process.cwd()] })).toString());
}

function versionConstraint(versionMatch: string): string {
  switch (versionMatch.toUpperCase()) {
    case 'MAJOR':
    case '^':
      return '^';
    case 'MINOR':
    case '~':
      return '~';
    case 'EXACT':
      return '';
    default:
      throw new Error(`Unknown VERSION-MATCH: ${versionMatch}`);
  }
}

main();
