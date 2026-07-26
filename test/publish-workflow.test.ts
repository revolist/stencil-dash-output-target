import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync(
  new URL('../.github/workflows/publish.yml', import.meta.url),
  'utf8',
);

describe('publish workflow', () => {
  it('synchronizes and commits the release-tag version before publishing', () => {
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('group: npm-publish-${{ github.repository }}');
    expect(workflow).toContain(
      'RELEASE_TAG: ${{ github.event.release.tag_name }}',
    );
    expect(workflow).toContain('PACKAGE_VERSION="${RELEASE_TAG#v}"');
    expect(workflow).toContain(
      'npm version "${PACKAGE_VERSION}" --no-git-tag-version --allow-same-version',
    );
    expect(workflow).toContain('git add package.json package-lock.json');
    expect(workflow).toContain('git commit -m "chore(release): ${RELEASE_TAG}"');
    expect(workflow).toContain('git push origin "HEAD:${DEFAULT_BRANCH}"');

    const testIndex = workflow.indexOf('- name: Test');
    const commitIndex = workflow.indexOf('- name: Commit release version');
    const publishIndex = workflow.indexOf('- name: Publish to npm');
    expect(testIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(testIndex);
    expect(publishIndex).toBeGreaterThan(commitIndex);
  });
});
