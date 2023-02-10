import { Testing } from 'projen';
import * as yaml from 'yaml';
import { TestPrivateProject } from './private-helpers';

describe('auto merge', () => {
  test('sets up auto merge correctly', () => {
    const project = new TestPrivateProject();

    const out = Testing.synth(project);
    expect(yaml.parse(out['.github/workflows/build.yml'])).toMatchObject({
      on: {
        merge_group: {
          branches: [
            'main',
          ],
        },
      },
    });
    expect(out['.github/workflows/auto-merge.yml']).toMatchSnapshot();
  });
});
