import { Step } from 'react-joyride';

// Tutorials als reine Daten: ein neues Tutorial ist ein weiterer Eintrag in TUTORIALS.
// Ziele sind CSS-Selektoren; Abschnitte tragen data-section="<storageKey>", einzelne Elemente data-tour="<name>".

export interface TutorialStep extends Step {
  /** Abschnitte (storageKey), die vor diesem Schritt aufgeklappt werden */
  openSections?: string[];
  /** Abschnitte (storageKey), die vor diesem Schritt zugeklappt werden */
  closeSections?: string[];
  /** Ersatzziel, wenn target gerade nicht im DOM steht (z. B. erste Karte bei leerem Deck) */
  fallbackTarget?: string;
}

export interface Tutorial {
  id: string;
  title: string;
  steps: TutorialStep[];
}

export const section = (key: string) => `[data-section="${key}"]`;
export const tour = (name: string) => `[data-tour="${name}"]`;
const sectionAction = (key: string) => `${section(key)} .collapsible-action`;

export const TUTORIALS: Tutorial[] = [
  {
    id: 'create-deck',
    title: 'tour.createDeck.title',
    steps: [
      {
        target: section('decklist'),
        openSections: ['decklist'],
        title: 'tour.createDeck.steps.s1.title',
        content: 'tour.createDeck.steps.s1.content',
        placement: 'right',
      },
      {
        target: tour('tokens-extras'),
        openSections: ['decklist'],
        title: 'tour.createDeck.steps.s2.title',
        content: 'tour.createDeck.steps.s2.content',
        placement: 'right',
      },
      {
        target: tour('analyze-deck'),
        openSections: ['decklist'],
        title: 'tour.createDeck.steps.s3.title',
        content: 'tour.createDeck.steps.s3.content',
        placement: 'right',
      },
      {
        target: section('import-deck'),
        openSections: ['import-deck'],
        title: 'tour.createDeck.steps.s4.title',
        content: 'tour.createDeck.steps.s4.content',
        placement: 'right',
      },
      {
        target: section('add-single'),
        openSections: ['add-single'],
        title: 'tour.createDeck.steps.s5.title',
        content: 'tour.createDeck.steps.s5.content',
        placement: 'right',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'tour.createDeck.steps.s6.title',
        content: 'tour.createDeck.steps.s6.content',
        placement: 'auto',
      },
      {
        target: tour('create-pdf'),
        openSections: ['pdf-generation'],
        title: 'tour.createDeck.steps.s7.title',
        content: 'tour.createDeck.steps.s7.content',
        placement: 'left',
      },
    ],
  },
  {
    id: 'change-sources',
    title: 'tour.changeSources.title',
    steps: [
      {
        target: section('api-selection'),
        openSections: ['api-selection'],
        title: 'tour.changeSources.steps.s1.title',
        content: 'tour.changeSources.steps.s1.content',
        placement: 'right',
      },
      {
        target: sectionAction('api-selection'),
        openSections: ['api-selection'],
        title: 'tour.changeSources.steps.s2.title',
        content: 'tour.changeSources.steps.s2.content',
        placement: 'right',
      },
      {
        target: tour('server-cache'),
        openSections: ['decklist'],
        title: 'tour.changeSources.steps.s3.title',
        content: 'tour.changeSources.steps.s3.content',
        placement: 'right',
      },
      {
        target: tour('gallery-search'),
        openSections: ['add-single'],
        title: 'tour.changeSources.steps.s4.title',
        content: 'tour.changeSources.steps.s4.content',
        placement: 'right',
      },
      {
        target: sectionAction('import-deck'),
        openSections: ['import-deck'],
        title: 'tour.changeSources.steps.s5.title',
        content: 'tour.changeSources.steps.s5.content',
        placement: 'right',
      },
    ],
  },
  {
    id: 'card-appearance',
    title: 'tour.cardAppearance.title',
    steps: [
      {
        target: section('view-selection'),
        openSections: ['view-selection'],
        title: 'tour.cardAppearance.steps.s1.title',
        content: 'tour.cardAppearance.steps.s1.content',
        placement: 'left',
      },
      {
        target: tour('grid-size'),
        openSections: ['view-selection'],
        title: 'tour.cardAppearance.steps.s2.title',
        content: 'tour.cardAppearance.steps.s2.content',
        placement: 'left',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'tour.cardAppearance.steps.s3.title',
        content: 'tour.cardAppearance.steps.s3.content',
        placement: 'auto',
      },
      {
        target: tour('pdf-settings'),
        openSections: ['pdf-generation'],
        title: 'tour.cardAppearance.steps.s4.title',
        content: 'tour.cardAppearance.steps.s4.content',
        placement: 'left',
      },
    ],
  },
  {
    id: 'storage',
    title: 'tour.storage.title',
    steps: [
      {
        target: tour('memory-buttons'),
        title: 'tour.storage.steps.s1.title',
        content: 'tour.storage.steps.s1.content',
        placement: 'bottom',
      },
      {
        target: tour('search-cache'),
        title: 'tour.storage.steps.s2.title',
        content: 'tour.storage.steps.s2.content',
        placement: 'bottom',
      },
      {
        target: tour('image-cache'),
        title: 'tour.storage.steps.s3.title',
        content: 'tour.storage.steps.s3.content',
        placement: 'bottom',
      },
      {
        target: tour('reset-deck'),
        title: 'tour.storage.steps.s4.title',
        content: 'tour.storage.steps.s4.content',
        placement: 'bottom-end',
      },
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'tour.storage.steps.s5.title',
        content: 'tour.storage.steps.s5.content',
        placement: 'right',
      },
    ],
  },
  {
    id: 'filters',
    title: 'tour.filters.title',
    steps: [
      {
        target: section('language-filter'),
        openSections: ['language-filter'],
        title: 'tour.filters.steps.s1.title',
        content: 'tour.filters.steps.s1.content',
        placement: 'left',
      },
      {
        target: section('language-filter'),
        openSections: ['language-filter'],
        title: 'tour.filters.steps.s2.title',
        content: 'tour.filters.steps.s2.content',
        placement: 'left',
      },
      {
        target: section('api-filter'),
        openSections: ['api-filter'],
        closeSections: ['language-filter'],
        title: 'tour.filters.steps.s3.title',
        content: 'tour.filters.steps.s3.content',
        placement: 'left',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'tour.filters.steps.s4.title',
        content: 'tour.filters.steps.s4.content',
        placement: 'auto',
      },
    ],
  },
  {
    id: 'snapshots',
    title: 'tour.snapshots.title',
    steps: [
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'tour.snapshots.steps.s1.title',
        content: 'tour.snapshots.steps.s1.content',
        placement: 'right',
      },
      {
        target: tour('save-snapshot'),
        openSections: ['snapshots'],
        title: 'tour.snapshots.steps.s2.title',
        content: 'tour.snapshots.steps.s2.content',
        placement: 'right',
      },
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'tour.snapshots.steps.s3.title',
        content: 'tour.snapshots.steps.s3.content',
        placement: 'right',
      },
    ],
  },
];
