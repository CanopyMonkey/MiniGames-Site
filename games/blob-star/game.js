// Create PIXI App to match window size
const app = new PIXI.Application({
  resizeTo: window, // Automatically resizes
  backgroundColor: 0x1d1d1d
});
document.body.appendChild(app.view);

// Asset loading
PIXI.Loader.shared
  .add('blob', 'https://pixijs.io/examples/examples/assets/bunny.png')
  .add('star', 'https://pixijs.io/examples/examples/assets/star.png')
  .load(setup);

// Game variables
let player, stars = [], keys = {}, score = 0, lives = 3;
let scoreText, livesText, gameOverText;

function setup() {
  // Player sprite
  player = new PIXI.Sprite(PIXI.Loader.shared.resources['blob'].texture);
  player.anchor.set(0.5);
  app.stage.addChild(player);

  // UI
  const style = new PIXI.TextStyle({ fill: '#ffffff', fontSize: 24 });
  scoreText = new PIXI.Text('Score: 0', style);
  livesText = new PIXI.Text('Lives: 3', style);
  app.stage.addChild(scoreText, livesText);

  // Input
  window.addEventListener('keydown', e => keys[e.code] = true);
  window.addEventListener('keyup', e => keys[e.code] = false);

  // Resize logic
  window.addEventListener('resize', resize);
  resize(); // Call on first load

  // Game loop
  app.ticker.add(gameLoop);

  // Spawn stars
  setInterval(spawnStar, 1000);
}

function resize() {
  // Position player at bottom center
  if (player) {
    player.y = app.screen.height - 50;
    player.x = Math.min(player.x, app.screen.width);
  }

  // UI positions
  if (scoreText && livesText) {
    scoreText.position.set(10, 10);
    livesText.position.set(10, 40);
  }

  // If game over screen is active, reposition it
  if (gameOverText) {
    gameOverText.x = app.screen.width / 2;
    gameOverText.y = app.screen.height / 2;
  }
}

function gameLoop(delta) {
  // Move player
  if (keys['ArrowLeft']) player.x -= 5;
  if (keys['ArrowRight']) player.x += 5;

  // Clamp player
  player.x = Math.max(0, Math.min(app.screen.width, player.x));

  // Update stars
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i];
    star.y += star.vy;

    if (hitTestRectangle(player, star)) {
      score++;
      app.stage.removeChild(star);
      stars.splice(i, 1);
      updateUI();
    } else if (star.y > app.screen.height) {
      lives--;
      app.stage.removeChild(star);
      stars.splice(i, 1);
      updateUI();
      if (lives <= 0) endGame();
    }
  }
}

function spawnStar() {
  const texture = PIXI.Loader.shared.resources['star'].texture;
  const star = new PIXI.Sprite(texture);
  star.anchor.set(0.5);
  star.x = Math.random() * (app.screen.width - 50) + 25;
  star.y = -20;
  star.vy = 3 + Math.random() * 2;
  app.stage.addChild(star);
  stars.push(star);
}

function hitTestRectangle(r1, r2) {
  const bounds1 = r1.getBounds();
  const bounds2 = r2.getBounds();
  return bounds1.x < bounds2.x + bounds2.width &&
         bounds1.x + bounds1.width > bounds2.x &&
         bounds1.y < bounds2.y + bounds2.height &&
         bounds1.y + bounds1.height > bounds2.y;
}

function updateUI() {
  scoreText.text = `Score: ${score}`;
  livesText.text = `Lives: ${lives}`;
}

function endGame() {
  app.ticker.stop();
  const style = new PIXI.TextStyle({
    fill: '#ff4444',
    fontSize: 48,
    fontWeight: 'bold'
  });
  gameOverText = new PIXI.Text('GAME OVER', style);
  gameOverText.anchor.set(0.5);
  gameOverText.x = app.screen.width / 2;
  gameOverText.y = app.screen.height / 2;
  app.stage.addChild(gameOverText);
}
