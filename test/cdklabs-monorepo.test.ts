import { Testing } from 'projen/lib/testing';
import { yarn } from '../src';

describe('CdkLabsMonorepo', () => {
  test('synthesizes with default settings', () => {
    const parent = new yarn.CdkLabsMonorepo({
      name: 'monorepo',
      defaultReleaseBranch: 'main',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: 'monorepo/one',
    });

    new yarn.TypeScriptWorkspace({
      parent,
      name: 'monorepo/two',
    });

    const outdir = Testing.synth(parent);

    expect(outdir).toMatchSnapshot();
  });
});
