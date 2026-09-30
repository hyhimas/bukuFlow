"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import Button from "@/components/ui/Button";

interface BookCameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void | Promise<void>;
  title?: string;
  subtitle?: string;
}

export default function BookCameraScannerModal({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode / QR Code Buku",
  subtitle = "Arahkan kamera ke barcode stiker buku untuk memilih secara instan",
}: BookCameraScannerModalProps) {
  const [error, setError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>("");
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const activeTracksRef = useRef<MediaStreamTrack[]>([]);
  const isStoppingRef = useRef(false);
  const scannerContainerId = "buku-camera-scanner-viewfinder";

  // Synthesize pleasant scanner beep sound using Web Audio API
  const playBeep = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // AudioContext might fail silently if autoplay blocked
    }
  }, []);

  const triggerVibration = useCallback(() => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
    } catch {}
  }, []);

  const stopAllActiveCameraTracks = useCallback(() => {
    // 1. Force stop every track registered in memory
    activeTracksRef.current.forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch {}
    });
    activeTracksRef.current = [];

    // 2. Force stop every video element in the DOM
    try {
      const videos = document.querySelectorAll<HTMLVideoElement>("video");
      videos.forEach((video) => {
        if (video.srcObject && "getTracks" in (video.srcObject as any)) {
          const stream = video.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            try {
              track.stop();
              track.enabled = false;
            } catch {}
          });
          video.srcObject = null;
        }
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch {}
      });
    } catch {}
  }, []);

  const stopScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    // Immediate track shutdown
    stopAllActiveCameraTracks();

    const scanner = html5QrCodeRef.current;
    if (scanner) {
      try {
        // Also stop tracks from scanner internal references
        const internalStream = (scanner as any)?.localMediaStream || (scanner as any)?._localMediaStream;
        if (internalStream && typeof internalStream.getTracks === "function") {
          internalStream.getTracks().forEach((t: MediaStreamTrack) => {
            try {
              t.stop();
              t.enabled = false;
            } catch {}
          });
        }

        if (scanner.isScanning) {
          await scanner.stop().catch(() => {});
        }
        try {
          await scanner.clear();
        } catch {}
      } catch {
        // Benign transition logs
      } finally {
        html5QrCodeRef.current = null;
      }
    }

    // Final sweep
    stopAllActiveCameraTracks();

    isStoppingRef.current = false;
    setIsScanning(false);
    setTorchOn(false);
    setHasTorch(false);
  }, [stopAllActiveCameraTracks]);

  const handleModalClose = useCallback(() => {
    stopAllActiveCameraTracks();
    void stopScanner();
    onClose();
  }, [stopAllActiveCameraTracks, stopScanner, onClose]);

  // Fetch available camera devices using pure browser enumerateDevices (no stream leaks)
  useEffect(() => {
    if (!isOpen) return;

    if (navigator?.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices
            .filter((d) => d.kind === "videoinput")
            .map((d, index) => ({
              id: d.deviceId,
              label: d.label || `Kamera ${index + 1}`,
            }));

          if (videoDevices.length > 0) {
            setCameras(videoDevices);
            const backCamera = videoDevices.find(
              (c) =>
                c.label.toLowerCase().includes("back") ||
                c.label.toLowerCase().includes("rear") ||
                c.label.toLowerCase().includes("environment") ||
                c.label.toLowerCase().includes("belakang"),
            );
            if (!selectedCameraId) {
              setSelectedCameraId(backCamera ? backCamera.id : videoDevices[0].id);
            }
          }
        })
        .catch((err) => {
          console.warn("Camera enumeration warning:", err);
        });
    }
  }, [isOpen, selectedCameraId]);

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn("Torch toggle error:", err);
    }
  };

  const handleProcessCode = useCallback(
    (code: string) => {
      const clean = code.trim();
      if (!clean) return;

      playBeep();
      triggerVibration();
      setLastScanned(clean);

      void onScan(clean);

      stopAllActiveCameraTracks();
      void stopScanner().then(() => {
        onClose();
      });
    },
    [onClose, onScan, playBeep, stopScanner, stopAllActiveCameraTracks, triggerVibration],
  );

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleProcessCode(manualCode);
    setManualCode("");
  };

  useEffect(() => {
    if (!isOpen) {
      stopAllActiveCameraTracks();
      void stopScanner();
      return;
    }

    let isMounted = true;
    let trackCaptureInterval: any = null;
    setError("");
    setLastScanned("");

    const startScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (!isMounted) return;

        // Cleanup any previous scanner instance
        if (html5QrCodeRef.current) {
          await stopScanner();
        }

        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.ITF,
          ],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          verbose: false,
        });

        html5QrCodeRef.current = html5QrCode;

        const scanConfig = {
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const width = Math.min(Math.floor(viewfinderWidth * 0.88), 380);
            const height = Math.min(Math.floor(viewfinderHeight * 0.65), 240);
            return { width, height };
          },
          aspectRatio: 1.333,
          disableFlip: false,
        };

        const onScanSuccess = (decodedText: string) => {
          if (!isMounted) return;
          const clean = decodedText.trim();
          handleProcessCode(clean);
        };

        const attemptConfigs: any[] = [];
        if (selectedCameraId) {
          attemptConfigs.push(selectedCameraId);
          attemptConfigs.push({ deviceId: selectedCameraId });
        }
        attemptConfigs.push({ facingMode: "environment" });
        attemptConfigs.push({ facingMode: "user" });
        attemptConfigs.push({});

        let started = false;
        let lastAttemptError: any = null;

        for (const cfg of attemptConfigs) {
          if (!isMounted) break;
          try {
            await html5QrCode.start(cfg, scanConfig, onScanSuccess, () => {});
            started = true;
            break;
          } catch (cfgErr: any) {
            lastAttemptError = cfgErr;
          }
        }

        if (!started && isMounted) {
          throw lastAttemptError || new Error("Tidak dapat mengaktifkan kamera.");
        }

        if (isMounted) {
          setIsScanning(true);

          // Continuously capture all active hardware tracks to guarantee we can stop them
          trackCaptureInterval = setInterval(() => {
            if (!isMounted) return;
            const container = document.getElementById(scannerContainerId);
            const video = container?.querySelector("video");
            if (video && video.srcObject instanceof MediaStream) {
              video.srcObject.getTracks().forEach((track) => {
                if (!activeTracksRef.current.includes(track)) {
                  activeTracksRef.current.push(track);
                }
              });
            }
            const internalStream = (html5QrCode as any)?.localMediaStream || (html5QrCode as any)?._localMediaStream;
            if (internalStream instanceof MediaStream) {
              internalStream.getTracks().forEach((track: MediaStreamTrack) => {
                if (!activeTracksRef.current.includes(track)) {
                  activeTracksRef.current.push(track);
                }
              });
            }
          }, 150);

          try {
            const capabilities = html5QrCode.getRunningTrackCapabilities();
            if ((capabilities as any)?.torch) {
              setHasTorch(true);
            }
          } catch {}
        }
      } catch (err: any) {
        if (!isMounted) return;
        console.error("Camera scanner start failed:", err);

        const errMsg = (err?.message || err?.name || "").toLowerCase();
        let userMessage = "Gagal mengakses kamera. Pastikan izin kamera telah diberikan pada browser Anda.";

        if (errMsg.includes("notallowed") || errMsg.includes("permission") || errMsg.includes("denied")) {
          userMessage = "Izin kamera diblokir browser. Klik ikon gembok / kamera di sebelah kiri URL address bar browser, lalu ubah ke 'Allow / Izinkan'.";
        } else if (errMsg.includes("notreadable") || errMsg.includes("trackstart") || errMsg.includes("source") || errMsg.includes("in use")) {
          userMessage = "Kamera sedang digunakan oleh aplikasi lain (Zoom, Teams, Google Meet, atau tab browser lain). Harap tutup aplikasi tersebut lalu klik Coba Lagi.";
        } else if (errMsg.includes("notfound") || errMsg.includes("device")) {
          userMessage = "Tidak ada perangkat kamera / webcam yang terdeteksi di laptop/komputer ini.";
        } else if (err?.message) {
          userMessage = `Gagal membuka kamera: ${err.message}`;
        }

        setError(userMessage);
        setIsScanning(false);
      }
    };

    void startScanner();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleModalClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      isMounted = false;
      if (trackCaptureInterval) clearInterval(trackCaptureInterval);
      window.removeEventListener("keydown", handleKeyDown);
      stopAllActiveCameraTracks();
      void stopScanner();
    };
  }, [isOpen, selectedCameraId, retryKey, handleModalClose, stopAllActiveCameraTracks, handleProcessCode, stopScanner]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          handleModalClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-2xl flex flex-col text-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scanner-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-white px-5 py-3.5 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <span className="text-xl">📷</span>
            </div>
            <div className="min-w-0">
              <h3
                id="scanner-modal-title"
                className="truncate text-base font-bold text-slate-900"
              >
                {title}
              </h3>
              <p className="truncate text-xs text-slate-500">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0"
            title="Tutup Modal"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        {/* Quick Controls (Camera switcher & Torch) */}
        {(cameras.length > 1 || hasTorch) && (
          <div className="flex items-center justify-between gap-2.5 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {cameras.length > 1 && (
                <>
                  <span className="text-slate-500 font-medium shrink-0">Kamera:</span>
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      void stopScanner().then(() => {
                        setSelectedCameraId(e.target.value);
                      });
                    }}
                    className="w-full max-w-[200px] truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {cameras.map((c, i) => (
                      <option key={c.id} value={c.id}>
                        {c.label || `Kamera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  torchOn
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{torchOn ? "💡 Nyala" : "🔦 Flash"}</span>
              </button>
            )}
          </div>
        )}

        {/* Viewfinder Viewport */}
        <div className="relative flex flex-col items-center justify-center p-3 sm:p-4 bg-slate-900 min-h-[300px]">
          {error ? (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 bg-white rounded-xl border border-red-200 shadow-2xs max-w-sm">
              <span className="text-3xl">📷⚠️</span>
              <p className="text-sm text-red-600 font-semibold leading-relaxed">{error}</p>
              <div className="flex flex-col gap-2 w-full pt-1">
                <Button
                  type="button"
                  onClick={() => {
                    setError("");
                    setRetryKey((k) => k + 1);
                  }}
                  className="w-full text-xs font-semibold"
                >
                  🔄 Coba Hubungkan Kamera Lagi
                </Button>
                <p className="text-[11px] text-slate-500">
                  Atau masukkan nomor barcode/copy secara manual di input bawah.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-[420px] aspect-[4/3] rounded-xl overflow-hidden bg-black border border-slate-700 shadow-inner">
              <div
                id={scannerContainerId}
                className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover [&_img]:hidden [&_#qr-shaded-region]:hidden"
              />

              {/* Viewfinder Reticle Overlay */}
              {isScanning && !lastScanned && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <div className="relative w-[88%] h-[65%] border-2 border-blue-400/80 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                    {/* Laser Scan line */}
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_rgba(239,68,68,0.9)] animate-pulse"
                      style={{
                        top: "50%",
                        transform: "translateY(-50%)",
                      }}
                    />
                    {/* Corner Guides */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br" />
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-slate-100 drop-shadow-md bg-slate-900/80 px-3 py-1 rounded-full">
                    Arahkan Barcode 1D / QR Code ke dalam kotak
                  </p>
                </div>
              )}

              {/* Scanned Success Feedback */}
              {lastScanned && (
                <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center">
                  <span className="text-4xl animate-bounce">✅</span>
                  <p className="mt-2 text-sm font-bold text-emerald-300">Barcode Terdeteksi!</p>
                  <p className="mt-1.5 font-mono text-sm font-bold text-white bg-emerald-900/80 px-3 py-1.5 rounded-lg border border-emerald-500/40 tracking-wider">
                    {lastScanned}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Manual Barcode Input Fallback */}
        <div className="border-t border-slate-100 bg-white px-5 py-2.5 text-xs">
          <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Atau ketik kode barcode / copy manual..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={!manualCode.trim()}
              className="text-xs px-3 py-1.5 h-8 font-semibold shrink-0"
            >
              + Pilih
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-medium text-slate-700">Kamera Scanner Aktif</span>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold"
          >
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}


