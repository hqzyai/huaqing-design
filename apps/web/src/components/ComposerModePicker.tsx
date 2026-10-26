// Composer footer "mode" picker — sits just left of the model selector.
// Three modes (Plan / Design / Ask); the trigger shows a neutral grid+sparkle
// glyph until a mode is chosen, then flips to that mode's icon. The dropdown
// mirrors the "+" menu surface: each row shows its name + an always-visible
// description, and the selected row carries a check.
//
// Ported from #5517 (demo `ComposerModePicker`) but wired to the REAL
// `ChatSessionMode` ('design' | 'chat' | 'plan') instead of the demo's
// app-wide mock store: the component is controlled via `mode`/`onModeChange`,
// so the home composer and the project chat composer each reflect their own
// conversation's persisted mode. `design` is the app default AND it is shown
// as selected by default: the composer opens carrying the 「设计 ×」 pill, so
// the mode the request will actually run in is stated on screen instead of
// being an invisible default behind a neutral glyph. The × still clears it
// back to the neutral trigger.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react';
import { createPortal } from 'react-dom';
import type { ChatSessionMode } from '@open-design/contracts';
import { useT } from '../i18n';
import { Icon } from './Icon';
import { Button } from '@open-design/components';


// Unselected / neutral state.
const ICON_DEFAULT: ReactElement = (
  <Icon name="blocks" size={16} />
);

const ICON_PLAN: ReactElement = (
  <Icon name="map" size={16} />
);

const ICON_DESIGN: ReactElement = (
  <Icon name="draw" size={16} />
);

const ICON_ASK: ReactElement = (
  <Icon name="comment" size={16} />
);

type ModeCopyKey =
  | 'chat.mode.plan.label'
  | 'chat.mode.plan.summary'
  | 'chat.mode.design.label'
  | 'chat.mode.design.summary'
  | 'chat.mode.chat.label'
  | 'chat.mode.chat.summary';

interface ModeDef {
  id: ChatSessionMode;
  nameKey: ModeCopyKey;
  descKey: ModeCopyKey;
  icon: ReactElement;
}

// Menu order mirrors #5517: 规划 / 设计 / 提问. The demo's `ask` id is the real
// `chat` session mode.
const MODES: ModeDef[] = [
  {
    id: 'plan',
    nameKey: 'chat.mode.plan.label',
    descKey: 'chat.mode.plan.summary',
    icon: ICON_PLAN,
  },
  {
    id: 'design',
    nameKey: 'chat.mode.design.label',
    descKey: 'chat.mode.design.summary',
    icon: ICON_DESIGN,
  },
  {
    id: 'chat',
    nameKey: 'chat.mode.chat.label',
    descKey: 'chat.mode.chat.summary',
    icon: ICON_ASK,
  },
];

const MENU_WIDTH = 300;
const MENU_MARGIN = 12;
const MENU_GAP = 8;
// Natural height of the 3-mode list; used to decide whether the menu fits
// below the trigger before flipping it above.
const MENU_EST_HEIGHT = 290;

export interface ComposerModePickerProps {
  /** The conversation's real session mode. `design` (the app default) renders
   *  as a SELECTED pill from first paint; clearing it with the × returns the
   *  trigger to neutral without changing the session mode. */
  mode: ChatSessionMode;
  onModeChange?: (mode: ChatSessionMode) => void;
  /** Collapse the selected pill to icon + clear only (hide the mode name) —
   *  used when the composer row is space-constrained, e.g. while a run streams
   *  and the wide "思考中" button is showing. */
  labelHidden?: boolean;
}

