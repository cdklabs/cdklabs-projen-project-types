import { Construct } from 'constructs';
import { Component } from 'projen';

export class SaferUpgrades extends Component {

  public constructor(scope: Construct) {
    super(scope, 'SaferUpgrades#');

    // The concept has been proven. This is now built into upstream projen and this project types library automatically
    console.error('SaferUpgrades is no longer necessary, and can be removed');
  }
}
