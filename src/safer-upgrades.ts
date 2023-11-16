import { Construct } from 'constructs';
import { Component, JsonPatch } from 'projen';
import { UpgradeDependencies } from 'projen/lib/javascript';

export class SaferUpgrades extends Component {

  public constructor(scope: Construct) {
    super(scope, 'SaferUpgrades#');

    const tasks = this.project.tryFindObjectFile('.projen/tasks.json');
    if (!tasks) {
      return;
    }

    // Remove the initial upgrade step
    const upgrades = this.project.components.filter((c): c is UpgradeDependencies => c instanceof UpgradeDependencies);
    for (const upgrade of upgrades) {
      tasks.patch(JsonPatch.remove(`/tasks/${upgrade.upgradeTask.name}/steps/0`));
    }

    // This is some hackery to replace the npm-check-updates command with one that is using npx

    // @ts-ignore
    const originalSynth = tasks.synthesizeContent;
    // @ts-ignore
    tasks.synthesizeContent = (resolver: IResolver): string | undefined => {
      const content = originalSynth.apply(tasks, [resolver])?.replace(/npm-check-updates --upgrade/g, 'npx npm-check-updates@latest --upgrade');

      // Remove the dependency but only after we have synth'd the tasks
      this.project.deps.removeDependency('npm-check-updates');

      return content;
    };
  }
}
