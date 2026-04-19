/**
 * PAIA — CyberBackground
 * Canvas-based animated background: matrix rain + network nodes + scanlines
 * Drop this into layout.jsx as the first child
 */

import { useEffect, useRef } from 'react';

const CyberBackground = () => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    // ── MATRIX RAIN ─────────────────────────────────
    const COL_W   = 18;
    const COLS    = Math.floor(W / COL_W);
    const drops   = Array.from({ length: COLS }, () => Math.random() * -80);
    const chars   = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ∑∏Ω≡≠∞';

    // ── NETWORK NODES ───────────────────────────────
    const NODE_COUNT = 28;
    const nodes = Array.from({ length: NODE_COUNT }, () => ({
      x:    Math.random() * W,
      y:    Math.random() * H,
      vx:   (Math.random() - 0.5) * 0.28,
      vy:   (Math.random() - 0.5) * 0.28,
      r:    Math.random() * 2 + 1,
      pulse: Math.random() * Math.PI * 2,
    }));
    const LINK_DIST = 220;

    // ── HEX GRID ────────────────────────────────────
    const HEX_SIZE = 44;
    const hexPoints = (cx, cy, s) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([cx + s * Math.cos(a), cy + s * Math.sin(a)]);
      }
      return pts;
    };

    let frame = 0;

    const draw = () => {
      frame++;

      // Fade trail
      ctx.fillStyle = 'rgba(5, 5, 9, 0.18)';
      ctx.fillRect(0, 0, W, H);

      // ── Draw hex grid (very subtle) ───────────────
      if (frame % 4 === 0) {
        const rowH = HEX_SIZE * Math.sqrt(3);
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.04)';
        ctx.lineWidth = 0.5;
        for (let row = -1; row < H / rowH + 2; row++) {
          for (let col = -1; col < W / (HEX_SIZE * 1.5) + 2; col++) {
            const cx = col * HEX_SIZE * 1.5;
            const cy = row * rowH + (col % 2 === 0 ? 0 : rowH / 2);
            const pts = hexPoints(cx, cy, HEX_SIZE - 2);
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (let i = 1; i < 6; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      // ── Draw network nodes & edges ────────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx; n.y += n.vy;
        n.pulse += 0.04;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;

        // edges
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x, dy = n.y - m.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.18;
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        // node dot
        const pulseR = n.r + Math.sin(n.pulse) * 0.8;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${0.35 + Math.sin(n.pulse) * 0.15})`;
        ctx.fill();
      }

      // ── Matrix rain ───────────────────────────────
      ctx.font = `${COL_W - 4}px "JetBrains Mono", monospace`;
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const y    = drops[i] * COL_W;
        const head = y > 0 && y < H;

        if (head) {
          // bright head
          ctx.fillStyle = 'rgba(129, 140, 248, 0.9)';
          ctx.fillText(char, i * COL_W, y);
          // trail char one behind
          if (y > COL_W) {
            ctx.fillStyle = 'rgba(79, 70, 229, 0.35)';
            ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * COL_W, y - COL_W);
          }
        }

        drops[i]++;
        if (drops[i] * COL_W > H && Math.random() > 0.975) {
          drops[i] = -Math.floor(Math.random() * 30);
        }
      }

      // ── Horizontal scanline sweep ──────────────────
      const scanY = ((frame * 0.4) % (H + 40)) - 20;
      const scanGrad = ctx.createLinearGradient(0, scanY - 12, 0, scanY + 12);
      scanGrad.addColorStop(0,   'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.05)');
      scanGrad.addColorStop(1,   'rgba(6, 182, 212, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 12, W, 24);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
      nodes.forEach(n => {
        n.x = Math.random() * W;
        n.y = Math.random() * H;
      });
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     0,
        pointerEvents: 'none',
        opacity:    0.55,
      }}
    />
  );
};

export default CyberBackground;
