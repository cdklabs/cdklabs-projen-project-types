export function expectPrivate(outdir: Record<string, any>) {
  expect(outdir['.npmignore']).toBeUndefined();
  expect(outdir['.mergify.yml']).toBeUndefined();
  expect(outdir['package.json'].private).toBeTruthy();
}

export function expectNotPrivate(outdir: Record<string, any>) {
  expect(outdir['.npmignore']).toBeDefined();
  expect(outdir['.mergify.yml']).toBeDefined();
  expect(outdir['package.json'].private).toBeFalsy();
}