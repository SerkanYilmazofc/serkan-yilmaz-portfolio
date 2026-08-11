import { useCallback, useEffect, useRef, useState } from "react";
import { generateMaze, type MazeData } from "./mazeGenerator";
import "./SecretMaze.css";

const YOUTUBE_URL = "https://www.youtube.com/@forcen8191";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Phase = "playing" | "found";

function mazeSizeForViewport(w: number) {
  if (w < 480) return { cols: 21, rows: 29 };
  if (w < 768) return { cols: 25, rows: 25 };
  if (w < 1100) return { cols: 31, rows: 21 };
  return { cols: 39, rows: 23 };
}

export function SecretMaze({ open, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mazeRef = useRef<MazeData | null>(null);
  const playerRef = useRef({ x: 0, y: 0 });
  const keysRef = useRef(new Set<string>());
  const cellRef = useRef(24);
  const rafRef = useRef(0);
  const touchDirRef = useRef({ x: 0, y: 0 });
  const foundLatch = useRef(false);

  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<Phase>("playing");
  const [hint, setHint] = useState(true);
  const [isTouch, setIsTouch] = useState(false);
  const phaseRef = useRef<Phase>("playing");

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const close = useCallback(() => {
    keysRef.current.clear();
    touchDirRef.current = { x: 0, y: 0 };
    foundLatch.current = false;
    setPhase("playing");
    setHint(true);
    setVisible(false);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  const bootMaze = useCallback(() => {
    const { cols, rows } = mazeSizeForViewport(window.innerWidth);
    const maze = generateMaze(cols, rows);
    mazeRef.current = maze;
    foundLatch.current = false;
    setPhase("playing");

    const pad = 16;
    const availW = window.innerWidth - pad * 2;
    const availH = window.innerHeight - pad * 2;
    const cell = Math.max(
      12,
      Math.min(28, Math.floor(Math.min(availW / maze.cols, availH / maze.rows))),
    );
    cellRef.current = cell;
    playerRef.current = {
      x: (maze.start.c + 0.5) * cell,
      y: (maze.start.r + 0.5) * cell,
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setIsTouch(window.matchMedia("(hover: none), (pointer: coarse)").matches);
    bootMaze();
    const id = requestAnimationFrame(() => setVisible(true));
    const hintTimer = window.setTimeout(() => setHint(false), 2200);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(hintTimer);
    };
  }, [open, bootMaze]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      const map: Record<string, string> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        W: "up",
        s: "down",
        S: "down",
        a: "left",
        A: "left",
        d: "right",
        D: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        keysRef.current.add(dir);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        W: "up",
        s: "down",
        S: "down",
        a: "left",
        A: "left",
        d: "right",
        D: "right",
      };
      const dir = map[e.key];
      if (dir) keysRef.current.delete(dir);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || !visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;
    let last = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const collides = (x: number, y: number, radius: number) => {
      const maze = mazeRef.current;
      if (!maze) return true;
      const cell = cellRef.current;
      const samples = [
        [x - radius, y - radius],
        [x + radius, y - radius],
        [x - radius, y + radius],
        [x + radius, y + radius],
        [x, y],
      ];
      for (const [sx, sy] of samples) {
        const c = Math.floor(sx / cell);
        const r = Math.floor(sy / cell);
        if (r < 0 || c < 0 || r >= maze.rows || c >= maze.cols) return true;
        if (maze.grid[r][c] === 0) return true;
      }
      return false;
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(32, now - last) / 1000;
      last = now;
      const maze = mazeRef.current;
      const cell = cellRef.current;
      if (!maze) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      const mazeW = maze.cols * cell;
      const mazeH = maze.rows * cell;
      const ox = (w - mazeW) / 2;
      const oy = (h - mazeH) / 2;

      if (phaseRef.current === "playing") {
        const speed = cell * 4.2;
        let mx = 0;
        let my = 0;
        const keys = keysRef.current;
        if (keys.has("left")) mx -= 1;
        if (keys.has("right")) mx += 1;
        if (keys.has("up")) my -= 1;
        if (keys.has("down")) my += 1;
        mx += touchDirRef.current.x;
        my += touchDirRef.current.y;
        if (mx !== 0 || my !== 0) {
          const len = Math.hypot(mx, my) || 1;
          mx = (mx / len) * speed * dt;
          my = (my / len) * speed * dt;
          const p = playerRef.current;
          const radius = cell * 0.22;
          const nx = p.x + mx;
          const ny = p.y + my;
          if (!collides(nx, p.y, radius)) p.x = nx;
          if (!collides(p.x, ny, radius)) p.y = ny;
        }

        const endCx = (maze.end.c + 0.5) * cell;
        const endCy = (maze.end.r + 0.5) * cell;
        if (
          !foundLatch.current &&
          Math.hypot(playerRef.current.x - endCx, playerRef.current.y - endCy) < cell * 0.45
        ) {
          foundLatch.current = true;
          setPhase("found");
        }
      }

      // Draw
      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(ox, oy);

      // Paths
      ctx.fillStyle = "#141414";
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          if (maze.grid[r][c] === 1) {
            ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
          }
        }
      }

      // Walls
      ctx.fillStyle = "#2a2a2a";
      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          if (maze.grid[r][c] === 0) {
            ctx.fillRect(c * cell, r * cell, cell + 0.5, cell + 0.5);
          }
        }
      }

      // Exit glow
      const ex = (maze.end.c + 0.5) * cell;
      const ey = (maze.end.r + 0.5) * cell;
      const exitGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, cell * 0.9);
      exitGrad.addColorStop(0, "rgba(163, 222, 254, 0.55)");
      exitGrad.addColorStop(1, "rgba(163, 222, 254, 0)");
      ctx.fillStyle = exitGrad;
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(201, 198, 197, 0.85)";
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // Player
      const px = playerRef.current.x;
      const py = playerRef.current.y;
      ctx.fillStyle = "#e5e2e1";
      ctx.beginPath();
      ctx.arc(px, py, cell * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Flashlight darkness overlay (screen space)
      const lightX = ox + px;
      const lightY = oy + py;
      const radius = Math.min(w, h) * (w < 768 ? 0.18 : 0.16);
      const lightR = Math.max(110, Math.min(180, radius));

      const dark = ctx.createRadialGradient(
        lightX,
        lightY,
        lightR * 0.15,
        lightX,
        lightY,
        lightR,
      );
      dark.addColorStop(0, "rgba(3,3,3,0)");
      dark.addColorStop(0.45, "rgba(3,3,3,0.35)");
      dark.addColorStop(0.75, "rgba(3,3,3,0.82)");
      dark.addColorStop(1, "rgba(3,3,3,0.97)");
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [open, visible]);

  const setTouch = (x: number, y: number) => {
    touchDirRef.current = { x, y };
  };

  if (!open) return null;

  return (
    <div
      ref={wrapRef}
      className={`secret-maze${visible ? " is-visible" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Gizli labirent"
    >
      <canvas ref={canvasRef} className="secret-maze__canvas" />

      <button
        type="button"
        className="secret-maze__close"
        onClick={close}
        aria-label="Geri"
        data-cursor="hover"
      >
        ×
      </button>

      {hint && phase === "playing" && (
        <p className="secret-maze__hint">Bir çıkış yolu vardır.</p>
      )}

      {isTouch && phase === "playing" && (
        <div className="secret-maze__pad" aria-hidden="true">
          <button
            type="button"
            className="secret-maze__pad-btn secret-maze__pad-up"
            onPointerDown={(e) => {
              e.preventDefault();
              setTouch(0, -1);
            }}
            onPointerUp={() => setTouch(0, 0)}
            onPointerLeave={() => setTouch(0, 0)}
          />
          <button
            type="button"
            className="secret-maze__pad-btn secret-maze__pad-left"
            onPointerDown={(e) => {
              e.preventDefault();
              setTouch(-1, 0);
            }}
            onPointerUp={() => setTouch(0, 0)}
            onPointerLeave={() => setTouch(0, 0)}
          />
          <button
            type="button"
            className="secret-maze__pad-btn secret-maze__pad-right"
            onPointerDown={(e) => {
              e.preventDefault();
              setTouch(1, 0);
            }}
            onPointerUp={() => setTouch(0, 0)}
            onPointerLeave={() => setTouch(0, 0)}
          />
          <button
            type="button"
            className="secret-maze__pad-btn secret-maze__pad-down"
            onPointerDown={(e) => {
              e.preventDefault();
              setTouch(0, 1);
            }}
            onPointerUp={() => setTouch(0, 0)}
            onPointerLeave={() => setTouch(0, 0)}
          />
        </div>
      )}

      {phase === "found" && (
        <div className="secret-maze__modal">
          <div className="secret-maze__modal-card glass-panel">
            <h2>Çıkışı buldun.</h2>
            <p>Biraz daha ileri gitmek ister misin?</p>
            <div className="secret-maze__modal-actions">
              <a
                className="btn btn--primary"
                href={YOUTUBE_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-cursor="hover"
              >
                Git
              </a>
              <button
                type="button"
                className="btn btn--ghost"
                data-cursor="hover"
                onClick={() => {
                  foundLatch.current = false;
                  setPhase("playing");
                }}
              >
                Burada Kal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
