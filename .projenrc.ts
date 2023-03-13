import { cdk } from 'projen';
import { generateYarnMonorepoOptions } from './projenrc/yarn-monorepo-options';
import { MergeQueue } from './src/merge-queue';

const project = new cdk.JsiiProject({
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
  githubOptions: {
    mergify: false,
  },
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
});

new MergeQueue(project, {
  autoMergeOptions: {
    secret: 'PROJEN_GITHUB_TOKEN',
  },
});

generateYarnMonorepoOptions(project);

project.synth();
