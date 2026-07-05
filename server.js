import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import path from 'path';
import { fileURLToPath } from 'url';

// Node.js ESM setup for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
// Serve the Metro UI from the 'public' folder
app.use(express.static(path.join(__dirname, 'public'))); 

const ytmusic = new YTMusic();
let isReady = false;

// Initialize the API on startup
ytmusic.initialize().then(() => {
    isReady = true;
    console.log('YouTube Music API initialized successfully.');
}).catch(err => console.error('Failed to init YTMusic:', err));

// The Search Endpoint
app.get('/api/search', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up. Try again in a few seconds.' });
    
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'No search query provided.' });

    try {
        // Fetching songs specifically so we get valid playback IDs
        const results = await ytmusic.searchSongs(query);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch results from YouTube.' });
    }
});

app.listen(port, () => {
    console.log(`Metro Player backend running on port ${port}`);
});