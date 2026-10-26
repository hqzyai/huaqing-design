import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { RemixIcon } from './RemixIcon';
import { Button } from '@open-design/components';


interface Props {
  actions?: ReactNode;
  children?: ReactNode;
  fileActionsBefore?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  showTrafficSpace?: boolean;
}

export const APP_CHROME_FILE_ACTIONS_ID = 'app-chrome-file-actions';
export const APP_CHROME_FILE_ACTIONS_SELECTOR = '[data-app-chrome-file-actions="true"]';

export function AppChromeHeader({
  actions,
  children,
  fileActionsBefore,
  onBack,
  backLabel,
  showTrafficSpace = true,
}: Props) {
  const t = useT();
  const resolvedBackLabel = backLabel ?? t('project.backToProjects');

  return (
    <header className="app-chrome-header">
      {showTrafficSpace ? <div className="app-chrome-traffic-space" aria-hidden /> : null}
      {onBack ? (
        <Button
          type="button"
          className="app-chrome-back od-tooltip"
          onClick={onBack}
          title={resolvedBackLabel}
          data-tooltip={resolvedBackLabel}
          data-tooltip-placement="bottom"
          aria-label={resolvedBackLabel}
        >
          <RemixIcon name="arrow-left-line" size={16} />
        </Button>
      ) : null}
      {children ? <div className="app-chrome-content">{children}</div> : null}
      <div className="app-chrome-drag" aria-hidden />
      {fileActionsBefore ? <div className="app-chrome-file-actions-before">{fileActionsBefore}</div> : null}
      <div
        id={APP_CHROME_FILE_ACTIONS_ID}
        className="app-chrome-file-actions"
        data-app-chrome-file-actions="true"
      />
      {actions ? <div className="app-chrome-actions">{actions}</div> : null}
    </header>
  );
}

export function SettingsIconButton({
  onClick,
  title,
  ariaLabel,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
}) {
  return (
    <Button
      type="button"
      className="settings-icon-btn od-tooltip"
      onClick={onClick}
      title={title}
      data-tooltip={title}
      data-tooltip-placement="bottom"
      aria-label={ariaLabel}
    >
      <RemixIcon name="settings-line" size={20} />
    </Button>
  );
}
