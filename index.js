const express = require('express');
const path = require('path');
const app = express();
const PORT = 3001;

// Serve static files under '/MiniGames-Site'
app.use('/MiniGames-Site', express.static(path.join(__dirname, 'public')));

// Optional root route fallback
app.get('/', (req, res) => {
    res.send('Go to <a href="/MiniGames-Site/index.html">/MiniGames-Site/index.html</a>');
});

app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}/MiniGames-Site/`));
