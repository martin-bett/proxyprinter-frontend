import './App.css';
import 'bulma/css/bulma.min.css';
import DeckInputAndViewer from './viewer/DeckInputAndViewer';
import AdminPage from './admin/AdminPage';
import { isAdminPath } from './service/admin/adminApi';

function App() {
  return (
    <div className="body App">
      {isAdminPath(window.location.pathname) ? <AdminPage /> : <DeckInputAndViewer />}
    </div>
  );
}

export default App;
