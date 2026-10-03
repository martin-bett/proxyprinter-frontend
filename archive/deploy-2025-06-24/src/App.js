import logo from './logo.svg';
import './App.css';
import 'bulma/css/bulma.min.css';
import DeckInputAndViewer from './viewer/DeckInputAndViewer';
import ThemeProvider from './viewer/ThemeProvider';

function App() {
  return (
      <ThemeProvider>
          <DeckInputAndViewer />
      </ThemeProvider>
  );
}

export default App;


