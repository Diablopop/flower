import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import PlayPage from './pages/m0/PlayPage';
import ListenPage from './pages/m0/ListenPage';
import styles from './App.module.css';

export default function App() {
  return (
    <BrowserRouter>
      <nav className={styles.nav}>
        <NavLink to="/m0/play" className={({ isActive }) => isActive ? styles.active : ''}>Play</NavLink>
        <NavLink to="/m0/listen" className={({ isActive }) => isActive ? styles.active : ''}>Listen</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/m0/play" replace />} />
        <Route path="/m0/play" element={<PlayPage />} />
        <Route path="/m0/listen" element={<ListenPage />} />
      </Routes>
    </BrowserRouter>
  );
}
