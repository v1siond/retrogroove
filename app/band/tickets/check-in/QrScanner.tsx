'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractToken } from '@/lib/ticketing/qr';

// ─── feature detection ────────────────────────────────────────────────────────

type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return Ctor ?? null;
}

/** Camera + decode is only attemptable with getUserMedia available (HTTPS). */
export function cameraScanSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !!navigator.mediaDevices?.getUserMedia;
}

// ─── beep + flash feedback ─────────────────────────────────────────────────────

function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
    osc.onended = () => ctx.close().catch(() => {});
  } catch {
    /* audio is best-effort */
  }
}

// ─── error copy ────────────────────────────────────────────────────────────────

type ScanError = 'denied' | 'nocamera' | 'unsupported' | 'failed';

function errorMessage(kind: ScanError): string {
  switch (kind) {
    case 'denied':
      return 'Permiso de cámara denegado. Habilítalo o ingresa el código manualmente.';
    case 'nocamera':
      return 'No se detectó ninguna cámara. Ingresa el código manualmente.';
    case 'unsupported':
      return 'Este navegador no soporta la cámara. Ingresa el código manualmente.';
    default:
      return 'No se pudo iniciar el escáner. Ingresa el código manualmente.';
  }
}

// ─── component ─────────────────────────────────────────────────────────────────

interface QrScannerProps {
  /** Called with the extracted token on a fresh, debounced decode. */
  onToken: (token: string) => void;
  /** When true the scanner pauses decoding (e.g. a ticket result is showing). */
  paused: boolean;
  /** Close the scanner (releases the camera). */
  onClose: () => void;
}

export function QrScanner({ onToken, paused, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<InstanceType<BarcodeDetectorCtor> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zxingControlsRef = useRef<{ stop: () => void } | null>(null);

  // Debounce: remember the last token + when we emitted it.
  const lastTokenRef = useRef<{ value: string; at: number } | null>(null);
  // `paused` as a ref so the rAF loop reads the live value without restarting.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [error, setError] = useState<ScanError | null>(null);
  const [flash, setFlash] = useState(false);
  const [starting, setStarting] = useState(true);

  // Emit a token at most once per 2s for the same value, and never while paused.
  const tryEmit = useCallback(
    (raw: string) => {
      if (pausedRef.current) return;
      const token = extractToken(raw);
      if (!token) return;
      const now = Date.now();
      const last = lastTokenRef.current;
      if (last && last.value === token && now - last.at < 2000) return;
      lastTokenRef.current = { value: token, at: now };

      setFlash(true);
      window.setTimeout(() => setFlash(false), 220);
      playBeep();
      onToken(token);
    },
    [onToken]
  );

  // Release everything: rAF loop, zxing controls, and (critically) all tracks.
  const releaseCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Native BarcodeDetector loop.
  const runDetectorLoop = useCallback(() => {
    const tick = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (!video || !detector) return;
      if (!pausedRef.current && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) tryEmit(codes[0].rawValue);
        } catch {
          /* a single bad frame shouldn't kill the loop */
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [tryEmit]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!cameraScanSupported()) {
        setError('unsupported');
        setStarting(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // iOS needs these for inline autoplay.
        video.setAttribute('playsinline', 'true');
        await video.play().catch(() => {});
        setStarting(false);

        const Detector = getBarcodeDetector();
        if (Detector) {
          detectorRef.current = new Detector({ formats: ['qr_code'] });
          runDetectorLoop();
          return;
        }

        // Fallback: @zxing/browser for iOS Safari / no-BarcodeDetector browsers.
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return;
        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromVideoElement(video, (res) => {
          if (res) tryEmit(res.getText());
        });
        zxingControlsRef.current = controls;
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') setError('denied');
        else if (name === 'NotFoundError' || name === 'OverconstrainedError') setError('nocamera');
        else setError('failed');
        setStarting(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      releaseCamera();
    };
    // run once on mount; helpers are stable via useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    releaseCamera();
    onClose();
  }, [releaseCamera, onClose]);

  return (
    <div
      data-testid="qr-scanner"
      style={{
        position: 'relative',
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(124,58,237,.45)',
        background: '#101114',
        boxShadow: '0 8px 28px rgba(16,17,20,.45)',
      }}
    >
      {error ? (
        <div
          data-testid="qr-scanner-error"
          style={{ padding: '22px 18px', textAlign: 'center' }}
        >
          <div style={{ fontSize: '1.4rem', marginBottom: 8, opacity: 0.6 }}>⚠</div>
          <div
            style={{
              fontSize: '.78rem',
              color: 'rgba(236,230,240,.85)',
              lineHeight: 1.5,
              marginBottom: 14,
            }}
          >
            {errorMessage(error)}
          </div>
          <button
            data-testid="qr-scanner-close"
            type="button"
            onClick={handleClose}
            style={closeBtnStyle}
          >
            Cerrar
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            muted
            playsInline
            data-testid="qr-scanner-video"
            style={{
              display: 'block',
              width: '100%',
              height: 260,
              objectFit: 'cover',
              background: '#000',
            }}
          />

          {/* scan reticle */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: 168,
                height: 168,
                borderRadius: 16,
                boxShadow: '0 0 0 2000px rgba(16,17,20,.45)',
              }}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <span key={corner} style={cornerStyle(corner)} />
              ))}
            </div>
          </div>

          {/* green success flash */}
          {flash && (
            <div
              data-testid="qr-scanner-flash"
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(34,197,94,.35)',
                pointerEvents: 'none',
              }}
            />
          )}

          {/* hint + close */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'linear-gradient(transparent, rgba(16,17,20,.85))',
            }}
          >
            <span style={{ fontSize: '.66rem', color: 'rgba(236,230,240,.8)' }}>
              {starting ? 'Iniciando cámara…' : 'Apunta al código QR del fan'}
            </span>
            <button
              data-testid="qr-scanner-close"
              type="button"
              onClick={handleClose}
              style={closeBtnStyle}
            >
              Detener
            </button>
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}

// ─── styles ────────────────────────────────────────────────────────────────────

const closeBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 'var(--radius-pill, 999px)',
  border: '1px solid rgba(124,58,237,.55)',
  background: 'rgba(124,58,237,.22)',
  color: '#fff',
  fontSize: '.72rem',
  fontWeight: 600,
  cursor: 'pointer',
};

function cornerStyle(corner: 'nw' | 'ne' | 'sw' | 'se'): React.CSSProperties {
  const size = 22;
  const w = 3;
  const color = '#a855f7';
  const base: React.CSSProperties = { position: 'absolute', width: size, height: size };
  const v = `${w}px solid ${color}`;
  const map: Record<typeof corner, React.CSSProperties> = {
    nw: { top: -1, left: -1, borderTop: v, borderLeft: v, borderTopLeftRadius: 16 },
    ne: { top: -1, right: -1, borderTop: v, borderRight: v, borderTopRightRadius: 16 },
    sw: { bottom: -1, left: -1, borderBottom: v, borderLeft: v, borderBottomLeftRadius: 16 },
    se: { bottom: -1, right: -1, borderBottom: v, borderRight: v, borderBottomRightRadius: 16 },
  };
  return { ...base, ...map[corner] };
}
