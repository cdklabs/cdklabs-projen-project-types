import type { IConstruct } from 'constructs';
import { Component, github } from 'projen';
import type { workflows } from 'projen/lib/github';

/**
 * Check GitHub Actions workflows for the use of dangerous expressions directly interpolated in shell steps.
 *
 * Some of these can be used to perform command injection attacks. We block all of them to be overly safe,
 * even the ones that are not dangerous.
 *
 * Automatically added to all of our project types.
 */
export class CheckGhaExpressions extends Component {
  constructor(project: IConstruct) {
    super(project, 'gha-variable-checker');
  }

  public postSynthesize() {
    const violations: Violation[] = [];
    for (const workflow of github.GitHub.of(this.project)?.workflows ?? []) {
      this.validateWorkflow(workflow, violations);
    }

    if (violations.length > 0) {
      throw new Error([
        'Found dangerous expressions in workflow shell steps. Put these in environment variables and reference them instead. DO NOT FORGET TO QUOTE THEM!',
        ...violations.map((v) => `- wf ${v.workflowName}: job ${v.jobName}.${v.stepIndex + 1}: ${ v.expression }`),
      ].join('\n'));
    }
  }

  private validateWorkflow(workflow: github.GithubWorkflow, violations: Violation[]) {
    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      if (isJob(job)) {
        for (const [stepIndex, step] of enumerate(projenResolve(job.steps) ?? [])) {
          if (step.run) {
            // Check for a number of known dangerous expressions that are attacker controlled, and some more that our internal scanning
            // tools will yell at us for.
            //
            const findings = projenResolve(step.run).matchAll(/\$\{\{([^}]*github\.(repository|base_ref|head_ref|ref|ref_name|action_r|event\.pull_request|event\.issue)[^}]*)\}\}/g);

            for (const finding of findings) {
              violations.push({
                workflowName: workflow.name,
                jobName,
                stepIndex,
                expression: finding[1].trim(),
              });
            }
          }
        }
      }
    }
  }
}

function isJob(x: workflows.Job | workflows.JobCallingReusableWorkflow): x is workflows.Job {
  return (x as workflows.Job).steps !== undefined;
}

interface Violation {
  readonly workflowName: string;
  readonly jobName: string;
  readonly stepIndex: number;
  readonly expression: string;
}

function enumerate<A>(xs: A[]): [number, A][] {
  return xs.map((x, i) => [i, x]);
}

/**
 * Any projen value can be a function, resolve it if necessary
 */
function projenResolve<A>(x: A): A {
  return typeof x === 'function' ? (x as any)() : x;
}