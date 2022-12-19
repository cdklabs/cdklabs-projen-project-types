const { cdk } = require('projen');
const project = new cdk.JsiiProject({
  author: 'AWS',
  authorAddress: 'aws-cdk-dev@amazon.com',
  defaultReleaseBranch: 'main',
  name: 'cdklabs-projen-project-types',
  repositoryUrl: 'https://github.com/cdklabs/cdklabs-projen-project-types.git',
  deps: ['projen', 'yaml'],
  peerDeps: ['projen'],
});
project.synth();