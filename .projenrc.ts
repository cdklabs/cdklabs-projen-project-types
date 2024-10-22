import { UpgradeDependenciesSchedule } from 'projen/lib/javascript';
import { generateCdkCommonOptions } from './projenrc/cdk-common-options';
import { generateCdkConstructLibraryOptions } from './projenrc/cdk-construct-library-options';
import { generateCdkJsiiOptions } from './projenrc/cdk-jsii-options';
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
  devDeps: ['@jsii/spec', 'jsii-reflect', 'projen'],
  bundledDeps: ['yaml'],
  peerDeps: ['projen@>=0.88.6 <1.0.0'],
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
  jsiiVersion: '~5.5',
  typescriptVersion: '~5.5',
});
project.addPeerDeps('constructs@^10.0.0');

generateCdkCommonOptions(project);
generateYarnMonorepoOptions(project);
generateCdkConstructLibraryOptions(project);
generateCdkJsiiOptions(project);

// that is this package!
project.deps.removeDependency(project.name);

project.synth();
