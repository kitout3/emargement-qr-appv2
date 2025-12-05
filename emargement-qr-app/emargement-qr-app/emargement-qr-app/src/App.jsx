import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import QRScanner from './QRScanner';
import './App.css';

const normalizeKey = (key = '') =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const parseExcel = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const columnMap = {
    registrationId: ["id d'inscription", 'id dinscription', 'id inscription'],
    contact: ['contact'],
    role: ['role principal', 'role'],
    eventName: ['evenement', 'evenement principal'],
    createdAt: ['cree le', 'creele'],
    manager: ['gerant (contact) (relation)', 'gerant'],
    email: ['adresse email (contact) (relation)', 'email'],
    contactCreatedAt: ['cree le (contact) (relation)', 'cree le contact'],
  };

  return rows.map((row, index) => {
    const normalized = Object.fromEntries(
      Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
    );

    const pickValue = (aliases) => {
      const foundKey = aliases.find((alias) => normalized[alias] !== undefined);
      return foundKey ? normalized[foundKey] : '';
    };

    const registrationId = pickValue(columnMap.registrationId) || `QR-${Date.now()}-${index}`;

    return {
      id: registrationId,
      registrationId,
      contact: pickValue(columnMap.contact) || 'Invité·e',
      role: pickValue(columnMap.role),
      eventName: pickValue(columnMap.eventName),
      createdAt: pickValue(columnMap.createdAt),
      manager: pickValue(columnMap.manager),
      email: pickValue(columnMap.email),
      contactCreatedAt: pickValue(columnMap.contactCreatedAt),
      present: false,
      presentAt: null,
    };
  });
};

const formatDateTime = (date = new Date()) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

