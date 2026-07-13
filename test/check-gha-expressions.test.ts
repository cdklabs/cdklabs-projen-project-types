import { Project } from 'projen';
import { GitHub } from 'projen/lib/github';
import { CheckGhaExpressions } from '../src';

let project: Project;
let github: GitHub;

beforeEach(() => {
  project = new Project({ name: 'test' });
  github = new GitHub(project);
  new CheckGhaExpressions(project);
});

test.each([
  "github.event.pull_request.title",
  // Not actually dangerous but our scanner finds it anyway (on purpose)
  "github.event.issue.number",
  "github.ref_name",
  "github.repository",
  "github.repository_owner",
  "github.action_ref",
  "github.action_repository",
])(
  "detect direct use of dangerous expressions: %p",
  (expr) => {
    github.addWorkflow("test").addJob("job", {
      permissions: {},
      uses: "standard",
      steps: [
        {
          run: `echo "\${{ ${expr} }}"`,
        },
      ],
    });

    expect(() => project.synth()).toThrow(
      /Found dangerous expressions in workflow shell steps/,
    );
  },
);

test('also works if steps is a function', () => {
  github.addWorkflow('test').addJob('job', {
    permissions: {},
    uses: 'standard',
    steps: (() => [
      {
        run: 'echo "${{ github.event.pull_request.title }}"',
      },
    ]) as any,
  });

  expect(() => project.synth()).toThrow(/Found dangerous expressions in workflow shell steps/);
});

test('detect indirect use of dangerous expressions', () => {
  github.addWorkflow('test').addJob('job', {
    permissions: {},
    uses: 'standard',
    steps: [
      {
        run: 'echo "${{ contains(github.event.pull_request.labels.*.name, \'something\') }}"',
      },
    ],
  });

  expect(() => project.synth()).toThrow(/Found dangerous expressions in workflow shell steps/);
});