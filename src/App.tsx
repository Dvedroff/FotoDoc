import { useState, useRef, useEffect, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';

// Data
const MM_PX = 300 / 25.4; // 300 dpi

interface DocItem {
  n: string;
  w: number;
  h: number;
  g: string;
}

const DOCS: DocItem[] = [
  { n: 'Загранпаспорт', w: 35, h: 45, g: 'Документы РФ' },
  { n: 'Паспорт РФ', w: 35, h: 45, g: 'Документы РФ' },
  { n: 'Госуслуги (онлайн)', w: 35, h: 45, g: 'Документы РФ' },
  { n: 'Водительские права', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'ВНЖ РФ', w: 35, h: 45, g: 'Документы РФ' },
  { n: 'РВП', w: 35, h: 45, g: 'Документы РФ' },
  { n: '3×4 (универсальный)', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Военный билет', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Студенческий билет', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Медкнижка', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Пенсионное удостоверение', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Пропуск / бейдж', w: 30, h: 40, g: 'Документы РФ' },
  { n: 'Виза Шенген', w: 35, h: 45, g: 'Визы' },
  { n: 'Виза / паспорт США', w: 51, h: 51, g: 'Визы' },
  { n: 'Виза Китай', w: 33, h: 48, g: 'Визы' },
  { n: 'Виза Индия', w: 51, h: 51, g: 'Визы' },
  { n: 'Виза Великобритания', w: 35, h: 45, g: 'Визы' },
  { n: '4×6 см', w: 40, h: 60, g: 'Прочее' },
];

function App() {
  const [docIdx, setDocIdx] = useState(0);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [origBlob, setOrigBlob] = useState<Blob | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [bgDone, setBgDone] = useState(false);
  const [bgLoading, setBgLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const isDraggingRef = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outSize = useCallback(() => {
    const d = DOCS[docIdx];
    return { W: Math.round(d.w * MM_PX), H: Math.round(d.h * MM_PX) };
  }, [docIdx]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3200);
  }, []);

  // Render canvas whenever image, zoom, offset or doc changes
  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const d = DOCS[docIdx];
    const W = Math.round(d.w * MM_PX);
    const H = Math.round(d.h * MM_PX);
    canvas.width = W;
    canvas.height = H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    const base = Math.max(W / img.width, H / img.height);
    const sc = base * zoom;
    const dw = img.width * sc;
    const dh = img.height * sc;
    ctx.drawImage(img, (W - dw) / 2 + offset.x, (H - dh) / 2 + offset.y, dw, dh);
  }, [img, zoom, offset, docIdx]);

  // Reveal animation
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('vis');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal:not(.vis)').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [showEditor]);

  // Paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') === 0) {
          const file = items[i].getAsFile();
          if (file) {
            // Inline file handling for paste
            if (!/^image\//.test(file.type)) {
              showToast('Это не изображение 🙂');
              return;
            }
            if (file.size > 15 * 1024 * 1024) {
              showToast('Файл больше 15 МБ');
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const image = new Image();
              image.onload = () => {
                setImg(image);
                setOrigBlob(file);
                setBgDone(false);
                setZoom(1);
                setOffset({ x: 0, y: 0 });
                setShowEditor(true);
                showToast('Фото вставлено из буфера обмена');
                setTimeout(() => {
                  document.getElementById('editorSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
              };
              image.src = reader.result as string;
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [showToast]);

  const handleFile = (file: File | null) => {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Это не изображение 🙂');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showToast('Файл больше 15 МБ');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        setImg(image);
        setOrigBlob(file);
        setBgDone(false);
        setZoom(1);
        setOffset({ x: 0, y: 0 });
        setShowEditor(true);
        showToast('Фото загружено — выберите документ и скачайте результат');
        setTimeout(() => {
          document.getElementById('editorSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      };
      image.onerror = () => {
        showToast('Браузер не смог прочитать файл (HEIC поддерживается не везде)');
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const pickFile = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    fileInputRef.current?.click();
  };

  const scrollToUpload = () => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
  };

  const selectDoc = (idx: number) => {
    setDocIdx(idx);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
  };

  const openCamera = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCameraOpen(true);
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1600 } },
        audio: false,
      })
      .then((stream) => {
        camStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setCameraOpen(false);
        showToast('Не удалось получить доступ к камере');
      });
  };

  const closeCamera = () => {
    setCameraOpen(false);
    if (camStreamRef.current) {
      camStreamRef.current.getTracks().forEach((t) => t.stop());
      camStreamRef.current = null;
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth || 720;
    tmp.height = video.videoHeight || 960;
    const tctx = tmp.getContext('2d');
    if (!tctx) return;
    tctx.translate(tmp.width, 0);
    tctx.scale(-1, 1);
    tctx.drawImage(video, 0, 0, tmp.width, tmp.height);
    tmp.toBlob(
      (blob) => {
        closeCamera();
        if (blob) handleFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.95
    );
  };

  const aiBackground = async () => {
    if (!origBlob) {
      showToast('Сначала загрузите фото');
      return;
    }
    setBgLoading(true);
    try {
      const blob = await removeBackground(origBlob, {
        output: { format: 'image/png' },
      });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        setImg(image);
        setBgDone(true);
        setBgLoading(false);
        showToast('Фон заменён на белый');
      };
      image.onerror = () => {
        setBgLoading(false);
        showToast('Не удалось применить фон');
      };
      image.src = url;
    } catch (err) {
      console.error('AI background removal error:', err);
      setBgLoading(false);
      showToast('AI-удаление фона недоступно — снимите на ровном светлом фоне');
    }
  };

  const downloadPhoto = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const d = DOCS[docIdx];
        saveBlob(blob, `foto-${d.w}x${d.h}mm.jpg`);
      },
      'image/jpeg',
      0.95
    );
  };

  const downloadSheet = () => {
    if (!canvasRef.current || !img) return;
    const SW = Math.round(100 * MM_PX);
    const SH = Math.round(150 * MM_PX);
    const pw = canvasRef.current.width;
    const ph = canvasRef.current.height;
    const gap = 24;
    const margin = 24;
    const cols = Math.floor((SW - 2 * margin + gap) / (pw + gap));
    const rows = Math.floor((SH - 2 * margin + gap) / (ph + gap));
    if (cols < 1 || rows < 1) {
      showToast('Фото не помещается на лист 10×15 см');
      return;
    }
    const sheet = document.createElement('canvas');
    sheet.width = SW;
    sheet.height = SH;
    const sctx = sheet.getContext('2d');
    if (!sctx) return;
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, SW, SH);
    const totalW = cols * pw + (cols - 1) * gap;
    const totalH = rows * ph + (rows - 1) * gap;
    const startX = (SW - totalW) / 2;
    const startY = (SH - totalH) / 2;
    sctx.strokeStyle = '#c3c8d9';
    sctx.setLineDash([10, 8]);
    sctx.lineWidth = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = startX + c * (pw + gap);
        const py = startY + r * (ph + gap);
        sctx.drawImage(canvasRef.current, px, py);
        sctx.strokeRect(px - 4, py - 4, pw + 8, ph + 8);
      }
    }
    sheet.toBlob(
      (blob) => {
        if (blob) saveBlob(blob, `list-10x15-${cols}x${rows}.jpg`);
      },
      'image/jpeg',
      0.92
    );
    showToast(`Лист 10×15: ${cols * rows} фото — несите в любую фотопечать`);
  };

  const saveBlob = (blob: Blob, name: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  // Drag handlers for canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    stageBoxRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const k = canvasRef.current.width / rect.width;
    setOffset((prev) => ({
      x: prev.x + (e.clientX - dragStartRef.current.x) * k,
      y: prev.y + (e.clientY - dragStartRef.current.y) * k,
    }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = zoom * (e.deltaY < 0 ? 1.06 : 0.94);
    setZoom(Math.min(3.2, Math.max(0.6, newZoom)));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    isDraggingRef.current = false;
    if (dropzoneRef.current) dropzoneRef.current.classList.remove('drag');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropzoneRef.current) dropzoneRef.current.classList.add('drag');
  };

  const handleDragLeave = () => {
    if (dropzoneRef.current) dropzoneRef.current.classList.remove('drag');
  };

  // Group docs for sidebar
  const groupedDocs = DOCS.reduce<Record<string, { d: DocItem; i: number }[]>>((acc, d, i) => {
    if (!acc[d.g]) acc[d.g] = [];
    acc[d.g].push({ d, i });
    return acc;
  }, {});

  const currentDoc = DOCS[docIdx];
  const size = outSize();

  return (
    <>
      {/* Header */}
      <header className="header-sticky">
        <div className="wrap nav">
          <a className="logo" href="#top">
            <span className="logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            ФотоДокумент
          </a>
          <nav className="nav-links">
            <a href="#how">Как это работает</a>
            <a href="#docs">Все документы</a>
            <a href="#req">Требования</a>
            <a href="#faq">Вопросы</a>
          </nav>
          <button className="btn btn-primary btn-sm" onClick={scrollToUpload}>
            Загрузить фото
          </button>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="reveal vis">
              <h1>
                Фото на документы онлайн <span>за 2 минуты</span>
              </h1>
              <p className="sub">
                Загрузите селфи — сервис подготовит фото для паспорта, визы, прав, резюме или анкеты: нужный размер, белый фон и правильная композиция.
              </p>
              <div className="badge-row">
                <span className="pill">Без регистрации</span>
                <span className="pill">Быстрый результат</span>
                <span className="pill">Скачать сразу</span>
              </div>
              <div className="hero-cta">
                <button className="btn btn-primary" onClick={scrollToUpload}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 16V4m0 0l-4 4m4-4l4 4" />
                    <path d="M4 20h16" />
                  </svg>
                  Загрузить фото
                </button>
                <button className="btn btn-ghost" onClick={() => openCamera()}>
                  Сделать селфи сейчас
                </button>
              </div>
            </div>
            <div className="compare reveal vis">
              <div className="compare-grid">
                <figure>
                  <div style={{ width: '100%', aspectRatio: '3/4', background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', display: 'grid', placeItems: 'center' }}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                  <figcaption>Ваше селфи</figcaption>
                </figure>
                <div className="compare-arrow">→</div>
                <figure>
                  <div style={{ width: '100%', aspectRatio: '3/4', background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid #e6e8f2' }}>
                    <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                  <figcaption>Готовое фото</figcaption>
                </figure>
              </div>
              <p className="compare-note">Фон заменяется на белый автоматически · размер под документ · 300 dpi</p>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="how" className="section">
          <div className="wrap">
            <div className="steps">
              <div className="step reveal">
                <div className="step-num">1</div>
                <h3>Загрузите фото</h3>
                <p>Селфи с телефона или компьютера. Можно сделать снимок прямо здесь или вставить из буфера (Ctrl+V).</p>
              </div>
              <div className="step reveal">
                <div className="step-num">2</div>
                <h3>Выберите размер</h3>
                <p>Под нужный документ: паспорт 35×45 мм, права 30×40 мм, виза США 51×51 мм и ещё десятки форматов.</p>
              </div>
              <div className="step reveal">
                <div className="step-num">3</div>
                <h3>Скачайте результат</h3>
                <p>Готовое фото — сразу. Один кадр или целый лист 10×15 см для печати.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Upload */}
        <section id="upload" style={{ paddingTop: 8 }}>
          <div className="wrap">
            <div
              ref={dropzoneRef}
              className="dropzone reveal"
              onClick={() => pickFile()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="dz-icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-4.5-4.5L7 20" />
                </svg>
              </div>
              <h3>Загрузите фото или сделайте селфи</h3>
              <p>Перетащите сюда, вставьте (Ctrl+V) или выберите файл</p>
              <div className="dz-actions">
                <button className="btn btn-primary" onClick={(e) => pickFile(e)}>
                  Выбрать фото
                </button>
                <button className="btn btn-ghost" onClick={(e) => openCamera(e)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  Сделать селфи сейчас
                </button>
              </div>
              <div className="dz-or">или</div>
              <p className="dz-hint">JPEG, PNG, HEIC, WebP · до 15 МБ</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0] || null);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        {/* Editor */}
        {showEditor && (
          <section id="editorSection" style={{ paddingTop: 10 }}>
            <div className="wrap">
              <div className="editor">
                <div className="ed-side">
                  <h3>Выберите документ</h3>
                  <div className="doc-groups">
                    {Object.entries(groupedDocs).map(([group, items]) => (
                      <div key={group}>
                        <div className="doc-group-title">{group}</div>
                        <div className="chips">
                          {items.map((item) => (
                            <button
                              key={item.i}
                              className={`chip ${item.i === docIdx ? 'active' : ''}`}
                              onClick={() => selectDoc(item.i)}
                            >
                              {item.d.n} <small>{item.d.w}×{item.d.h}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ed-stage">
                  <div
                    ref={stageBoxRef}
                    className="stage-box"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onWheel={handleWheel}
                  >
                    <canvas ref={canvasRef} width={size.W} height={size.H} />
                    {showGuides && (
                      <div className="guides">
                        <div className="g-line" style={{ top: '8%' }}>
                          <span>макушка</span>
                        </div>
                        <div className="g-line" style={{ top: '80%' }}>
                          <span>подбородок</span>
                        </div>
                        <div className="g-center" />
                      </div>
                    )}
                  </div>
                  <div className="ed-meta">
                    {currentDoc.n} · {currentDoc.w}×{currentDoc.h} мм · {size.W}×{size.H} px · 300 dpi
                  </div>
                  <div className="ed-controls">
                    <div className="zoom-box">
                      <label htmlFor="zoomRange">Масштаб</label>
                      <input
                        type="range"
                        id="zoomRange"
                        min={60}
                        max={320}
                        value={Math.round(zoom * 100)}
                        onChange={(e) => setZoom(Number(e.target.value) / 100)}
                      />
                      <span style={{ fontSize: '12.5px', fontWeight: 700, minWidth: 38, textAlign: 'right' }}>
                        {Math.round(zoom * 100)}%
                      </span>
                    </div>
                    <label className="toggle">
                      <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
                      Подсказки композиции
                    </label>
                  </div>
                  <div className="ed-actions">
                    <button className="btn btn-ghost btn-sm" onClick={aiBackground} disabled={bgLoading}>
                      {bgLoading ? '⏳ Обрабатываем…' : bgDone ? '✅ Фон убран (AI)' : '✨ Убрать фон (AI)'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setZoom(1);
                        setOffset({ x: 0, y: 0 });
                      }}
                    >
                      Сбросить
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => pickFile()}>
                      Другое фото
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={downloadPhoto}>
                      Скачать фото
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={downloadSheet}>
                      Лист 10×15 для печати
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* All Docs */}
        <section id="docs" className="section">
          <div className="wrap">
            <h2 className="reveal">Все документы</h2>
            <p className="sub reveal">Нажмите на карточку — размер применится в редакторе.</p>
            <div className="docs-grid">
              {DOCS.map((d, i) => (
                <button
                  key={i}
                  className="doc-card reveal"
                  onClick={() => {
                    selectDoc(i);
                    if (img) {
                      document.getElementById('editorSection')?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      scrollToUpload();
                      showToast(`Сначала загрузите фото — размер уже выбран: ${d.n}`);
                    }
                  }}
                >
                  <span className="ic">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6" />
                      <path d="M9 15h6" />
                    </svg>
                  </span>
                  <b>{d.n}</b>
                  <span>{d.w}×{d.h} мм</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section id="req" className="section">
          <div className="wrap">
            <h2 className="reveal">Требования к фото на документы</h2>
            <p className="sub reveal">
              Базовые требования (загранпаспорт, паспорт РФ, Госуслуги — 35×45 мм). Точные параметры под конкретный документ — на его карточке выше.
            </p>
            <div className="req-card reveal" style={{ marginTop: 24 }}>
              {[
                'Размер 35×45 мм',
                'Лицо 70–80% высоты (≈32–36 мм)',
                'Фон светлый, однотонный',
                'Прямой взгляд в камеру, нейтральное выражение, рот закрыт',
                'Без головного убора (кроме постоянно носимых по религии)',
                'Очки — только прозрачные, без бликов и затемнения',
                'Равномерное освещение, без теней и пересветов',
              ].map((text, i) => (
                <div className="req-item" key={i}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {text}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section faq">
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="reveal">Частые вопросы</h2>
            <details className="reveal">
              <summary>Какой размер фото на документы?</summary>
              <div className="ans">
                Для паспорта РФ и загранпаспорта — 35×45 мм, для водительских прав и большинства справок — 30×40 мм (3×4 см). Сервис автоматически подгоняет фото под выбранный документ.
              </div>
            </details>
            <details className="reveal">
              <summary>Гарантируете, что фото примут?</summary>
              <div className="ans">
                Мы готовим фото по стандартным требованиям: размер, белый фон, композиция и положение головы. Но 100% гарантию дать не можем: требования у разных ведомств отличаются, а автоматическая обработка иногда ошибается. Проверьте готовое фото перед подачей — превью бесплатное.
              </div>
            </details>
            <details className="reveal">
              <summary>Нужно ли фотографироваться в студии?</summary>
              <div className="ans">
                Нет. Достаточно сделать селфи на телефон на любом фоне при ровном освещении — фон уберётся автоматически и станет белым.
              </div>
            </details>
            <details className="reveal">
              <summary>Куда попадают мои фотографии?</summary>
              <div className="ans">
                Никуда: обработка идёт прямо в вашем браузере, файлы не загружаются на сервер. Это быстро и конфиденциально.
              </div>
            </details>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer>
        <div className="wrap foot">
          <a className="logo" href="#top">
            <span className="logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            ФотоДокумент
          </a>
          <span>Фото обрабатываются локально в браузере · превью бесплатно</span>
          <span>© 2026 · Сделано с заботой о ваших документах</span>
        </div>
      </footer>

      {/* Camera Modal */}
      <div className={`modal ${cameraOpen ? 'open' : ''}`}>
        <div className="cam-box">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="cam-actions">
            <button className="btn btn-ghost btn-sm" onClick={closeCamera}>
              Отмена
            </button>
            <button className="shutter" title="Снять" onClick={snapPhoto} />
          </div>
        </div>
      </div>

      {/* Toast */}
      <div className={`toast ${toastVisible ? 'show' : ''}`}>{toastMsg}</div>
    </>
  );
}

export default App;