function App() {
  const [multiScan, setMultiScan] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [history, setHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [eventForm, setEventForm] = useState({ name: '', date: '', file: null });
  const [manualGuest, setManualGuest] = useState({ firstName: '', lastName: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [eventError, setEventError] = useState('');

  const selectedEvent = useMemo(
    () => events.find((evt) => evt.id === selectedEventId),
    [events, selectedEventId]
  );

  const totalInvites = selectedEvent?.attendees.length || 0;
  const presentCount = selectedEvent?.attendees.filter((a) => a.present).length || 0;
  const pendingCount = Math.max(totalInvites - presentCount, 0);

  const filteredAttendees = useMemo(() => {
    if (!selectedEvent) return [];
    const query = normalizeKey(searchTerm);
    if (!query) return selectedEvent.attendees;

    return selectedEvent.attendees.filter((attendee) => {
      const haystack = [
        attendee.registrationId,
        attendee.contact,
        attendee.email,
        attendee.role,
      ]
        .filter(Boolean)
        .map(normalizeKey)
        .join(' ');
      return haystack.includes(query);
    });
  }, [searchTerm, selectedEvent]);

  const handleValidation = ({ qrCode }) => {
    setShowScanner(false);
    const code = qrCode?.trim();

    if (!selectedEvent) {
      const fallbackEntry = {
        id: Date.now(),
        status: 'no',
        label: 'Aucun événement sélectionné',
        name: 'Sélection requise',
        time: formatDateTime(),
        details: code || 'Code non reconnu',
      };
      setHistory((prev) => [fallbackEntry, ...prev].slice(0, 15));
      return;
    }

    const matchIndex = selectedEvent.attendees.findIndex(
      (guest) => normalizeKey(guest.registrationId) === normalizeKey(code)
    );

    const foundGuest = matchIndex !== -1 ? selectedEvent.attendees[matchIndex] : null;
    const now = new Date();

    if (foundGuest) {
      setEvents((prev) =>
        prev.map((evt) => {
          if (evt.id !== selectedEventId) return evt;
          const updatedAttendees = [...evt.attendees];
          updatedAttendees[matchIndex] = {
            ...foundGuest,
            present: true,
            presentAt: formatDateTime(now),
          };
          return { ...evt, attendees: updatedAttendees };
        })
      );
    }

    const isValid = Boolean(foundGuest);

    const newEntry = {
      id: now.getTime(),
      status: isValid ? 'ok' : 'no',
      label: isValid ? 'Présence confirmée' : 'QR inconnu',
      name: foundGuest?.contact || 'Invité non trouvé',
      time: formatDateTime(now),
      details: code || 'Code non reconnu',
    };

    setHistory((prev) => [newEntry, ...prev].slice(0, 15));
  };

  const handleEventFile = (file) => {
    setEventForm((prev) => ({ ...prev, file }));
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setEventError('');

    if (!eventForm.name || !eventForm.date || !eventForm.file) {
      setEventError('Nom, date et fichier Excel sont requis.');
      return;
    }

    try {
      const attendees = await parseExcel(eventForm.file);
      const eventId = `evt-${Date.now()}`;
      const newEvent = {
        id: eventId,
        name: eventForm.name,
        date: eventForm.date,
        attendees,
      };

      setEvents((prev) => [newEvent, ...prev]);
      setSelectedEventId(eventId);
      setEventForm({ name: '', date: '', file: null });
    } catch (err) {
      console.error(err);
      setEventError("Impossible de lire le fichier. Vérifiez le format (.xlsx).");
    }
  };

  const handleManualAdd = (e) => {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!manualGuest.firstName || !manualGuest.lastName) return;

    const registrationId = `MANU-${Date.now()}`;
    const newGuest = {
      id: registrationId,
      registrationId,
      contact: `${manualGuest.firstName} ${manualGuest.lastName}`.trim(),
      present: false,
      presentAt: null,
    };

    setEvents((prev) =>
      prev.map((evt) =>
        evt.id === selectedEventId
          ? { ...evt, attendees: [newGuest, ...evt.attendees] }
          : evt
      )
    );

    setManualGuest({ firstName: '', lastName: '' });
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
            <p className="eyebrow">Gestion des événements</p>
            <h1 className="screen-title">Application d'émargement</h1>
          </div>
          <span className="user-pill">Admin</span>
        </header>

        <section className="panel">
          <h3 className="panel-title">Créer un événement</h3>
          <form className="form-grid" onSubmit={handleCreateEvent}>
            <label className="form-field">
              <span>Nom de l'événement</span>
              <input
                type="text"
                value={eventForm.name}
                onChange={(e) => setEventForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Conférence, atelier..."
              />
            </label>
            <label className="form-field">
              <span>Date</span>
              <input
                type="date"
                value={eventForm.date}
                onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </label>
            <label className="form-field">
              <span>Fichier Excel (.xlsx)</span>
              <input type="file" accept=".xlsx" onChange={(e) => handleEventFile(e.target.files?.[0])} />
            </label>
            <div className="form-actions">
              <button type="submit" className="primary">
                Créer et charger les invités
              </button>
              {eventError && <p className="alert">{eventError}</p>}
            </div>
          </form>
        </section>

        <section className="panel">
          <div className="info-row">
            <div>
              <p className="muted">Événements créés</p>
              <select
                className="select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
              >
                <option value="">Sélectionnez un événement</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name} — {evt.date}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="muted">Date choisie</p>
              <p className="accent">{selectedEvent?.date || 'Aucune'}</p>
            </div>
          </div>
          {selectedEvent ? (
            <p className="muted">{selectedEvent.attendees.length} invité(s) importés depuis Excel.</p>
          ) : (
            <p className="alert">Sélectionnez un événement pour commencer les scans et recherches.</p>
          )}
        </section>

        <section className="panel">
          <h3 className="panel-title">Présence des invités</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Total invités</p>
              <p className="stat-value">{totalInvites}</p>
              <span className="stat-tag">Import Excel</span>
            </div>
            <div className="stat-card">
              <p className="stat-label">Invités présents</p>
              <p className="stat-value">{presentCount}</p>
            </div>
            <div className="stat-card">
              <p className="stat-label">QR en attente</p>
              <p className="stat-value">{pendingCount}</p>
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

        <section className="panel action-grid">
          <div className="action-card">
            <div className="panel-heading">
              <div>
                <p className="muted">Scan Code QR</p>
                <h3 className="panel-title">Ouvrir le scanner</h3>
              </div>
              <button className="primary" onClick={() => setShowScanner(true)} disabled={!selectedEvent}>
                Scanner maintenant
              </button>
            </div>
            {showScanner && (
              <div className="scanner-wrapper">
                <QRScanner onValidation={handleValidation} autoRestart={multiScan} />
                <button className="ghost" onClick={() => setShowScanner(false)}>
                  Fermer
                </button>
              </div>
            )}
          </div>

          <div className="action-card">
            <div className="panel-heading">
              <div>
                <p className="muted">Recherche</p>
                <h3 className="panel-title">Trouver un invité manuellement</h3>
              </div>
            </div>
            <input
              type="search"
              className="input"
              placeholder="Nom, email ou ID"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!selectedEvent}
            />
            <div className="table-wrapper">
              <table className="attendee-table">
                <thead>
                  <tr>
                    <th>ID inscription</th>
                    <th>Contact</th>
                    <th>Email</th>
                    <th>Présent</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendees.slice(0, 8).map((guest) => (
                    <tr key={guest.id} className={guest.present ? 'present' : ''}>
                      <td>{guest.registrationId}</td>
                      <td>{guest.contact}</td>
                      <td>{guest.email || '—'}</td>
                      <td>{guest.present ? 'Oui' : 'Non'}</td>
                      <td>{guest.presentAt || '—'}</td>
                    </tr>
                  ))}
                  {!filteredAttendees.length && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Aucun invité à afficher.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="action-card">
            <div className="panel-heading">
              <div>
                <p className="muted">Ajout manuel</p>
                <h3 className="panel-title">Ajouter un invité (nom & prénom)</h3>
              </div>
            </div>
            <form className="form-inline" onSubmit={handleManualAdd}>
              <input
                type="text"
                placeholder="Prénom"
                value={manualGuest.firstName}
                onChange={(e) => setManualGuest((prev) => ({ ...prev, firstName: e.target.value }))}
                disabled={!selectedEvent}
              />
              <input
                type="text"
                placeholder="Nom"
                value={manualGuest.lastName}
                onChange={(e) => setManualGuest((prev) => ({ ...prev, lastName: e.target.value }))}
                disabled={!selectedEvent}
              />
              <button type="submit" className="secondary" disabled={!selectedEvent}>
                Ajouter
              </button>
            </form>
            <p className="muted small">
              Un ID unique sera généré automatiquement pour permettre le scan ultérieur.
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="muted">Historique</p>
              <h3 className="panel-title">Derniers scans</h3>
            </div>
            <div className="badge">{selectedEvent?.name || 'Aucun événement'}</div>
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
            {!history.length && <p className="muted">Aucun scan pour le moment.</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

export default App;
