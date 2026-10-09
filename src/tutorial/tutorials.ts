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
    title: 'How to create a deck',
    steps: [
      {
        target: section('decklist'),
        openSections: ['decklist'],
        title: 'Enter your decklist',
        content: 'Paste or type your deck here, one card per line with the count first, for example "4 Lightning Bolt". '
          + 'Exports from the common deckbuilders work as they are.',
        placement: 'right',
      },
      {
        target: tour('tokens-extras'),
        openSections: ['decklist'],
        title: 'Tokens & Extras',
        content: 'When this is checked, tokens, emblems and other extras your cards create are added as separate cards.',
        placement: 'right',
      },
      {
        target: tour('analyze-deck'),
        openSections: ['decklist'],
        title: 'Search the images',
        content: 'Analyze Deck searches all active sources for every card. The results show up in the grid as they arrive.',
        placement: 'right',
      },
      {
        target: section('import-deck'),
        openSections: ['import-deck'],
        title: 'Or import a deck',
        content: 'Paste a deck link or ID and press Load Deck, or type a deck name and use Search by Name. '
          + 'Before an imported deck replaces your list, the current state is saved as a snapshot.',
        placement: 'right',
      },
      {
        target: section('add-single'),
        openSections: ['add-single'],
        title: 'Add single cards',
        content: 'Add your own image, search a gallery, or paste a list of image links to add cards one by one.',
        placement: 'right',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'Your deck',
        content: 'Every card gets a tile. Click a tile to pick a different image, use + and − to change the count.',
        placement: 'auto',
      },
      {
        target: tour('create-pdf'),
        openSections: ['pdf-generation'],
        title: 'Print it',
        content: 'When you are happy with the selection, Create PDF builds a printable sheet of all cards.',
        placement: 'left',
      },
    ],
  },
  {
    id: 'change-sources',
    title: 'How to change sources',
    steps: [
      {
        target: section('api-selection'),
        openSections: ['api-selection'],
        title: 'Choose your sources',
        content: 'Each entry is a source the search asks for card images. Check or uncheck single sources, '
          + 'or click a category to switch all of its sources at once.',
        placement: 'right',
      },
      {
        target: sectionAction('api-selection'),
        openSections: ['api-selection'],
        title: 'Manage sources',
        content: 'The gear opens the source manager. There you can add new sources, edit existing ones or test them.',
        placement: 'right',
      },
      {
        target: tour('server-cache'),
        openSections: ['decklist'],
        title: 'Shared search cache',
        content: 'Reuses search results other users already found, which is much faster. '
          + 'Uncheck it to always ask the sources yourself, for example after changing a source.',
        placement: 'right',
      },
      {
        target: tour('gallery-search'),
        openSections: ['add-single'],
        title: 'Galleries',
        content: 'Gallery Search browses image galleries that are not part of the regular card search.',
        placement: 'right',
      },
      {
        target: sectionAction('import-deck'),
        openSections: ['import-deck'],
        title: 'Deck sources',
        content: 'This gear manages the deckbuilder sites decks can be imported from.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'card-appearance',
    title: 'How to edit card appearance',
    steps: [
      {
        target: section('view-selection'),
        openSections: ['view-selection'],
        title: 'View settings',
        content: 'Unique Prints shows one tile per copy, so every copy can get its own image. '
          + 'Show Image Info adds size and quality details to each tile.',
        placement: 'left',
      },
      {
        target: tour('grid-size'),
        openSections: ['view-selection'],
        title: 'Grid size',
        content: 'Makes the tiles in the grid bigger or smaller. This only changes the view, not the PDF.',
        placement: 'left',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'Pick and crop images',
        content: 'Click a tile to see all images found for that card and choose another one. '
          + 'Your own images can be cropped again with the crop button on their tile.',
        placement: 'auto',
      },
      {
        target: tour('pdf-settings'),
        openSections: ['pdf-generation'],
        title: 'Print settings',
        content: 'Card size, margins, cut lines, rounded corners and the maximum image resolution are set here. '
          + 'The preview shows how a page will look.',
        placement: 'left',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage management',
    steps: [
      {
        target: tour('memory-buttons'),
        title: 'Downloads and caches',
        content: 'These bubbles show what is happening in the background: waiting and active downloads and images being loaded from the cache. '
          + 'Click one to see the queue.',
        placement: 'bottom',
      },
      {
        target: tour('search-cache'),
        title: 'Search cache',
        content: 'Search results are kept in your browser, so searching the same card again is instant. '
          + 'Click to see or delete stored searches.',
        placement: 'bottom',
      },
      {
        target: tour('image-cache'),
        title: 'Image cache',
        content: 'Downloaded images are stored in your browser too. The bar shows how full the image cache is; click it to clean up.',
        placement: 'bottom',
      },
      {
        target: tour('reset-deck'),
        title: 'Reset deck',
        content: 'Clears the decklist, results and selection. You will be asked before anything is removed.',
        placement: 'bottom-end',
      },
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'Snapshots',
        content: 'Snapshots are also stored in this browser. Delete old ones here to free space.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'filters',
    title: 'Working with filters',
    steps: [
      {
        target: section('language-filter'),
        openSections: ['language-filter'],
        title: 'Language filter',
        content: 'Uncheck a language to hide its images. Hold an entry for 2 seconds to show only that language.',
        placement: 'left',
      },
      {
        target: section('language-filter'),
        openSections: ['language-filter'],
        title: 'Priority',
        content: 'Drag entries to reorder them. The order decides which image is picked automatically: '
          + 'the top entry wins, the others are the fallback. The number shows each entry\'s rank.',
        placement: 'left',
      },
      {
        target: section('api-filter'),
        openSections: ['api-filter'],
        closeSections: ['language-filter'],
        title: 'Source filter',
        content: 'Works the same way for sources: hide sources, hold to show only one, drag to set which source is preferred.',
        placement: 'left',
      },
      {
        target: `${tour('card-grid')} .card-tile`,
        fallbackTarget: '.decklist-viewer',
        title: 'Effect on your deck',
        content: 'A card you picked by hand stays picked as long as it matches the filters. '
          + 'Tiles without any matching image are marked. The image selection dialog has the same filters.',
        placement: 'auto',
      },
    ],
  },
  {
    id: 'snapshots',
    title: 'What are snapshots',
    steps: [
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'Snapshots',
        content: 'A snapshot stores your whole work: the decklist, the images you picked, active sources, filters and print settings. '
          + 'Snapshots are kept in this browser. After a reload, "Restore last session" brings back where you left off.',
        placement: 'right',
      },
      {
        target: tour('save-snapshot'),
        openSections: ['snapshots'],
        title: 'Save',
        content: 'Saves the current state. A snapshot is also made automatically when you create a PDF '
          + 'and before an imported deck replaces your list.',
        placement: 'right',
      },
      {
        target: section('snapshots'),
        openSections: ['snapshots'],
        title: 'Load and manage',
        content: 'Click a snapshot to load it. The buttons next to it overwrite it with the current state, rename or delete it. '
          + 'Snapshots of a created PDF can download it again while it is available.',
        placement: 'right',
      },
    ],
  },
];
