import { cdk } from 'projen';
import { MergeQueue } from './src';

const project = new cdk.JsiiProject({
  projenrcTs: true,
  author: 'AWS',
  authorAddress: 'aws-cdk-dev@amazon.com',
  defaultReleaseBranch: 'main',
  name: 'cdklabs-projen-project-types',
  repositoryUrl: 'https://github.com/cdklabs/cdklabs-projen-project-types.git',
  deps: ['projen'],
  bundledDeps: ['yaml'],
  peerDeps: ['projen'],
  autoApproveUpgrades: true,
  autoApproveOptions: { allowedUsernames: ['cdklabs-automation'], secret: 'GITHUB_TOKEN' },
});

new MergeQueue(project, {
  autoMergeOptions: {
    secret: 'PROJEN_GITHUB_TOKEN',
  },
});
project.synth();
