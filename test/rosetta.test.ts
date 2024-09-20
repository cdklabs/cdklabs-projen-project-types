import { Testing } from 'projen';
import { CdklabsConstructLibrary, CdklabsConstructLibraryOptions } from '../src/cdklabs';

describe('Rosetta', () => {
  test('has strict mode enabled by default', () => {
    const project = new TestCdkLabsConstructLibrary({
      rosettaOptions: {},
    });
    const outdir = Testing.synth(project);
    const tasks = outdir['.projen/tasks.json']?.tasks;

    expect(tasks?.['rosetta:extract'].steps[0]?.exec).toContain('jsii-rosetta extract --strict');
  });

  test('can disable strict mode', () => {
    const project = new TestCdkLabsConstructLibrary({
      rosettaOptions: {
        strict: false,
      },
    });
    const outdir = Testing.synth(project);
    const tasks = outdir['.projen/tasks.json']?.tasks;

    expect(tasks?.['rosetta:extract'].steps[0]?.exec).not.toContain('--strict');
  });

  test('has no version by default', () => {
    const project = new TestCdkLabsConstructLibrary({
      rosettaOptions: {},
    });
    const outdir = Testing.synth(project);
    const deps = outdir['.projen/deps.json'].dependencies;

    expect(deps).toEqual(expect.arrayContaining([{
      name: 'jsii-rosetta',
      type: 'build',
    }]));
  });

  test('can set a custom version', () => {
    const project = new TestCdkLabsConstructLibrary({
      rosettaOptions: {
        version: '5.1.x',
      },
    });
    const outdir = Testing.synth(project);
    const deps = outdir['.projen/deps.json'].dependencies;

    expect(deps).toEqual(expect.arrayContaining([{
      name: 'jsii-rosetta',
      version: '5.1.x',
      type: 'build',
    }]));
  });
});

class TestCdkLabsConstructLibrary extends CdklabsConstructLibrary {
  constructor(options: Partial<CdklabsConstructLibraryOptions> = {}) {
    super({
      name: '@cdklabs/test-construct-library',
      defaultReleaseBranch: 'main',
      repositoryUrl: '',
      author: 'AWS',
      authorAddress: 'aws-cdk-dev@amazon.com',
      cdkVersion: '2.1.0',
      ...options,
    });
  }
}
