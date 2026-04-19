/**
 * ╔══════════════════════════════════════════════╗
 * ║   PAIA — CyberBackground (GOD-TIER v4)      ║
 * ║   Canvas: hex grid + network nodes +         ║
 * ║   matrix rain + cyan scanline                ║
 * ║   Pure canvas API, zero dependencies         ║
 * ╚══════════════════════════════════════════════╝
 */

import { useEffect, useRef } from 'react';

const CyberBackground = () => {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    var canvas = canvasRef.current;
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = window.innerWidth;
    var H = window.innerHeight;
    canvas.width  = W;
    canvas.height = H;

    /* ── MATRIX RAIN ───────────────────────────── */
    var COL_W  = 18;
    var COLS   = Math.floor(W / COL_W) + 1;
    var drops  = [];
    var speeds = [];
    var i;
    for (i = 0; i < COLS; i++) {
      drops[i]  = Math.random() * -100;
      speeds[i] = 0.3 + Math.random() * 0.7;
    }
    var CHARS = '01アイウエオカキクケコサシスセソタチツテト∑∏Ω≡≠∞';

    /* ── NETWORK NODES ─────────────────────────── */
    var NODE_COUNT = 28;
    var nodes = [];
    for (i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x:     Math.random() * W,
        y:     Math.random() * H,
        vx:    (Math.random() - 0.5) * 0.3,
        vy:    (Math.random() - 0.5) * 0.3,
        r:     Math.random() * 1.8 + 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }
    var LINK_DIST = 220;

    /* ── HEX GRID ──────────────────────────────── */
    var HEX_R = 44;
    var hexPath = function(cx, cy, r) {
      ctx.beginPath();
      var a, px, py;
      for (var s = 0; s < 6; s++) {
        a = (Math.PI / 3) * s - Math.PI / 6;
        px = cx + r * Math.cos(a);
        py = cy + r * Math.sin(a);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    /* ── SCANLINE STATE ────────────────────────── */
    var scanPhase = 0;
    var SCAN_SPEED = 0.5; // px per frame — full sweep ~8s at 60fps

    var frame = 0;

    /* ═══════════════════════════════════════════
       MAIN DRAW LOOP
       ═══════════════════════════════════════════ */
    var draw = function() {
      frame++;

      // Fade trail — creates ghosting effect
      ctx.fillStyle = 'rgba(5, 5, 9, 0.16)';
      ctx.fillRect(0, 0, W, H);

      /* ── Layer A: Hex grid (every 4th frame) ── */
      if (frame % 4 === 0) {
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.04)';
        ctx.lineWidth = 0.5;
        var rowH = HEX_R * Math.sqrt(3);
        var colW = HEX_R * 1.5;
        var row, col, cx, cy;
        for (row = -1; row < H / rowH + 2; row++) {
          for (col = -1; col < W / colW + 2; col++) {
            cx = col * colW;
            cy = row * rowH + ((col % 2 === 0) ? 0 : rowH * 0.5);
            hexPath(cx, cy, HEX_R - 2);
            ctx.stroke();
          }
        }
      }

      /* ── Layer B: Network nodes + edges ──────── */
      var n, m, j, dx, dy, dist, alpha, pulseR;
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.phase += 0.035;

        // Bounce off edges
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;

        // Draw edges to nearby nodes
        for (j = i + 1; j < nodes.length; j++) {
          m = nodes[j];
          dx = n.x - m.x;
          dy = n.y - m.y;
          dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            alpha = (1 - dist / LINK_DIST) * 0.18;
            ctx.strokeStyle = 'rgba(99, 102, 241, ' + alpha + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }

        // Draw node dot with sin-wave pulse
        pulseR = n.r + Math.sin(n.phase) * 0.7;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99, 102, 241, ' + (0.35 + Math.sin(n.phase) * 0.15) + ')';
        ctx.fill();
      }

      /* ── Layer C: Matrix rain ────────────────── */
      ctx.font = (COL_W - 4) + 'px "JetBrains Mono", monospace';
      var ch, yPos;
      for (i = 0; i < COLS; i++) {
        yPos = drops[i] * COL_W;

        if (yPos > 0 && yPos < H) {
          // Bright head character
          ch = CHARS[Math.floor(Math.random() * CHARS.length)];
          ctx.fillStyle = 'rgba(129, 140, 248, 0.9)';
          ctx.fillText(ch, i * COL_W, yPos);

          // Fading trail — 1 char behind
          if (yPos > COL_W) {
            ctx.fillStyle = 'rgba(79, 70, 229, 0.30)';
            ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, yPos - COL_W);
          }
          // Even fainter trail — 2 chars behind
          if (yPos > COL_W * 2) {
            ctx.fillStyle = 'rgba(79, 70, 229, 0.12)';
            ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], i * COL_W, yPos - COL_W * 2);
          }
        }

        drops[i] += speeds[i];

        // Random reset when past bottom
        if (drops[i] * COL_W > H && Math.random() > 0.975) {
          drops[i] = -Math.floor(Math.random() * 40);
        }
      }

      /* ── Cyan scanline sweep (top→bottom ~8s) ── */
      scanPhase += SCAN_SPEED;
      if (scanPhase > H + 40) scanPhase = -40;

      var scanGrad = ctx.createLinearGradient(0, scanPhase - 12, 0, scanPhase + 12);
      scanGrad.addColorStop(0,   'rgba(6, 182, 212, 0)');
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.04)');
      scanGrad.addColorStop(1,   'rgba(6, 182, 212, 0)');
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanPhase - 12, W, 24);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    /* ── Resize handler ────────────────────────── */
    var onResize = function() {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;

      // Recalculate matrix columns
      COLS = Math.floor(W / COL_W) + 1;
      drops = [];
      speeds = [];
      for (var ri = 0; ri < COLS; ri++) {
        drops[ri]  = Math.random() * -80;
        speeds[ri] = 0.3 + Math.random() * 0.7;
      }

      // Redistribute nodes
      for (var ni = 0; ni < nodes.length; ni++) {
        nodes[ni].x = Math.random() * W;
        nodes[ni].y = Math.random() * H;
      }
    };
    window.addEventListener('resize', onResize);

    /* ── Cleanup ───────────────────────────────── */
    return function() {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         '100%',
        height:        '100%',
        zIndex:        0,
        pointerEvents: 'none',
        opacity:       0.5,
      }}
    />
  );
};

export default CyberBackground;
