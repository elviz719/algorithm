/**
 * game.js — аркадный движок игры «Танковая Армия СССР».
 *
 * Режим боя: танк игрока сверху ("top-down"), волны немецкой бронетехники
 * атакуют с краёв карты. Игрок уничтожает врагов, зарабатывает очки и
 * переходит на следующую, более сложную волну.
 */

(function () {
  "use strict";

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");

  const WORLD = { width: canvas.width, height: canvas.height };

  // Немецкая техника-противник (условные игровые характеристики)
  const ENEMY_TYPES = [
    { name: "Pz.Kpfw. II", hp: 30, speed: 1.6, damage: 8, fireRate: 1400, color: "#6e3b3b", score: 10 },
    { name: "Pz.Kpfw. III", hp: 55, speed: 1.9, damage: 12, fireRate: 1200, color: "#6e3b3b", score: 15 },
    { name: "Pz.Kpfw. IV", hp: 80, speed: 1.8, damage: 16, fireRate: 1100, color: "#6e3b3b", score: 20 },
    { name: "Pz.Kpfw. V «Пантера»", hp: 130, speed: 1.7, damage: 22, fireRate: 1300, color: "#4a2f2f", score: 35 },
    { name: "Pz.Kpfw. VI «Тигр»", hp: 190, speed: 1.3, damage: 30, fireRate: 1600, color: "#3a2323", score: 55 },
  ];

  let state = null; // текущее состояние игрового раунда

  function keyState() {
    return {
      up: false,
      down: false,
      left: false,
      right: false,
    };
  }

  const keys = keyState();
  window.addEventListener("keydown", (e) => {
    if (["ArrowUp", "w", "W", "ц", "Ц"].includes(e.key)) keys.up = true;
    if (["ArrowDown", "s", "S", "ы", "Ы"].includes(e.key)) keys.down = true;
    if (["ArrowLeft", "a", "A", "ф", "Ф"].includes(e.key)) keys.left = true;
    if (["ArrowRight", "d", "D", "в", "В"].includes(e.key)) keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (["ArrowUp", "w", "W", "ц", "Ц"].includes(e.key)) keys.up = false;
    if (["ArrowDown", "s", "S", "ы", "Ы"].includes(e.key)) keys.down = false;
    if (["ArrowLeft", "a", "A", "ф", "Ф"].includes(e.key)) keys.left = false;
    if (["ArrowRight", "d", "D", "в", "В"].includes(e.key)) keys.right = false;
  });

  const mouse = { x: WORLD.width / 2, y: WORLD.height / 2, down: false };
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener("mousedown", () => (mouse.down = true));
  canvas.addEventListener("mouseup", () => (mouse.down = false));

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function spawnEnemy(wave) {
    const pool = ENEMY_TYPES.slice(0, Math.min(ENEMY_TYPES.length, 2 + Math.floor(wave / 2)));
    const type = pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = -30; y = Math.random() * WORLD.height; }
    else if (edge === 1) { x = WORLD.width + 30; y = Math.random() * WORLD.height; }
    else if (edge === 2) { x = Math.random() * WORLD.width; y = -30; }
    else { x = Math.random() * WORLD.width; y = WORLD.height + 30; }

    const scale = 1 + wave * 0.08;
    return {
      x, y,
      angle: 0,
      hp: Math.round(type.hp * scale),
      maxHp: Math.round(type.hp * scale),
      speed: type.speed,
      damage: type.damage,
      fireRate: type.fireRate,
      lastShot: 0,
      color: type.color,
      name: type.name,
      score: type.score,
      radius: 16,
    };
  }

  function startGame(vehicle) {
    state = {
      vehicle,
      player: {
        x: WORLD.width / 2,
        y: WORLD.height / 2,
        angle: 0,
        hp: vehicle.stats.hp,
        maxHp: vehicle.stats.hp,
        lastShot: 0,
        radius: 18,
      },
      bullets: [],
      enemyBullets: [],
      enemies: [],
      wave: 1,
      score: 0,
      enemiesToSpawn: 5,
      spawnTimer: 0,
      waveBreak: 0,
      running: true,
      gameOver: false,
      lastTime: performance.now(),
    };
    document.getElementById("hud").classList.remove("hidden");
    requestAnimationFrame(loop);
  }

  function fireBullet(from, angle, owner, dmg) {
    const speed = 7;
    (owner === "player" ? state.bullets : state.enemyBullets).push({
      x: from.x, y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: dmg,
      owner,
      radius: 4,
    });
  }

  function update(dt) {
    if (!state || !state.running) return;
    const p = state.player;
    const v = state.vehicle;

    // движение игрока
    let dx = 0, dy = 0;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;
    const len = Math.hypot(dx, dy) || 1;
    const spd = v.stats.speed * 40;
    p.x = clamp(p.x + (dx / len) * spd * dt, p.radius, WORLD.width - p.radius);
    p.y = clamp(p.y + (dy / len) * spd * dt, p.radius, WORLD.height - p.radius);
    p.angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

    // стрельба игрока
    const now = performance.now();
    if (mouse.down && now - p.lastShot > v.stats.fireRate) {
      fireBullet(p, p.angle, "player", v.stats.damage);
      p.lastShot = now;
    }

    // спавн волны
    if (state.enemies.length === 0 && state.enemiesToSpawn === 0) {
      state.waveBreak += dt;
      if (state.waveBreak > 2) {
        state.wave += 1;
        state.enemiesToSpawn = 4 + state.wave * 2;
        state.waveBreak = 0;
      }
    } else if (state.enemiesToSpawn > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.enemies.push(spawnEnemy(state.wave));
        state.enemiesToSpawn -= 1;
        state.spawnTimer = 0.7;
      }
    }

    // враги
    for (const e of state.enemies) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const d = dist(e, p);
      if (d > 160) {
        e.x += Math.cos(a) * e.speed * 40 * dt;
        e.y += Math.sin(a) * e.speed * 40 * dt;
      }
      e.angle = a;
      if (d < 420 && now - e.lastShot > e.fireRate) {
        fireBullet(e, a, "enemy", e.damage);
        e.lastShot = now;
      }
    }

    // пули игрока
    state.bullets = state.bullets.filter((b) => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) return false;
      for (const e of state.enemies) {
        if (dist(b, e) < e.radius + b.radius) {
          e.hp -= b.damage;
          b._hit = true;
          break;
        }
      }
      return !b._hit;
    });

    // уничтоженные враги
    state.enemies = state.enemies.filter((e) => {
      if (e.hp <= 0) {
        state.score += e.score;
        return false;
      }
      return true;
    });

    // пули врагов
    state.enemyBullets = state.enemyBullets.filter((b) => {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) return false;
      if (dist(b, p) < p.radius + b.radius) {
        p.hp -= b.damage;
        return false;
      }
      return true;
    });

    // столкновения врагов с игроком
    for (const e of state.enemies) {
      if (dist(e, p) < e.radius + p.radius) {
        p.hp -= e.damage * dt * 0.5;
      }
    }

    if (p.hp <= 0) {
      p.hp = 0;
      state.running = false;
      state.gameOver = true;
      showGameOver();
    }

    updateHud();
  }

  function drawTankShape(x, y, angle, radius, color, hpFrac) {
    ctx.save();
    ctx.translate(x, y);
    // корпус
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-radius, -radius * 0.7, radius * 2, radius * 1.4, 4);
    ctx.fill();
    ctx.stroke();
    // ствол
    ctx.fillRect(0, -3, radius * 1.6, 6);
    // башня
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // полоска здоровья
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - radius, y - radius - 12, radius * 2, 5);
    ctx.fillStyle = hpFrac > 0.5 ? "#4caf50" : hpFrac > 0.25 ? "#ffb300" : "#e53935";
    ctx.fillRect(x - radius, y - radius - 12, radius * 2 * clamp(hpFrac, 0, 1), 5);
  }

  function render() {
    ctx.fillStyle = "#3a4a2f";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);

    // лёгкая текстура поля
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (let i = 0; i < WORLD.width; i += 40) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, WORLD.height); ctx.stroke();
    }
    for (let j = 0; j < WORLD.height; j += 40) {
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(WORLD.width, j); ctx.stroke();
    }

    if (!state) return;

    // пули
    ctx.fillStyle = "#ffd54f";
    for (const b of state.bullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ff5252";
    for (const b of state.enemyBullets) {
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    }

    // враги
    for (const e of state.enemies) {
      drawTankShape(e.x, e.y, e.angle, e.radius, e.color, e.hp / e.maxHp);
    }

    // игрок
    const p = state.player;
    drawTankShape(p.x, p.y, p.angle, p.radius, state.vehicle.color, p.hp / p.maxHp);
  }

  function updateHud() {
    document.getElementById("hud-vehicle").textContent = state.vehicle.name;
    document.getElementById("hud-hp").textContent = Math.max(0, Math.round(state.player.hp)) + " / " + state.player.maxHp;
    document.getElementById("hud-score").textContent = state.score;
    document.getElementById("hud-wave").textContent = state.wave;
  }

  function showGameOver() {
    document.getElementById("final-score").textContent = state.score;
    document.getElementById("final-wave").textContent = state.wave;
    document.getElementById("gameover-screen").classList.remove("hidden");
  }

  function loop(t) {
    if (!state) return;
    const dt = Math.min(0.05, (t - state.lastTime) / 1000);
    state.lastTime = t;
    if (state.running) {
      update(dt);
    }
    render();
    if (state.running) {
      requestAnimationFrame(loop);
    }
  }

  window.ArmyGame = { startGame };
})();
