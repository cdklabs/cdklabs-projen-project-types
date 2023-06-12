import { javascript } from 'projen';
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
  depsUpgradeOptions: {
    workflowOptions: {
      schedule: javascript.UpgradeDependenciesSchedule.expressions(['0 18 * * *']),
    },
  },
  setNodeEngineVersion: false,
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation', 'dependabot[bot]'],
    secret: 'GITHUB_TOKEN',
  },
});

generateYarnMonorepoOptions(project);

project.synth();
