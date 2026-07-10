import { Project } from "projen";
import { GitHub } from "projen/lib/github";
import { CheckGhaExpressions } from "../src";

let project: Project;
let github: GitHub;

beforeEach(() => {
  project = new Project({ name: 'test' });
  github = new GitHub(project);
  new CheckGhaExpressions(project);
});

test('detect direct use of dangerous expressions', () => {
  github.addWorkflow('test').addJob('job', {
    permissions: {},
    uses: 'standard',
    steps: [
      {
        run: 'echo "${{ github.event.pull_request.title }}"',
      },
    ],
  });

  expect(() => project.synth()).toThrow(/Found dangerous expressions containing github.event in workflow shell steps/);
});

test('detect indirect use of dangerous expressions', () => {
  github.addWorkflow('test').addJob('job', {
    permissions: {},
    uses: 'standard',
    steps: [
      {
        run: `echo "\${{ contains(github.event.pull_request.labels.*.name, 'something') }}"`,
      },
    ],
  });

  expect(() => project.synth()).toThrow(/Found dangerous expressions containing github.event in workflow shell steps/);
});