// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EntryNavRail, resetWorkspaceDirectoryCache } from '../../src/components/EntryNavRail';
import { I18nProvider } from '../../src/i18n';

vi.mock('../../src/components/MessageCenter', () => ({
  MessageCenter: () => null,
}));

afterEach(() => {
  cleanup();
  resetWorkspaceDirectoryCache();
  vi.restoreAllMocks();
});

describe('EntryNavRail footer removal', () => {
  it('omits the cloud sign-in card and social links when signed out', () => {
    render(
      <I18nProvider initial="zh-CN">
        <EntryNavRail
          view="home"
          onViewChange={() => {}}
          onNewProject={() => {}}
          open
          context={null}
        />
      </I18nProvider>,
    );

    expect(screen.queryByTestId('entry-cloud-signin-tip')).toBeNull();
    expect(screen.queryByTestId('entry-nav-rail-social')).toBeNull();
    expect(screen.queryByTestId('entry-nav-rail-discord')).toBeNull();
    expect(screen.queryByText('登录即可享受云端协作')).toBeNull();
  });
});
