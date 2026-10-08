import React, { useCallback, useRef, useState } from 'react';
import Joyride, { ACTIONS, CallBackProps, EVENTS, STATUS, Step } from 'react-joyride';
import { Menu, MenuItem } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { isSectionOpen, setSectionOpen } from './sectionControl';
import { Tutorial, TutorialStep, TUTORIALS } from './tutorials';
import '../viewer/cache/MemoryButtons.css';
import './TutorialMenu.css';

// Joyride-Optik aus den Theme-Variablen, damit die Tooltips zu jedem Farbschema passen
const JOYRIDE_STYLES = {
  options: {
    primaryColor: 'var(--accent)',
    backgroundColor: 'var(--surface)',
    arrowColor: 'var(--surface)',
    textColor: 'var(--text)',
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    // Über den Bubbles, unter den MUI-Dialogen (1300)
    zIndex: 1200,
  },
  tooltipTitle: { fontSize: '1.05rem', fontWeight: 600 },
  tooltipContent: { padding: '12px 4px 4px', textAlign: 'left' as const },
  buttonBack: { color: 'var(--text-muted)' },
  buttonSkip: { color: 'var(--text-muted)' },
};

const resolveStep = ({ fallbackTarget, openSections, closeSections, ...step }: TutorialStep): Step => {
  const missing = typeof step.target === 'string' && !document.querySelector(step.target);
  return { disableBeacon: true, ...step, target: fallbackTarget && missing ? fallbackTarget : step.target };
};

const LOCALE = { back: 'Back', close: 'Close', last: 'Done', next: 'Next', nextLabelWithProgress: 'Next ({step} of {steps})', skip: 'Skip' };

// "?"-Bubble neben dem Theme-Chooser: Liste der Tutorials, die Auswahl startet die Joyride-Tour
const TutorialMenu: React.FC = () => {
  const { t: translate } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  // Zustand der Abschnitte vor der Tour, damit die Seite danach wieder so aussieht wie vorher
  const sectionsBefore = useRef<Record<string, boolean>>({});

  const prepareStep = (t: Tutorial, index: number) => {
    const step = t.steps[index];
    if (!step) return;
    [...(step.closeSections ?? []), ...(step.openSections ?? [])].forEach(key => {
      if (key in sectionsBefore.current) return;
      const open = isSectionOpen(key);
      if (open !== undefined) sectionsBefore.current[key] = open;
    });
    step.closeSections?.forEach(key => setSectionOpen(key, false));
    step.openSections?.forEach(key => setSectionOpen(key, true));
  };

  const start = (t: Tutorial) => {
    setAnchorEl(null);
    sectionsBefore.current = {};
    prepareStep(t, 0);
    setStepIndex(0);
    setTutorial(t);
  };

  const finish = useCallback(() => {
    Object.entries(sectionsBefore.current).forEach(([key, open]) => setSectionOpen(key, open));
    sectionsBefore.current = {};
    setTutorial(null);
    setStepIndex(0);
  }, []);

  const handleCallback = ({ action, index, status, type }: CallBackProps) => {
    if (!tutorial) return;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED || action === ACTIONS.CLOSE) {
      finish();
      return;
    }
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const next = index + (action === ACTIONS.PREV ? -1 : 1);
      if (next < 0) return;
      if (next >= tutorial.steps.length) {
        finish();
        return;
      }
      prepareStep(tutorial, next);
      setStepIndex(next);
    }
  };

  return (
    <>
      <button
        className="memory-button tutorial-button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        title={translate('tutorials.title')}
        aria-label={translate('tutorials.title')}
        aria-haspopup="menu"
      >
        ?
      </button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ className: 'tutorial-menu', subheader: <li className="tutorial-menu-header">{translate('tutorials.title')}</li> }}
      >
        {TUTORIALS.map(t => (
          <MenuItem key={t.id} className="tutorial-menu-item" onClick={() => start(t)}>
            {t.title}
          </MenuItem>
        ))}
      </Menu>
      {tutorial && (
        <Joyride
          key={tutorial.id}
          steps={tutorial.steps.map(resolveStep)}
          stepIndex={stepIndex}
          run
          continuous
          showProgress
          showSkipButton
          scrollOffset={120}
          callback={handleCallback}
          locale={LOCALE}
          styles={JOYRIDE_STYLES}
        />
      )}
    </>
  );
};

export default TutorialMenu;
