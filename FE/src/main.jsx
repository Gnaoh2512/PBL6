import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { initTableLabels } from './utils/tableLabels';
import './styles/index.css';
import App from './App.jsx';
import './styles/TableRows.css'; // after App so it wins over page styles
import './styles/mobile.css'; // must stay last so it overrides page styles

initTableLabels();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
