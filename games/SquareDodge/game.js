const app = new PIXI.Application({
    width: 800,
    height: 600,
    backgroundColor: 0x000000,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
});
PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
document.body.appendChild(app.view);

// Style app.view for stretch (not expand)
app.view.style.width = '800px';
app.view.style.height = '600px';

// --- FULLSCREEN BUTTON ---
const fsButton = document.createElement("button");
fsButton.textContent = "Fullscreen";
fsButton.style.position = "absolute";
fsButton.style.top = "10px";
fsButton.style.right = "10px";
fsButton.style.zIndex = 1001; // above pause button
fsButton.style.padding = "8px 12px";
fsButton.style.fontSize = "16px";
document.body.appendChild(fsButton);

fsButton.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    app.view.requestFullscreen().catch(err => {
      alert(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen();
  }
});

// --- PAUSE BUTTON ---
const pauseButton = document.createElement("button");
pauseButton.textContent = "Pause";
pauseButton.style.position = "absolute";
pauseButton.style.top = "50px";
pauseButton.style.right = "10px";
pauseButton.style.zIndex = 1001; // above canvas
pauseButton.style.padding = "8px 12px";
pauseButton.style.fontSize = "16px";
document.body.appendChild(pauseButton);

let paused = false;
pauseButton.onclick = () => {
  paused = !paused;
  if (paused) {
    pauseButton.textContent = "Resume";
    app.ticker.stop();
    music.pause();
  } else {
    pauseButton.textContent = "Pause";
    app.ticker.start();
    music.play();
  }
};

// Resize handling with stretch on fullscreen change or window resize
function resizeAppView() {
  if (document.fullscreenElement) {
    app.view.style.width = window.innerWidth + "px";
    app.view.style.height = window.innerHeight + "px";
    // Resize PIXI renderer internally to native resolution to keep crispness
    app.renderer.resize(window.innerWidth, window.innerHeight);
  } else {
    app.view.style.width = '800px';
    app.view.style.height = '600px';
    app.renderer.resize(800, 600);
  }
}
window.addEventListener('resize', () => {
  if (document.fullscreenElement) {
    resizeAppView();
  }
});
document.addEventListener('fullscreenchange', () => {
  resizeAppView();
  // Keep pause button visible on fullscreen (already absolute, z-index good)
});

resizeAppView(); // initial call

// ---- Your existing game code follows ----

// PIXI loader and assets
const loader = new PIXI.Loader();

loader
  .add("player", "assets/player.png")
  .add("enemy", "assets/enemy.png")
  .add("background", "assets/background.png")
  .add("gameover", "assets/gameover.png")
  .add("restart", "assets/restart.png");

loader.load(showTitleScreen);

let player, enemies = [], score = 0, scoreText, keys = {}, gameOver = false;
let enemyTimer = 0;
let highScore = parseInt(localStorage.getItem("highScore")) || 0;
let titleContainer;
let running = false;

let health = 3;
let healthText;
let invincible = false;
let invincibleTimer = 0;
const INVINCIBLE_DURATION = 120;

// Sounds
const hitSound = new Howl({ src: ['assets/sounds/hit.wav'] });
const scoreSound = new Howl({ src: ['assets/sounds/score.wav'] });
const gameoverSound = new Howl({ src: ['assets/sounds/gameover.wav'] });
const whooshSound = new Howl({ src: ['assets/sounds/whoosh.wav'], volume: 0.2 });
const music = new Howl({ src: ['assets/sounds/music.wav'], loop: true, volume: 0.4 });

let targetX = null;
let dragging = false;

function resizeSprite(sprite, maxWidth, maxHeight) {
    const scaleX = maxWidth / sprite.width;
    const scaleY = maxHeight / sprite.height;
    const scale = Math.min(scaleX, scaleY);
    sprite.scale.set(scale);
}

function showTitleScreen() {
    gameoverSound.stop();
    music.stop();

    app.stage.removeChildren();
    enemies = [];
    keys = {};
    running = false;
    gameOver = false;
    health = 3;
    invincible = false;
    invincibleTimer = 0;
    targetX = null;

    titleContainer = new PIXI.Container();
    app.stage.addChild(titleContainer);

    const bg = new PIXI.Sprite(loader.resources["background"].texture);
    bg.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    bg.width = app.screen.width;
    bg.height = app.screen.height;
    titleContainer.addChild(bg);

    const title = new PIXI.Text("PIXEL DODGER", {
        fontFamily: "Arial", fontSize: 48, fill: 0xffffff
    });
    title.anchor.set(0.5);
    title.position.set(app.screen.width / 2, 150);
    titleContainer.addChild(title);

    const hsText = new PIXI.Text(`High Score: ${highScore}`, {
        fontFamily: "Arial", fontSize: 28, fill: 0xffff99
    });
    hsText.anchor.set(0.5);
    hsText.position.set(app.screen.width / 2, 220);
    titleContainer.addChild(hsText);

    const playButton = new PIXI.Text("▶ START", {
        fontFamily: "Arial", fontSize: 36, fill: 0x00ff00
    });
    playButton.anchor.set(0.5);
    playButton.position.set(app.screen.width / 2, 300);
    playButton.interactive = true;
    playButton.buttonMode = true;
    playButton.on("pointerdown", startGame);
    titleContainer.addChild(playButton);
}

