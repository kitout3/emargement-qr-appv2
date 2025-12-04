import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const QRScanner = ({ onValidation, autoRestart = false }) => {
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const html5QrCodeRef = useRef(null);

  const stopScanner = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner) return;

    try {
      await scanner.stop().catch(() => {});
      await scanner.clear();
    } catch (err) {
      console.error('Erreur lors de la fermeture du scanner', err);
    } finally {
      html5QrCodeRef.current = null;
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanning = async () => {
    if (isScanning) return;
    setError(null);
    setScanResult(null);

    try {
      if (html5QrCodeRef.current) {
        await stopScanner();
      }

      html5QrCodeRef.current = new Html5Qrcode('qr-reader');

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await stopScanner();
          validateAttendance(decodedText);
        },
        () => {}
      );

      setIsScanning(true);
    } catch (err) {
      setError("Impossible d'accéder à la caméra. Vérifiez les permissions.");
      await stopScanner();
    }
  };

  const stopScanning = async () => {
    await stopScanner();
  };

  const validateAttendance = async (qrCode) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const isValid = qrCode && qrCode.length > 0;

      setScanResult({
        code: qrCode,
        isValid,
        message: isValid ? 'Émargement validé ✓' : 'QR Code invalide',
      });

      if (onValidation) {
        onValidation({ qrCode, isValid });
      }

      if (autoRestart) {
        setTimeout(() => {
          setScanResult(null);
          startScanning();
        }, 800);
      }
    } catch (err) {
      setScanResult({
        code: qrCode,
        isValid: false,
        message: 'Erreur de connexion au serveur',
      });
    }
  };

  const resetScan = () => {
    setScanResult(null);
    startScanning();
  };

  return (
    <div className="qr-card">
      <div id="qr-reader" className="qr-reader">
        {!isScanning && !scanResult && (
          <div className="qr-placeholder">📷 Cliquez sur Démarrer pour scanner</div>
        )}
      </div>

      {!scanResult && (
        <div className="qr-controls">
          {!isScanning ? (
            <button onClick={startScanning} className="qr-button">
              🎯 Démarrer le scan
            </button>
          ) : (
            <button onClick={stopScanning} className="qr-button stop">
              ⏹ Arrêter
            </button>
          )}
        </div>
      )}

      {error && <div className="alert">❌ {error}</div>}

      {scanResult && (
        <div className={`qr-result ${scanResult.isValid ? 'ok' : 'no'}`}>
          <p style={{ margin: '0 0 6px', fontWeight: 700 }}>{scanResult.message}</p>
          <p style={{ margin: 0, wordBreak: 'break-all', color: '#d7d7e0' }}>
            {scanResult.code.length > 60
              ? `${scanResult.code.substring(0, 60)}...`
              : scanResult.code}
          </p>
          {!autoRestart && (
            <button onClick={resetScan} className="secondary" style={{ marginTop: 10 }}>
              🔄 Scanner un autre code
            </button>
          )}
        </div>
      )}

      {isScanning && <p className="qr-instructions">Placez le QR code dans le cadre</p>}
    </div>
  );
};

export default QRScanner;
