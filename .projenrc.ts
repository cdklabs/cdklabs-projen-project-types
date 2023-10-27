import { DependencyType, javascript } from 'projen';
import { generateYarnMonorepoOptions } from './projenrc/yarn-monorepo-options';
import { CdklabsJsiiProject } from './src';

const project = new CdklabsJsiiProject({
  private: false,
  projenrcTs: true,
  author: 'AWS',
  authorAddress: 'aws-cdk-dev@amazon.com',
  defaultReleaseBranch: 'main',
  name: 'cdklabs-projen-project-types',
  repositoryUrl: 'https://github.com/cdklabs/cdklabs-projen-project-types.git',
  devDeps: ['@jsii/spec', 'jsii-reflect'],
  deps: ['projen'],
  bundledDeps: ['yaml'],
  peerDeps: ['projen'],
  enablePRAutoMerge: true,
  cdklabsPublishingDefaults: false,
  upgradeCdklabsProjenProjectTypes: false, // that is this project!
  depsUpgrade: false,
  setNodeEngineVersion: false,
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation', 'dependabot[bot]'],
    secret: 'GITHUB_TOKEN',
  },
});

new javascript.UpgradeDependencies(project, {
  taskName: 'upgrade',
  types: [DependencyType.RUNTIME, DependencyType.BUNDLED, DependencyType.PEER],
  semanticCommit: 'fix',
  workflowOptions: {
    labels: ['auto-approve'],
    schedule: javascript.UpgradeDependenciesSchedule.expressions(['0 18 * * *']),
  },
});

new javascript.UpgradeDependencies(project, {
  taskName: 'upgrade-dev-deps',
  types: [DependencyType.BUILD, DependencyType.DEVENV, DependencyType.TEST],
  semanticCommit: 'chore',
  pullRequestTitle: 'upgrade dev dependencies',
  workflowOptions: {
    labels: ['auto-approve'],
  },
});

generateYarnMonorepoOptions(project);

// that is this package!
project.deps.removeDependency(project.name);

project.synth();
