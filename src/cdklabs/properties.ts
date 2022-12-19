import { UpdateSnapshot } from 'projen/lib/javascript';

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
