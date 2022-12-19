import { UpdateSnapshot } from 'projen/lib/javascript';
import { CdkConstructLibrary, CdkConstructLibraryOptions, CdkTypeScriptProject, CdkTypeScriptProjectOptions } from './cdk';

// override these properties no matter what values are given client-side
export const cdklabsForcedProps = {
  author: 'Amazon Web Services',
  authorName: 'Amazon Web Services',
  authorAddress: 'aws-cdk-dev@amazon.com',
  authorEmail: 'aws-cdk-dev@amazon.com',
  authorOrganization: true,
};


export const cdklabsDefaultProps = {
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['cdklabs-automation'],
    secret: 'GITHUB_TOKEN',
  },
  minNodeVersion: '14.17.0',
  jestOptions: {
    updateSnapshot: UpdateSnapshot.NEVER,
  },
  defaultReleaseBranch: 'main',
};

export interface CdklabsConstructLibraryOptions extends CdkConstructLibraryOptions {
}

/**
 * Create a Cdklabs Construct Library Project
 *
 * @pjid cdklabs-construct-lib
 */
export class CdklabsConstructLibrary extends CdkConstructLibrary {
  constructor(options: CdklabsConstructLibraryOptions) {
    super({
      ...cdklabsDefaultProps,
      ...options,
      ...cdklabsForcedProps,
    });
  }
}

export interface CdklabsTypeScriptProjectOptions extends CdkTypeScriptProjectOptions {
}

/**
 * Create a Cdklabs TypeScript Project
 *
 * @pjid cdklabs-ts-proj
 */
export class CdklabsTypeScriptProject extends CdkTypeScriptProject {
  constructor(options: CdklabsTypeScriptProjectOptions) {
    super({
      ...cdklabsDefaultProps,
      ...options,
      ...cdklabsForcedProps,
    });
  }
}
