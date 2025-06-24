// PixiJS v6 Dinotag Core Game Code

const app = new PIXI.Application({
    resizeTo: window,
    backgroundColor: 0x222222,
});
document.body.appendChild(app.view);

// --- FULLSCREEN BUTTON ---
const fsButton = document.createElement("button");
fsButton.textContent = "Fullscreen";
fsButton.style.position = "absolute";
fsButton.style.top = "10px";
fsButton.style.right = "10px";
fsButton.style.zIndex = 1000;
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

// === Load assets ===
const loader = PIXI.Loader.shared;
loader
  .add('raptorSheet', 'assets/raptor.png')
  .add('tileset', 'assets/tileset.png')
  .load(showTitleScreen);

const playerConfig = [
  { keys: { left: 'a', chomp: 's', right: 'd', jump: 'w' }, color: 0xff0000 },
  { keys: { left: 'f', chomp: 'g', right: 'h', jump: 't' }, color: 0x00ff00 },
  { keys: { left: 'j', chomp: 'k', right: 'l', jump: 'i' }, color: 0xffff00 },
  { keys: { left: 'arrowleft', chomp: 'arrowdown', right: 'arrowright', jump: 'arrowup' }, color: 0x0000ff },
];

const players = [];
let itPlayerIndex = 0;
const gravity = 0.5;
let groundY;
let solidTiles = [];

const keysPressed = {};
const keysJustPressed = {};

function showTitleScreen() {
  let selectedPlayers = 2;
  app.stage.removeChildren();
  const titleContainer = new PIXI.Container();
  app.stage.addChild(titleContainer);

  const title = new PIXI.Text("DINOTAG", {
    fontFamily: "Arial",
    fontSize: 48,
    fill: 0xffffff
  });
  title.anchor.set(0.5);
  title.position.set(app.screen.width / 2, app.screen.height / 2 - 100);
  titleContainer.addChild(title);

  const playerSelectText = new PIXI.Text("Select Players:", {
    fontFamily: "Arial",
    fontSize: 24,
    fill: 0xffffff
  });
  playerSelectText.anchor.set(0.5);
  playerSelectText.position.set(app.screen.width / 2, app.screen.height / 2 - 40);
  titleContainer.addChild(playerSelectText);

  for (let i = 2; i <= 4; i++) {
    const option = new PIXI.Text(i.toString(), {
      fontFamily: "Arial",
      fontSize: 24,
      fill: 0xffff00
    });
    option.anchor.set(0.5);
    option.position.set(app.screen.width / 2 + (i - 3) * 40, app.screen.height / 2);
    option.interactive = true;
    option.buttonMode = true;
    option.on('pointerdown', () => selectedPlayers = i);
    titleContainer.addChild(option);
  }
  const playButton = new PIXI.Text("▶ START", {
    fontFamily: "Arial",
    fontSize: 36,
    fill: 0x00ff00
  });
  playButton.anchor.set(0.5);
  playButton.position.set(app.screen.width / 2, app.screen.height / 2 + 60);
  playButton.interactive = true;
  playButton.buttonMode = true;
  playButton.on("pointerdown", () => setup(selectedPlayers));
  titleContainer.addChild(playButton);
}

function setup(selectedPlayers = 2) {
  app.stage.removeChildren();
  groundY = app.screen.height - 100;
  let roundTime = 30 * 60;
  let roundEnded = false;

  solidTiles = [];
  const tileBase = loader.resources['tileset'].texture.baseTexture;
  const groundTexture = new PIXI.Texture(tileBase, new PIXI.Rectangle(0, 0, 32, 32));
  const platformTexture = new PIXI.Texture(tileBase, new PIXI.Rectangle(32, 0, 32, 32));

  const tileWidth = 32;

  for (let i = 0; i < app.screen.width / tileWidth; i++) {
    const tile = new PIXI.Sprite(groundTexture);
    tile.x = i * tileWidth;
    tile.y = groundY + 32;
    tile.scale.set(1);
    app.stage.addChild(tile);
    solidTiles.push(tile);
  }

  const layout = [
    { x: 100, y: groundY - 100, w: 5 },
    { x: 400, y: groundY - 150, w: 4 },
    { x: 200, y: groundY - 200, w: 3 },
    { x: 600, y: groundY - 100, w: 6 },
    { x: 150, y: groundY - 250, w: 4 }
  ];

  layout.forEach(p => {
    for (let i = 0; i < p.w; i++) {
      const tile = new PIXI.Sprite(platformTexture);
      tile.x = p.x + i * tileWidth;
      tile.y = p.y;
      tile.scale.set(1);
      app.stage.addChild(tile);
      solidTiles.push(tile);
    }
  });

  const dinoBase = loader.resources['raptorSheet'].texture.baseTexture;
  const idleFrames = [0, 1, 2].map(i => new PIXI.Texture(dinoBase, new PIXI.Rectangle(i * 32, 0, 32, 32)));
  const walkFrames = [3, 4, 5].map(i => new PIXI.Texture(dinoBase, new PIXI.Rectangle(i * 32, 0, 32, 32)));
  const eatFrames  = [6, 7].map(i => new PIXI.Texture(dinoBase, new PIXI.Rectangle(i * 32, 0, 32, 32)));

  players.length = 0;
  for (let i = 0; i < selectedPlayers; i++) {
    const sprite = new PIXI.AnimatedSprite(idleFrames);
    sprite.animationSpeed = 0.15;
    sprite.play();

    sprite.anchor.set(0.5);
    sprite.scale.set(2);
    sprite.tint = playerConfig[i].color;
    sprite.x = 100 + i * 150;
    sprite.y = groundY;
    app.stage.addChild(sprite);

    players.push({
      sprite,
      keys: playerConfig[i].keys,
      vx: 0,
      vy: 0,
      onGround: true,
      isIt: i === itPlayerIndex,
      cooldown: 0,
      idleFrames,
      walkFrames,
      eatFrames,
      lastX: sprite.x,
      lastY: sprite.y
    });
  }

  const timerText = new PIXI.Text("", {
    fontFamily: "Arial",
    fontSize: 24,
    fill: 0xffffff
  });
  timerText.position.set(app.screen.width - 120, 10);
  app.stage.addChild(timerText);

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if (!keysPressed[key]) keysJustPressed[key] = true;
    keysPressed[key] = true;
  });

  window.addEventListener('keyup', e => {
    const key = e.key.toLowerCase();
    keysPressed[key] = false;
  });

  app.ticker.add(() => {
    gameLoop();
    for (let key in keysJustPressed) delete keysJustPressed[key];
    if (!roundEnded) {
      roundTime--;
      timerText.text = `Time: ${Math.ceil(roundTime / 60)}`;
      if (roundTime <= 0) {
        roundEnded = true;
        showWinner();
      }
    }
  });
}

