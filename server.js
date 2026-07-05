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

// 1. Search Endpoint
app.get('/api/search', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    if (!req.query.q) return res.status(400).json({ error: 'No query provided.' });
    try { res.json(await ytmusic.search(req.query.q)); } 
    catch (error) { res.status(500).json({ error: 'Search failed.' }); }
});

// 2. Explore Endpoint (Localized)
app.get('/api/explore', async (req, res) => {
    if (!isReady) return res.status(503).json({ error: 'API is warming up.' });
    try {
        const [topTracks, newAlbums] = await Promise.all([
            ytmusic.searchSongs("Top Hindi and Punjabi hit songs"), 
            ytmusic.searchAlbums("Latest Hindi Punjabi albums")
        ]);
        res.json({ topTracks: topTracks.slice(0, 10), newAlbums: newAlbums.slice(0, 4) });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch explore data.' }); }
});

// 3. Collection Endpoints (NEW: To fetch songs inside Albums/Playlists/Artists)
app.get('/api/album', async (req, res) => {
    try { res.json(await ytmusic.getAlbum(req.query.id)); } 
    catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/playlist', async (req, res) => {
    try { res.json(await ytmusic.getPlaylist(req.query.id)); } 
    catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/artist', async (req, res) => {
    try { res.json(await ytmusic.getArtist(req.query.id)); } 
    catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(port, () => {
    console.log(`Metro Player backend running on port ${port}`);
});