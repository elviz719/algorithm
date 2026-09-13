/**
 * ui.js — экраны меню, энциклопедия бронетехники и выбор машины для боя.
 */

(function () {
  "use strict";

  const screens = {
    main: document.getElementById("main-menu"),
    select: document.getElementById("select-screen"),
    encyclopedia: document.getElementById("encyclopedia-screen"),
    gameover: document.getElementById("gameover-screen"),
  };

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.add("hidden"));
    document.getElementById("hud").classList.add("hidden");
    if (screens[name]) screens[name].classList.remove("hidden");
  }

  function classIcon(cls) {
    if (cls.includes("Лёгкий")) return "🔹";
    if (cls.includes("Средний")) return "🔶";
    if (cls.includes("Тяжёлый")) return "🔴";
    if (cls.includes("САУ")) return "💥";
    if (cls.includes("бронеавтомобиль") || cls.includes("Бронеавтомобиль")) return "🚙";
    if (cls.includes("Плавающий")) return "🌊";
    return "🎖️";
  }

  function renderEncyclopedia() {
    const list = document.getElementById("encyclopedia-list");
    list.innerHTML = "";
    VEHICLE_DATABASE.forEach((v) => {
      const card = document.createElement("div");
      card.className = "vehicle-card";
      card.innerHTML = `
        <div class="vehicle-card-head" style="border-color:${v.color}">
          <span class="vehicle-icon">${classIcon(v.class)}</span>
          <div>
            <h3>${v.name}</h3>
            <span class="vehicle-class">${v.class} · ${v.years}</span>
          </div>
          ${v.playable ? '<span class="playable-badge">В игре</span>' : ""}
        </div>
        <p class="vehicle-desc">${v.desc}</p>
        <div class="vehicle-specs">
          <div><b>Масса:</b> ${v.weight}</div>
          <div><b>Броня:</b> ${v.armor}</div>
          <div><b>Вооружение:</b> ${v.gun}</div>
          <div><b>Скорость:</b> ${v.speed}</div>
          <div><b>Экипаж:</b> ${v.crew} чел.</div>
          <div><b>Выпущено:</b> ${v.built}</div>
        </div>
      `;
      list.appendChild(card);
    });
    document.getElementById("encyclopedia-count").textContent = VEHICLE_DATABASE.length;
  }

  function renderSelect() {
    const list = document.getElementById("select-list");
    list.innerHTML = "";
    PLAYABLE_VEHICLES.forEach((v) => {
      const card = document.createElement("button");
      card.className = "select-card";
      card.style.borderColor = v.color;
      card.innerHTML = `
        <span class="vehicle-icon">${classIcon(v.class)}</span>
        <h3>${v.name}</h3>
        <span class="vehicle-class">${v.class}</span>
        <div class="mini-stats">
          <span title="Прочность">❤ ${v.stats.hp}</span>
          <span title="Урон">⚔ ${v.stats.damage}</span>
          <span title="Скорость">🚀 ${v.stats.speed.toFixed(1)}</span>
        </div>
      `;
      card.addEventListener("click", () => {
        showScreen("none");
        window.ArmyGame.startGame(v);
      });
      list.appendChild(card);
    });
  }

  document.getElementById("btn-play").addEventListener("click", () => {
    renderSelect();
    showScreen("select");
  });
  document.getElementById("btn-encyclopedia").addEventListener("click", () => {
    renderEncyclopedia();
    showScreen("encyclopedia");
  });
  document.getElementById("btn-back-1").addEventListener("click", () => showScreen("main"));
  document.getElementById("btn-back-2").addEventListener("click", () => showScreen("main"));
  document.getElementById("btn-restart").addEventListener("click", () => {
    renderSelect();
    showScreen("select");
  });
  document.getElementById("btn-menu").addEventListener("click", () => showScreen("main"));

  showScreen("main");
})();