function gameLoop() {
  players.forEach((player, i) => {
    const keys = player.keys;
    player.vx = 0;
    let isWalking = false;

    player.lastX = player.sprite.x;
    player.lastY = player.sprite.y;

    if (keysPressed[keys.left]) {
      player.vx = -3;
      player.sprite.scale.x = -2;
      isWalking = true;
    }
    if (keysPressed[keys.right]) {
      player.vx = 3;
      player.sprite.scale.x = 2;
      isWalking = true;
    }
    if (keysJustPressed[keys.jump] && player.onGround) {
      player.vy = -14;
      player.onGround = false;
    }

    player.vy += gravity;
    player.sprite.y += player.vy;
    player.sprite.x += player.vx;

    let collided = false;
    player.onGround = false;
    for (const tile of solidTiles) {
      const px = player.sprite.x;
      const py = player.sprite.y;
      const tx = tile.x;
      const ty = tile.y;
      const tw = tile.width;
      const th = tile.height;

      const overlapX = Math.min(px + 16 - tx, tx + tw - (px - 16));
      const overlapY = Math.min(py + 16 - ty, ty + th - (py - 16));

      const isColliding = px + 16 > tx && px - 16 < tx + tw && py + 16 > ty && py - 16 < ty + th;

      if (isColliding) {
        collided = true;
        if (overlapY < overlapX) {
          if (player.vy > 0) {
            player.sprite.y = ty - 16;
            player.vy = 0;
            player.onGround = true;
          } else if (player.vy < 0) {
            player.sprite.y = ty + th + 16;
            player.vy = 0;
          }
        } else {
          if (player.vx > 0) {
            player.sprite.x = tx - 16;
          } else if (player.vx < 0) {
            player.sprite.x = tx + tw + 16;
          }
        }
      }
    }

    if (!collided && Math.abs(player.sprite.x - player.lastX) > 8) {
      player.sprite.x = player.lastX;
    }

    if (player.sprite.y > app.screen.height + 100) {
      player.sprite.x = 100 + i * 150;
      player.sprite.y = groundY - 200;
      player.vx = 0;
      player.vy = 0;
    }

    const tex = player.sprite.textures;
    if (keysPressed[keys.chomp] && player.cooldown <= 0) {
      if (tex !== player.eatFrames) {
        player.sprite.textures = player.eatFrames;
        player.sprite.play();
      }
    } else if (isWalking) {
      if (tex !== player.walkFrames) {
        player.sprite.textures = player.walkFrames;
        player.sprite.play();
      }
    } else {
      if (tex !== player.idleFrames) {
        player.sprite.textures = player.idleFrames;
        player.sprite.play();
      }
    }

    if (player.isIt && player.cooldown <= 0 && keysPressed[keys.chomp]) {
      players.forEach((target, j) => {
        if (i !== j && !target.isIt && hit(player.sprite, target.sprite)) {
          player.isIt = false;
          target.isIt = true;
          itPlayerIndex = j;
          target.sprite.scale.set(2.2);
          player.sprite.scale.set(2);
          player.cooldown = 60;
        }
      });
    }

    if (player.cooldown > 0) player.cooldown--;
  });
}

function showWinner() {
  const winnerColor = playerConfig[players.findIndex(p => p.isIt)].color;
  const winnerText = new PIXI.Text(`Player with color: #${winnerColor.toString(16)} is IT!`, {
    fontFamily: "Arial",
    fontSize: 48,
    fill: winnerColor
  });
  winnerText.anchor.set(0.5);
  winnerText.position.set(app.screen.width / 2, app.screen.height / 2 - 100);
  app.stage.addChild(winnerText);

  const endText = new PIXI.Text("Time's Up!", {
    fontFamily: "Arial",
    fontSize: 36,
    fill: 0xffff00
  });
  endText.anchor.set(0.5);
  endText.position.set(app.screen.width / 2, app.screen.height / 2 - 40);
  app.stage.addChild(endText);

  const restart = new PIXI.Text("Restart", {
    fontFamily: "Arial",
    fontSize: 32,
    fill: 0xffffff
  });
  restart.anchor.set(0.5);
  restart.position.set(app.screen.width / 2, app.screen.height / 2 + 30);
  restart.interactive = true;
  restart.buttonMode = true;
  restart.on('pointerdown', showTitleScreen);
  app.stage.addChild(restart);
}

function hit(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < 50;
}
