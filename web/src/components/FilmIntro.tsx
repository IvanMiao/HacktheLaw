import { useEffect, useRef, useState } from 'react';
import threeUrl from '../../../domino-demo/three.min.js?url';
import filmUrl from '../../../domino-demo/film3d.js?url';
import { createFilmSound } from './filmSound';

type Film = { push: () => void; overview: () => void; stop: () => void };

declare global {
  interface Window {
    THREE?: unknown;
    film3D?: (canvas: HTMLCanvasElement, hooks: { hit: (index: number) => void; land: () => void }) => Film | null;
  }
}

function loadScript(url: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(script);
  });
}

let filmScripts: Promise<void> | null = null;
function loadFilmScripts() {
  if (window.film3D) return Promise.resolve();
  filmScripts ??= (async () => {
    if (!window.THREE) await loadScript(threeUrl);
    await loadScript(filmUrl);
  })().catch((error) => { filmScripts = null; throw error; });
  return filmScripts;
}

export function FilmIntro() {
  const [visible, setVisible] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [closing, setClosing] = useState(false);
  const [gl, setGl] = useState(false);
  const [line, setLine] = useState(0);
  const [showTitle, setShowTitle] = useState(false);
  const [showTag, setShowTag] = useState(false);
  const [hideLines, setHideLines] = useState(false);
  const [sound, setSound] = useState<'off' | 'on' | 'unavailable'>('off');
  const canvas = useRef<HTMLCanvasElement>(null);
  const closingRef = useRef(false);
  const soundRef = useRef<ReturnType<typeof createFilmSound> | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let film: Film | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const pause = (ms: number) => new Promise<void>((resolve) => {
      const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms);
      timers.add(timer);
    });
    const open = () => active && !closingRef.current;

    async function run() {
      try {
        await loadFilmScripts();
        if (!open() || !canvas.current) return;
        let landed = () => {};
        const land = new Promise<void>((resolve) => { landed = resolve; });
        film = window.film3D?.(canvas.current, {
          hit: (index) => { if (open()) { soundRef.current?.click(1.1 + index / 44 * 0.5); if (index === 12) setLine(2); } },
          land: () => { if (open()) { soundRef.current?.thud(); setLine(3); landed(); } },
        }) ?? null;
        if (!film) { setVisible(false); return; }
        setGl(true);
        await pause(900);
        if (!open()) return;
        setLine(1);
        await pause(1300);
        if (!open()) return;
        film.push();
        await Promise.race([land, pause(7000)]);
        if (!open()) return;
        setLine(3);
        await pause(1500);
        if (!open()) return;
        film.overview();
        setHideLines(true);
        await pause(900);
        if (!open()) return;
        setShowTitle(true);
        'Domino'.split('').forEach((_, index) => {
          const timer = setTimeout(() => {
            timers.delete(timer);
            if (open()) soundRef.current?.click(0.8 + index * 0.09);
          }, index * 120);
          timers.add(timer);
        });
        await pause(1100);
        if (!open()) return;
        setShowTag(true);
        await pause(2200);
        if (open()) { closingRef.current = true; setClosing(true); }
      } catch {
        if (open()) setVisible(false);
      }
    }
    void run();
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      film?.stop();
      soundRef.current?.stop();
      soundRef.current = null;
    };
  }, [visible]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setVisible(false), 1300);
    return () => clearTimeout(timer);
  }, [closing]);

  if (!visible) return null;
  const skip = () => { if (!closingRef.current) { closingRef.current = true; setClosing(true); } };
  const toggleSound = async () => {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current = null;
      setSound('off');
      return;
    }
    try {
      const player = createFilmSound();
      soundRef.current = player;
      await player.unlock();
      if (!closingRef.current && soundRef.current === player) setSound('on');
    } catch {
      soundRef.current?.stop();
      soundRef.current = null;
      setSound('unavailable');
    }
  };

  return (
    <div className={`intro-film${gl ? ' gl' : ''}${closing ? ' out' : ''}`} onClick={skip} aria-label="Domino introduction">
      <canvas ref={canvas} className="intro-canvas" aria-hidden="true" />
      <div className="intro-vignette" aria-hidden="true" />
      <div className={`intro-lines${hideLines ? ' gone' : ''}`}>
        <p className={line >= 1 ? 'in' : ''}>One registry stamp.</p>
        <p className={line >= 2 ? 'in' : ''}>Four days late.</p>
        <p className={line >= 3 ? 'in' : ''}>A €18,400 claim, <em>gone</em>.</p>
      </div>
      <h1 className="intro-title" aria-label="Domino">{'Domino'.split('').map((letter, index) => <span key={index} className={showTitle ? 'in' : ''} style={{ transitionDelay: `${index * 120}ms` }}>{letter}</span>)}</h1>
      <p className={`intro-tag${showTag ? ' in' : ''}`}>Find the domino that knocks out the claim.</p>
      <button className="intro-sound" aria-pressed={sound === 'on'} disabled={sound === 'unavailable'} onClick={(event) => { event.stopPropagation(); void toggleSound(); }}>{sound === 'on' ? 'Sound on' : sound === 'off' ? 'Enable sound' : 'Sound unavailable'}</button>
      <button className="intro-skip" onClick={(event) => { event.stopPropagation(); skip(); }}>Skip ›</button>
    </div>
  );
}