export function ComposerModePicker({ mode, onModeChange, labelHidden = false }: ComposerModePickerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // 设计 is the default mode AND the default selection, so the pill is showing
  // when the composer first paints. This is INITIAL state only — the user's own
  // choice (picking another mode, or clearing with ×) flips it and is never
  // re-forced on a later render, which is why it is `useState`'s initial value
  // and not an effect that resyncs on `mode`.
  const [designExplicit, setDesignExplicit] = useState(true);
  const selected: ChatSessionMode | null =
    mode !== 'design' ? mode : designExplicit ? 'design' : null;
  const [pos, setPos] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Auto-flip: open BELOW the trigger when there's room (home composer sits
  // mid-screen with space beneath it), and flip ABOVE when there isn't (the
  // project chat composer is docked at the viewport bottom). maxHeight caps the
  // menu to the room on whichever side so it scrolls internally rather than
  // getting squashed off-screen. `left` is clamped against both viewport edges
  // (same fix family as SessionModeToggle's #100 popoverShift), so the 300px
  // menu never runs past the right screen edge in a narrow window.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vw = window.innerWidth || document.documentElement.clientWidth || 1024;
      const vh = window.innerHeight || document.documentElement.clientHeight || 768;
      const width = Math.min(MENU_WIDTH, Math.max(0, vw - MENU_MARGIN * 2));
      const left = Math.min(
        Math.max(MENU_MARGIN, rect.left),
        Math.max(MENU_MARGIN, vw - MENU_MARGIN - width),
      );
      const spaceBelow = vh - rect.bottom - MENU_MARGIN;
      const spaceAbove = rect.top - MENU_GAP - MENU_MARGIN;
      const openDown = spaceBelow >= MENU_EST_HEIGHT || spaceBelow >= spaceAbove;
      if (openDown) {
        const top = rect.bottom + MENU_GAP;
        setPos({ left, top, width, maxHeight: Math.max(0, vh - top - MENU_MARGIN) });
      } else {
        const bottom = Math.max(MENU_MARGIN, vh - rect.top + MENU_GAP);
        setPos({ left, bottom, width, maxHeight: Math.max(0, spaceAbove) });
      }
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const activeMode = selected ? MODES.find((m) => m.id === selected) ?? null : null;
  const triggerIcon = activeMode ? activeMode.icon : ICON_DEFAULT;
  const activeName = activeMode ? t(activeMode.nameKey) : null;

  return (
    <div className={`composer-mode${activeMode ? ' is-selected' : ''}`} ref={rootRef}>
      <Button
        ref={triggerRef}
        type="button"
        className={`composer-mode__trigger${open ? ' is-open' : ''}${selected ? ' is-selected' : ''}`}
        data-testid="composer-mode-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={activeName ? t('chat.modePicker.current', { name: activeName }) : t('chat.modePicker.choose')}
        title={activeName ?? t('chat.modePicker.mode')}
      >
        <span className="composer-mode__icon" aria-hidden>{triggerIcon}</span>
        {activeName && !labelHidden ? (
          <span className="composer-mode__label">{activeName}</span>
        ) : null}
      </Button>
      {activeMode ? (
        <Button
          type="button"
          className="composer-mode__clear"
          data-testid="composer-mode-clear"
          aria-label={t('chat.modePicker.clear')}
          title={t('common.clear')}
          onClick={() => {
            setDesignExplicit(false);
            // Clearing returns to the app default (design without the pill).
            if (mode !== 'design') onModeChange?.('design');
          }}
        >
          <Icon name="close" size={16} strokeWidth={1.75} />
        </Button>
      ) : null}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={menuRef}
              className="composer-mode-menu"
              role="menu"
              style={pos ?? undefined}
              data-testid="composer-mode-menu"
            >
              {MODES.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected === m.id}
                  className={`composer-mode-menu__item${selected === m.id ? ' is-selected' : ''}`}
                  data-testid={`composer-mode-menu-${m.id}`}
                  onClick={() => {
                    setDesignExplicit(m.id === 'design');
                    if (m.id !== mode) onModeChange?.(m.id);
                    setOpen(false);
                  }}
                >
                  <span className="composer-mode-menu__head">
                    <span className="composer-mode-menu__icon" aria-hidden>{m.icon}</span>
                    <span className="composer-mode-menu__name">{t(m.nameKey)}</span>
                    {selected === m.id ? (
                      <span className="composer-mode-menu__check" aria-hidden>
                        <Icon name="check" size={16} />
                      </span>
                    ) : null}
                  </span>
                  <span className="composer-mode-menu__desc">{t(m.descKey)}</span>
                </Button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
