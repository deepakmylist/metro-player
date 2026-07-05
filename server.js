import express from 'express';
import cors from 'cors';
import YTMusic from 'ytmusic-api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const ytmusic = new YTMusic();
let isReady = false;

ytmusic.initialize().then(() => {
    isReady = true;
    console.log('YouTube Music API initialized successfully.');
}).catch(err => console.error('Failed to init YTMusic:', err));

app.get('/api/search', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'No query provided.' });

    try {
        const results = await ytmusic.search(query);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Search failed.' });
    }
});

// --- UPDATED EXPLORE ENDPOINT (Localized to India/Hindi/Punjabi) ---
app.get('/api/explore', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    
    try {
        // Fetching targeted queries to populate the Explore tab with localized content
        const [topTracks, newAlbums] = await Promise.all([
            ytmusic.searchSongs("Top Hindi and Punjabi hit songs"), 
            ytmusic.searchAlbums("Latest Hindi Punjabi albums")
        ]);
        
        res.json({
            topTracks: topTracks.slice(0, 10),
            newAlbums: newAlbums.slice(0, 4)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch explore data.' });
    }
});

app.listen(port, () => {
    console.log(`Metro Player backend running on port ${port}`);
});