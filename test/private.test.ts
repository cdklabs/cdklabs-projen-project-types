import { Testing } from 'projen';
import { expectPrivate, TestPrivateProject } from './private-helpers';

describe('Private Component', () => {
  test('configures correct restrictions', () => {
    const project = new TestPrivateProject();

    expectPrivate(Testing.synth(project));
  });

  test('trumps any initial configurations', () => {
    const project = new TestPrivateProject({
      private: true,
      npmignoreEnabled: true,
      githubOptions: {
        mergifyOptions: {
          rules: [{
            name: 'test-rule',
            actions: { merge: { method: 'merge' } },
            conditions: ['\"#approved-reviews-by>=2\"'],
          }],
        },
      },
    });

    expectPrivate(Testing.synth(project));
  });
});

