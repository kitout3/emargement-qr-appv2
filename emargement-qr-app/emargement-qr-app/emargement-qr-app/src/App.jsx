import { useMemo, useState } from 'react';
import QRScanner from './QRScanner';
import './App.css';

const initialHistory = [
  {
    id: 1,
    status: 'ok',
    label: 'QR valide',
    name: 'Julia Hunt',
    time: '9:41 AM',
    details: "3 Burelle's Plz",
  },
  {
    id: 2,
    status: 'ok',
    label: 'QR valide',
    name: 'Julie Hudson',
    time: '9:42 AM',
    details: 'Valletta Bay Street',
  },
  {
    id: 3,
    status: 'ok',
    label: 'QR valide',
    name: 'Marissa Barton',
    time: '9:42 AM',
    details: 'Valletta Bay Street',
  },
  {
    id: 4,
    status: 'ok',
    label: 'QR valide',
    name: 'Dale Mackenzie',
    time: '9:43 AM',
    details: 'Brisbane Red St',
  },
  {
    id: 5,
    status: 'no',
    label: 'QR invalide',
    name: 'Jan 22, 2024',
    time: '9:44 AM',
    details: 'People exp',
  },
];

const initialSummary = {
  totalInvites: 304,
  present: 32,
  pending: 17,
};

function App() {
  const [multiScan, setMultiScan] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [history, setHistory] = useState(initialHistory);
  const [summary, setSummary] = useState(initialSummary);

  const handleValidation = ({ qrCode, isValid }) => {
    setShowScanner(false);
    setSummary((prev) => ({
      ...prev,
      present: isValid ? prev.present + 1 : prev.present,
      pending: Math.max(prev.pending - 1, 0),
    }));

    const now = new Date();
    const formattedTime = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);

    const newEntry = {
      id: now.getTime(),
      status: isValid ? 'ok' : 'no',
      label: isValid ? 'QR valide' : 'QR invalide',
      name: isValid ? 'Invité·e' : 'QR inconnu',
      time: formattedTime,
      details: qrCode?.substring(0, 18) || 'Code non reconnu',
    };

    setHistory((prev) => [newEntry, ...prev].slice(0, 12));
  };

  const modeBadge = useMemo(
    () => (multiScan ? 'Mode multi-scan' : 'Mode unique'),
    [multiScan]
  );

  return (
    <div className="app-shell">
      <div className="mobile-frame">
        <header className="topbar">
          <button className="icon-button" aria-label="Retour">
            ←
          </button>
          <div className="topbar-title">
            <p className="eyebrow">Enregistrer l'invité</p>
            <h1 className="screen-title">Application d'émargement</h1>
          </div>
          <span className="user-pill">James (Admin)</span>
        </header>

        <div className="hero">
          <div>
            <p className="muted">Nom de l'événement</p>
            <h2 className="hero-title">MDE (MATHEMATIQUES-DECOUVERTE-EXPERIENCE)</h2>
            <p className="subdued">Lieu</p>
            <p className="muted">Université de Paris Diderot, Bâtiment A, salle 7</p>
          </div>
          <button className="primary" onClick={() => setShowScanner(true)}>
            Scanner maintenant
          </button>
        </div>

        <section className="panel">
          <h3 className="panel-title">Présence des invités du jour</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Total invités</p>
              <p className="stat-value">{summary.totalInvites}</p>
              <span className="stat-tag">Invités enregistrés</span>
            </div>
            <div className="stat-card">
              <p className="stat-label">Invités présents</p>
              <p className="stat-value">{summary.present}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">QR en attente</p>
              <p className="stat-value">{summary.pending}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">{modeBadge}</p>
              <div className="toggle-row">
                <input
                  type="checkbox"
                  id="multiScan"
                  checked={multiScan}
                  onChange={() => setMultiScan((prev) => !prev)}
                />
                <label htmlFor="multiScan">Activer le multi-scan en continu</label>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="info-row">
            <div>
              <p className="muted">Description</p>
              <p className="accent">Émargement des étudiants 2024</p>
            </div>
            <div>
              <p className="muted">Date / Heure</p>
              <p className="accent">Lundi 27 janvier 2024</p>
            </div>
          </div>
          <p className="alert">⚠️ Aucun invité présent. Veuillez scanner le QR code pour enregistrer les invités.</p>
          <div className="actions">
            <button className="primary" onClick={() => setShowScanner(true)}>
              Scanner maintenant
            </button>
            <button className="secondary">Scan depuis la galerie</button>
            <button className="ghost">Confirmer manuellement</button>
          </div>
        </section>

        {showScanner && (
          <section className="panel">
            <div className="scanner-header">
              <div>
                <p className="muted">Activez l'appareil photo</p>
                <p className="accent">Assurez-vous d'autoriser les permissions caméra.</p>
              </div>
              <button className="ghost" onClick={() => setShowScanner(false)}>
                Fermer
              </button>
            </div>
            <QRScanner onValidation={handleValidation} autoRestart={multiScan} />
          </section>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="muted">Mode scan QR</p>
              <h3 className="panel-title">Liste des invités (par date/heure d'arrivée)</h3>
            </div>
            <div className="badge">LUN 27 JAN</div>
          </div>
          <ul className="history-list">
            {history.map((entry) => (
              <li key={entry.id} className="history-item">
                <span className={`status-dot ${entry.status === 'ok' ? 'ok' : 'no'}`}></span>
                <div className="history-body">
                  <div className="history-top">
                    <p className="history-title">{entry.label}</p>
                    <span className={`chip ${entry.status === 'ok' ? 'ok' : 'no'}`}>
                      {entry.status === 'ok' ? 'OK' : 'Non'}
                    </span>
                  </div>
                  <p className="history-meta">{entry.details}</p>
                  <div className="history-footer">
                    <span>{entry.name}</span>
                    <span>{entry.time}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default App;
