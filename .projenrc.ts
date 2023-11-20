import { UpgradeDependenciesSchedule } from 'projen/lib/javascript';
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
  devDeps: ['@jsii/spec', 'jsii-reflect', 'projen@0.77.1'],
  bundledDeps: ['yaml'],
  peerDeps: ['projen'],
  enablePRAutoMerge: true,
  cdklabsPublishingDefaults: false,
  upgradeCdklabsProjenProjectTypes: false, // that is this project!
  setNodeEngineVersion: false,
  depsUpgradeOptions: {
    workflowOptions: {
      schedule: UpgradeDependenciesSchedule.WEEKLY,
    },
  },
  peerDependencyOptions: {
    pinnedDevDependency: false,
  },
});
project.addPeerDeps('constructs@^10.0.0');
generateYarnMonorepoOptions(project);

// that is this package!
project.deps.removeDependency(project.name);

project.synth();
