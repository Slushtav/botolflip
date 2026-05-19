import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCw, Play, RotateCcw } from 'lucide-react';

interface GameState {
  score: number;
  highScore: number;
  gameOver: boolean;
  gameStarted: boolean;
  lives: number;
}

const GRAVITY = 0.4;
const INITIAL_BOTTLE_Y = 0.8; // Percentage from top
const BOTTLE_WIDTH = 40;
const BOTTLE_HEIGHT = 100;
const PLATFORM_HEIGHT = 10;

export default function BottleFlipGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('flip_high_score') || '0'),
    gameOver: false,
    gameStarted: false,
    lives: 3,
  });

  const [charge, setCharge] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const chargeRef = useRef(0);
  const animationRef = useRef<number>(0);

  // Physics state
  const physicsRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    vAngle: 0,
    inAir: false,
    platformPos: { x: 0.5, y: 0.8, width: 0.2 },
    nextPlatformPos: { x: 0.8, y: 0.6, width: 0.15 },
    cameraY: 0,
    shake: 0,
    particles: [] as any[],
  });

  const resetGame = () => {
    setState(prev => ({
      ...prev,
      score: 0,
      gameOver: false,
      gameStarted: true,
      lives: 3,
    }));
    physicsRef.current = {
      x: window.innerWidth * 0.2, // Start on the left
      y: window.innerHeight * 0.8 - BOTTLE_HEIGHT,
      vx: 0,
      vy: 0,
      angle: 0,
      vAngle: 0,
      inAir: false,
      platformPos: { x: 0.2, y: 0.8, width: 120 },
      nextPlatformPos: { x: 0.6, y: 0.8, width: 100 },
      cameraY: 0,
    };
  };

  const jump = () => {
    if (physicsRef.current.inAir) return;

    const power = chargeRef.current;
    physicsRef.current.vx = 5 + power * 15;
    physicsRef.current.vy = -(10 + power * 20);
    physicsRef.current.vAngle = 0.1 + power * 0.4;
    physicsRef.current.inAir = true;
    
    setCharge(0);
    chargeRef.current = 0;
    setIsCharging(false);
  };

  const update = () => {
    const p = physicsRef.current;
    if (p.inAir) {
      p.vy += GRAVITY;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.vAngle;

      // Check collision with platforms
      const platforms = [p.platformPos, p.nextPlatformPos];
      for (const platform of platforms) {
        const platformY = window.innerHeight * platform.y;
        const platformX = window.innerWidth * platform.x;
        
        // If falling down and hit platform height
        if (p.vy > 0 && p.y + BOTTLE_HEIGHT >= platformY && p.y + BOTTLE_HEIGHT <= platformY + 20) {
          // Check horizontal bounds
          if (p.x + BOTTLE_WIDTH > platformX - platform.width / 2 && p.x < platformX + platform.width / 2) {
            
            // Check landing angle (must be mostly upright)
            const normalizedAngle = ((p.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            const isUpright = normalizedAngle < 0.4 || normalizedAngle > Math.PI * 2 - 0.4;

            if (isUpright) {
              // SUCCESSFUL LANDING
              p.y = platformY - BOTTLE_HEIGHT;
              p.vy = 0;
              p.vx = 0;
              p.angle = 0;
              p.vAngle = 0;
              p.inAir = false;
              p.shake = 5;

              // Emit particles
              for (let i = 0; i < 15; i++) {
                p.particles.push({
                  x: p.x + BOTTLE_WIDTH / 2,
                  y: p.y + BOTTLE_HEIGHT,
                  vx: (Math.random() - 0.5) * 6,
                  vy: -Math.random() * 4,
                  life: 1,
                  color: '#fff'
                });
              }

              // If it was the next platform, advance
              if (platform === p.nextPlatformPos) {
                setState(prev => {
                  const newScore = prev.score + 1;
                  const newHighScore = Math.max(newScore, prev.highScore);
                  if (newHighScore > prev.highScore) {
                    localStorage.setItem('flip_high_score', newHighScore.toString());
                  }
                  return { ...prev, score: newScore, highScore: newHighScore };
                });

                // Generate next platform
                p.platformPos = p.nextPlatformPos;
                p.nextPlatformPos = {
                  x: 0.3 + Math.random() * 0.5,
                  y: 0.4 + Math.random() * 0.4,
                  width: Math.max(60, 120 - state.score * 2)
                };
              }
            } else {
              // LANDED BUT TIPPED OVER
              onFail();
            }
          }
        }
      }

      // Check out of bounds
      if (p.y > window.innerHeight || p.x > window.innerWidth || p.x < -BOTTLE_WIDTH) {
        onFail();
      }
    }

    // Update particles
    p.particles = p.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= 0.02;
      return particle.life > 0;
    });

    // Update shake
    if (p.shake > 0) p.shake *= 0.9;

    if (isCharging) {
      chargeRef.current = Math.min(1, chargeRef.current + 0.02);
      setCharge(chargeRef.current);
    }
  };

  const onFail = () => {
    physicsRef.current.shake = 15;
    setState(prev => {
      if (prev.lives > 1) {
        // Reset to current platform
        physicsRef.current.x = window.innerWidth * physicsRef.current.platformPos.x;
        physicsRef.current.y = window.innerHeight * physicsRef.current.platformPos.y - BOTTLE_HEIGHT;
        physicsRef.current.vx = 0;
        physicsRef.current.vy = 0;
        physicsRef.current.angle = 0;
        physicsRef.current.vAngle = 0;
        physicsRef.current.inAir = false;
        return { ...prev, lives: prev.lives - 1 };
      } else {
        return { ...prev, gameOver: true, lives: 0 };
      }
    });
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const p = physicsRef.current;

    const shakeX = (Math.random() - 0.5) * p.shake;
    const shakeY = (Math.random() - 0.5) * p.shake;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Draw background
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, '#1a1c2c');
    gradient.addColorStop(1, '#4a192c');
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, ctx.canvas.width + 40, ctx.canvas.height + 40);

    // Draw particles
    p.particles.forEach(particle => {
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Draw platforms
    const drawPlatform = (platform: any, isNext: boolean) => {
      const x = window.innerWidth * platform.x;
      const y = window.innerHeight * platform.y;
      
      ctx.save();
      ctx.fillStyle = isNext ? '#ff7e5f' : '#6a11cb';
      ctx.shadowBlur = 15;
      ctx.shadowColor = ctx.fillStyle;
      
      // Draw rounded platform
      const radius = 10;
      ctx.beginPath();
      ctx.moveTo(x - platform.width / 2 + radius, y);
      ctx.lineTo(x + platform.width / 2 - radius, y);
      ctx.quadraticCurveTo(x + platform.width / 2, y, x + platform.width / 2, y + radius);
      ctx.lineTo(x + platform.width / 2, y + PLATFORM_HEIGHT);
      ctx.lineTo(x - platform.width / 2, y + PLATFORM_HEIGHT);
      ctx.lineTo(x - platform.width / 2, y + radius);
      ctx.quadraticCurveTo(x - platform.width / 2, y, x - platform.width / 2 + radius, y);
      ctx.fill();
      ctx.restore();
    };

    drawPlatform(p.platformPos, false);
    drawPlatform(p.nextPlatformPos, true);

    // Draw Bottle
    ctx.save();
    ctx.translate(p.x + BOTTLE_WIDTH / 2, p.y + BOTTLE_HEIGHT / 2);
    ctx.rotate(p.angle);
    ctx.translate(-(BOTTLE_WIDTH / 2), -(BOTTLE_HEIGHT / 2));

    // Bottle shadow/glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';

    // Bottle body
    ctx.fillStyle = 'rgba(200, 230, 255, 0.8)';
    ctx.beginPath();
    ctx.roundRect(0, 20, BOTTLE_WIDTH, BOTTLE_HEIGHT - 20, 8);
    ctx.fill();
    
    // Bottle neck
    ctx.fillStyle = 'rgba(200, 230, 255, 0.9)';
    ctx.fillRect(BOTTLE_WIDTH * 0.25, 0, BOTTLE_WIDTH * 0.5, 20);
    
    // Bottle cap
    ctx.fillStyle = '#ff3e3e';
    ctx.fillRect(BOTTLE_WIDTH * 0.2, -5, BOTTLE_WIDTH * 0.6, 10);
    
    // Liquid
    ctx.fillStyle = 'rgba(50, 150, 255, 0.6)';
    ctx.fillRect(2, BOTTLE_HEIGHT * 0.5, BOTTLE_WIDTH - 4, BOTTLE_HEIGHT * 0.45);

    ctx.restore();

    // Draw Charge UI
    ctx.restore(); // Restore from shake translate

    if (isCharging) {
      const barWidth = 200;
      const barHeight = 20;
      const bx = (ctx.canvas.width - barWidth) / 2;
      const by = 100;
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(bx, by, barWidth, barHeight);
      
      const gradient = ctx.createLinearGradient(bx, by, bx + barWidth, by);
      gradient.addColorStop(0, '#00f2fe');
      gradient.addColorStop(1, '#4facfe');
      ctx.fillStyle = gradient;
      ctx.fillRect(bx, by, barWidth * chargeRef.current, barHeight);
    }
  };

  const loop = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        update();
        draw(ctx);
      }
    }
    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      
      window.addEventListener('resize', handleResize);
      animationRef.current = requestAnimationFrame(loop);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationRef.current);
      };
    }
  }, []);

  const handleStartCharging = () => {
    if (!state.gameStarted || state.gameOver || physicsRef.current.inAir) return;
    setIsCharging(true);
    chargeRef.current = 0;
  };

  const handleStopCharging = () => {
    if (isCharging) {
      jump();
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full cursor-pointer"
        onMouseDown={handleStartCharging}
        onMouseUp={handleStopCharging}
        onTouchStart={handleStartCharging}
        onTouchEnd={handleStopCharging}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl">
          <div className="text-xs font-mono text-white/50 uppercase tracking-widest mb-1">Skor</div>
          <div className="text-4xl font-bold text-white tabular-nums">{state.score}</div>
        </div>

        <div className="flex gap-4">
          <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl text-right">
            <div className="text-xs font-mono text-white/50 uppercase tracking-widest mb-1">Terbaik</div>
            <div className="text-2xl font-bold text-amber-400 tabular-nums">{state.highScore}</div>
          </div>
          
          <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-xl text-right">
            <div className="text-xs font-mono text-white/50 uppercase tracking-widest mb-1">Nyawa</div>
            <div className="flex gap-1 mt-1">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-3 h-3 rounded-full transition-colors duration-300 ${i < state.lives ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-white/10'}`} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {!state.gameStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl"
            >
              <div className="w-20 h-20 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Play className="w-10 h-10 text-blue-400 fill-current" />
              </div>
              <h1 className="text-4xl font-black text-white mb-4 tracking-tight">MASTER FLIP<br/><span className="text-blue-400">BOTOL</span></h1>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Tahan layar untuk mengisi tenaga. Lepaskan untuk melempar botol ke platform berikutnya!
              </p>
              <button 
                onClick={resetGame}
                className="w-full py-4 px-8 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-900/20 pointer-events-auto"
              >
                MULAI TANTANGAN
              </button>
            </motion.div>
          </motion.div>
        )}

        {state.gameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-red-950/40 backdrop-blur-md z-50 p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-slate-900 border border-red-500/20 p-8 rounded-3xl shadow-2xl"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <RotateCcw className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-3xl font-black text-white mb-2">PERMAINAN BERAKHIR</h2>
              <div className="flex justify-center gap-8 my-8 pb-8 border-b border-white/5">
                <div>
                  <div className="text-xs uppercase font-mono text-white/50 mb-1">Skor Akhir</div>
                  <div className="text-4xl font-bold text-white tracking-tighter">{state.score}</div>
                </div>
                <div>
                  <div className="text-xs uppercase font-mono text-white/50 mb-1">Tertinggi</div>
                  <div className="text-4xl font-bold text-amber-400 tracking-tighter">{state.highScore}</div>
                </div>
              </div>
              <button 
                onClick={resetGame}
                className="w-full py-4 px-8 bg-red-600 hover:bg-red-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-900/20 pointer-events-auto"
              >
                COBA LAGI
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-10 left-0 w-full flex justify-center pointer-events-none">
        <div className="bg-white/5 backdrop-blur-sm px-6 py-3 rounded-full border border-white/10 text-white/40 text-sm font-medium">
          Tahan & Lepas Untuk Melempar
        </div>
      </div>
    </div>
  );
}