function startGame() {
    gameoverSound.stop();
    music.stop();
    music.play();

    app.stage.removeChildren();
    enemies = [];
    score = 0;
    gameOver = false;
    keys = {};
    enemyTimer = 0;
    running = true;
    health = 3;
    invincible = false;
    invincibleTimer = 0;
    targetX = null;

    const bg = new PIXI.Sprite(loader.resources["background"].texture);
    bg.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    bg.width = app.screen.width;
    bg.height = app.screen.height;
    app.stage.addChild(bg);

    player = new PIXI.Sprite(loader.resources["player"].texture);
    player.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    resizeSprite(player, 128, 128);
    player.anchor.set(0.5);
    player.x = app.screen.width / 2;
    player.y = app.screen.height - 110;
    app.stage.addChild(player);

    scoreText = new PIXI.Text("Score: 0", {
        fontFamily: "Arial", fontSize: 24, fill: 0xffffff
    });
    scoreText.position.set(10, 10);
    app.stage.addChild(scoreText);

    healthText = new PIXI.Text(`Health: ${health}`, {
        fontFamily: "Arial", fontSize: 24, fill: 0xff4444
    });
    healthText.position.set(app.screen.width - 120, 10);
    app.stage.addChild(healthText);

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    // Click/touch movement start
    app.view.addEventListener("pointerdown", e => {
        const rect = app.view.getBoundingClientRect();
        targetX = (e.clientX - rect.left) * (app.screen.width / rect.width);
        dragging = true;
    });
    app.view.addEventListener("pointermove", e => {
        if (!dragging) return;
        const rect = app.view.getBoundingClientRect();
        targetX = (e.clientX - rect.left) * (app.screen.width / rect.width);
    });
    app.view.addEventListener("pointerup", () => {
        dragging = false;
    });
    app.view.addEventListener("pointerleave", () => {
        dragging = false;
    });
}

app.ticker.add(gameLoop);

function keyDown(e) {
    keys[e.code] = true;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault();
    }
}

function keyUp(e) {
    keys[e.code] = false;
}

function gameLoop(delta) {
    if (!running || gameOver || paused) return;

    const speed = 6;
    if (keys["ArrowLeft"] || keys["KeyA"]) player.x -= speed;
    if (keys["ArrowRight"] || keys["KeyD"]) player.x += speed;

    if (targetX !== null) {
        if (Math.abs(player.x - targetX) < speed) {
            player.x = targetX;
            targetX = null;
        } else {
            player.x += (player.x < targetX ? speed : -speed);
        }
    }

    const halfW = player.width / 2;
    player.x = Math.max(halfW, Math.min(app.screen.width - halfW, player.x));

    if (invincible) {
        invincibleTimer -= delta;
        player.alpha = player.alpha === 1 ? 0.5 : 1;
        if (invincibleTimer <= 0) {
            invincible = false;
            player.alpha = 1;
        }
    }

    const spawnInterval = Math.max(20, 60 - Math.floor(score / 5));
    const fallSpeed = 5 + Math.floor(score / 10);

    enemyTimer += delta;
    if (enemyTimer > spawnInterval) {
        spawnEnemy(score);
        enemyTimer = 0;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.y += fallSpeed;

        if (!invincible && hitTest(e, player)) {
            health--;
            updateHealthDisplay();
            hitSound.play();

            if (health <= 0) {
                endGame();
                return;
            } else {
                invincible = true;
                invincibleTimer = INVINCIBLE_DURATION;
            }

            enemies.splice(i, 1);
            app.stage.removeChild(e);
            continue;
        }

        if (e.y > app.screen.height + 50) {
            enemies.splice(i, 1);
            app.stage.removeChild(e);
            score++;
            scoreText.text = "Score: " + score;

            if (score % 20 === 0) {
                scoreSound.play();
            } else {
                whooshSound.rate(Math.random() * 0.5 + 0.75);
                whooshSound.volume(Math.random() * 0.3 + 0.1);
                whooshSound.play();
            }
        }
    }
}

function spawnEnemy(score) {
    const count = 1 + Math.floor(score / 25);
    for (let i = 0; i < count; i++) {
        const enemy = new PIXI.Sprite(loader.resources["enemy"].texture);
        enemy.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        resizeSprite(enemy, 64, 64);
        enemy.x = Math.random() * (app.screen.width - enemy.width);
        enemy.y = -enemy.height - i * 80;
        enemies.push(enemy);
        app.stage.addChild(enemy);
    }
}

function hitTest(a, b) {
    const ab = a.getBounds();
    const bb = b.getBounds();
    return ab.x + ab.width > bb.x &&
           ab.x < bb.x + bb.width &&
           ab.y + ab.height > bb.y &&
           ab.y < bb.y + bb.height;
}

function updateHealthDisplay() {
    healthText.text = `Health: ${health}`;
}

function endGame() {
    gameOver = true;
    running = false;
    window.removeEventListener("keydown", keyDown);
    window.removeEventListener("keyup", keyUp);

    if (score > highScore) {
        highScore = score;
        localStorage.setItem("highScore", highScore);
    }

    gameoverSound.play();
    music.stop();

    const go = new PIXI.Sprite(loader.resources["gameover"].texture);
    resizeSprite(go, 256, 256);
    go.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    go.anchor.set(0.5);
    go.x = app.screen.width / 2;
    go.y = app.screen.height / 2 - 100;
    app.stage.addChild(go);

    const restart = new PIXI.Sprite(loader.resources["restart"].texture);
    resizeSprite(restart, 256, 256);
    restart.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    restart.anchor.set(0.5);
    restart.x = app.screen.width / 2;
    restart.y = app.screen.height / 2 + 40;
    restart.interactive = true;
    restart.buttonMode = true;
    restart.on('pointerdown', () => {
        showTitleScreen();
    });
    app.stage.addChild(restart);
}
