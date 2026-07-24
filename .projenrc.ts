import { DependencyType, javascript } from 'projen';
import { generateCdkCommonOptions } from './projenrc/cdk-common-options';
import { generateCdkConstructLibraryOptions } from './projenrc/cdk-construct-library-options';
import { generateCdkJsiiOptions } from './projenrc/cdk-jsii-options';
import { generateYarnMonorepoOptions } from './projenrc/yarn-monorepo-options';
import { CdklabsJsiiProject } from './src';

const project = new CdklabsJsiiProject({
  private: false,
  projenrcTs: true,
  packageManager: javascript.NodePackageManager.YARN_BERRY,
  author: 'AWS',
  authorAddress: 'aws-cdk-dev@amazon.com',
  defaultReleaseBranch: 'main',
  name: 'cdklabs-projen-project-types',
  repositoryUrl: 'https://github.com/cdklabs/cdklabs-projen-project-types.git',
  devDeps: ['@jsii/spec', 'jsii-reflect', 'projen'],
  bundledDeps: ['yaml'],
  peerDeps: ['projen@>=0.101.15 <1.0.0'],
  enablePRAutoMerge: true,

  // we manage dep upgrades separately for this project
  upgradeCdklabsProjenProjectTypes: false,
  upgradeRuntimeDepsAsFix: false,
  depsUpgrade: false,

  setNodeEngineVersion: false,
  peerDependencyOptions: {
    pinnedDevDependency: false,
  },
  jsiiVersion: '~5.9',
  typescriptVersion: '~5.9',
  tsconfig: {
    compilerOptions: {
      isolatedModules: true,
    },
  },

  // Custom publishing settings since we only release to npm
  cdklabsPublishingDefaults: false,
  npmTrustedPublishing: true,
  releaseEnvironment: 'release',
});
project.addPeerDeps('constructs@^10.0.0');

generateCdkCommonOptions(project);
generateYarnMonorepoOptions(project);
generateCdkConstructLibraryOptions(project);
generateCdkJsiiOptions(project);

// that is this package!
project.deps.removeDependency(project.name);

// Dependency Upgrades
new javascript.UpgradeDependencies(project, {
  taskName: 'upgrade',
  cooldown: 3,
  types: [DependencyType.RUNTIME, DependencyType. BUNDLED, DependencyType.DEVENV],
  include: [
    'projen',
    ...project.deps.all.filter(d => [DependencyType.RUNTIME, DependencyType. BUNDLED].includes(d.type)).map(d => d.name),
  ],
  semanticCommit: 'fix',
  workflowOptions: {
    labels: ['auto-approve'],
    // Run at 18:00Z every Monday
    schedule: javascript.UpgradeDependenciesSchedule.expressions(['0 18 * * 1']),
  },
});

new javascript.UpgradeDependencies(project, {
  taskName: 'upgrade-dev-deps',
  types: [DependencyType.BUILD, DependencyType.DEVENV, DependencyType.TEST],
  exclude: ['projen'],
  semanticCommit: 'chore',
  cooldown: 3,
  pullRequestTitle: 'upgrade dev dependencies',
  workflowOptions: {
    labels: ['auto-approve'],
    // Run at 22:00Z every Monday, this is deliberately after prod updates to avoid conflicts
    schedule: javascript.UpgradeDependenciesSchedule.expressions(['0 22 * * 1']),
  },
});

project.synth();
