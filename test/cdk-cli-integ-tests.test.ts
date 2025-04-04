import { Testing } from 'projen';
import { CdkCliIntegTestsWorkflow, yarn } from '../src';

test('snapshot test for the CDK CLI integ tests', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  new CdkCliIntegTestsWorkflow(repo, {
    approvalEnvironment: 'approval',
    testEnvironment: 'test',
    buildRunsOn: 'runsOn',
    testRunsOn: 'testRunsOn',
    localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
    sourceRepo: 'aws/some-repo',
    allowUpstreamVersions: ['@aws-cdk/bla'],
  });

  const outdir = Testing.synth(repo);
  expect(outdir).toMatchSnapshot();
});

test('snapshot test for the CDK CLI integ tests using atmosphere', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  new CdkCliIntegTestsWorkflow(repo, {
    approvalEnvironment: 'approval',
    testEnvironment: 'test',
    buildRunsOn: 'runsOn',
    testRunsOn: 'testRunsOn',
    localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
    sourceRepo: 'aws/some-repo',
    allowUpstreamVersions: ['@aws-cdk/bla'],
    enableAtmosphere: {
      endpoint: 'atmosphere.endpoint',
      pool: 'atmosphere.pool',
      oidcRoleArn: 'oidcRoleArn',
    },
  });

  const outdir = Testing.synth(repo);
  expect(outdir).toMatchSnapshot();
});

test('can set maxworkers', () => {
  const repo = new yarn.CdkLabsMonorepo({
    name: 'monorepo',
    defaultReleaseBranch: 'main',
  });

  new CdkCliIntegTestsWorkflow(repo, {
    approvalEnvironment: 'approval',
    testEnvironment: 'test',
    buildRunsOn: 'runsOn',
    testRunsOn: 'testRunsOn',
    localPackages: ['@aws-cdk/bla', '@aws-cdk/bloeh'],
    sourceRepo: 'aws/some-repo',
    maxWorkers: '500',
  });

  const outdir = Testing.synth(repo);
  expect(outdir['.github/workflows/integ.yml']).toContain('run: bin/run-suite --maxWorkers=500 --use-cli-release=');
});
