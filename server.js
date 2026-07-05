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

// Initialize YouTube Music API
ytmusic.initialize().then(() => {
    isReady = true;
    console.log('YouTube Music API initialized successfully.');
}).catch(err => console.error('Failed to init YTMusic:', err));

// --- ENDPOINT 1: MIXED SEARCH ---
app.get('/api/search', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'No query provided.' });

    try {
        // .search() returns a mixed array of Songs, Albums, Artists, and Playlists
        const results = await ytmusic.search(query);
        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Search failed.' });
    }
});

// --- ENDPOINT 2: EXPLORE DATA ---
app.get('/api/explore', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    
    try {
        // Fetching generic chart queries to populate the Explore tab
        const [topTracks, newAlbums] = await Promise.all([
            ytmusic.searchSongs("Global Top Songs"),
            ytmusic.searchAlbums("New Releases")
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