import { javascript, JsonPatch } from 'projen';
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
  peerDeps: ['projen@>=0.88.6 <1.0.0'],
  enablePRAutoMerge: true,
  upgradeCdklabsProjenProjectTypes: false, // that is this project!
  setNodeEngineVersion: false,
  peerDependencyOptions: {
    pinnedDevDependency: false,
  },
  jsiiVersion: '~5.9',
  typescriptVersion: '~5.9',

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

// Workaround: projen doesn't add corepack enable to package-js job for Yarn Berry
project.github?.tryFindWorkflow('build')?.file?.patch(
  JsonPatch.add('/jobs/package-js/steps/4', { name: 'Enable corepack', run: 'corepack enable' }),
);

project.synth();
