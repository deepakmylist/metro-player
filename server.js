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

// Retry wrapper to handle flaky API calls
async function withRetry(fn, retries = 2, delayMs = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`API call failed (attempt ${i + 1}/${retries}), retrying in ${delayMs}ms... Error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

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
        res.json({ topTracks: topTracks.slice(0, 20), newAlbums: newAlbums.slice(0, 10) });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch explore data.' }); }
});

// 3. Collection Endpoints (NEW: To fetch songs inside Albums/Playlists/Artists)
app.get('/api/album', async (req, res) => {
    const albumId = req.query.id;
    const name = req.query.name || '';
    
    if (albumId && albumId.startsWith('RDCLAK')) {
        try {
            const vlId = 'VL' + albumId;
            const songs = await withRetry(() => ytmusic.getPlaylistVideos(vlId));
            if (songs && songs.length > 0) {
                return res.json({ name: name || 'Album', songs: songs });
            }
        } catch (err) {
            console.log(`Album RDCLAK tried as playlist failed for ID ${albumId}:`, err.message);
        }
    }

    try { 
        res.json(await ytmusic.getAlbum(albumId)); 
    } 
    catch (error) { 
        console.error(`getAlbum failed for ID ${albumId}, fallback to searchSongs for ${name}:`, error);
        try {
            if (name) {
                const songs = await ytmusic.searchSongs(name);
                res.json({ name: name, songs: songs });
            } else {
                res.status(500).json({ error: error.message });
            }
        } catch (fallbackError) {
            res.status(500).json({ error: error.message });
        }
    }
});

app.get('/api/playlist', async (req, res) => {
    const playlistId = req.query.id;
    const name = req.query.name || '';
    
    // Sort IDs to prioritize VL prefixed version for RDCLAK (curated) playlists
    const idsToTry = [];
    if (playlistId) {
        if (playlistId.startsWith('RDCLAK') && !playlistId.startsWith('VL')) {
            idsToTry.push('VL' + playlistId);
            idsToTry.push(playlistId);
        } else {
            idsToTry.push(playlistId);
            if (!playlistId.startsWith('PL') && !playlistId.startsWith('VL')) {
                idsToTry.push('VL' + playlistId);
            }
        }
    }
    
    for (const id of idsToTry) {
        try {
            const [meta, songs] = await Promise.all([
                withRetry(() => ytmusic.getPlaylist(id)).catch(() => ({})),
                withRetry(() => ytmusic.getPlaylistVideos(id))
            ]);
            if (songs && songs.length > 0) {
                return res.json({ ...meta, songs });
            }
        } catch (error) {
            console.log(`Playlist retrieve attempt info: ID ${id} not fetched directly:`, error.message);
        }
    }
    
    // Fallback: search for songs by the playlist name
    console.log(`Playlist Info: trying search fallback for: ${name}`);
    try {
        if (name) {
            const songs = await withRetry(() => ytmusic.searchSongs(name));
            if (songs && songs.length > 0) {
                return res.json({ name: name, songs: songs });
            }
        }
    } catch (searchError) {
        console.log('Playlist fallback search info:', searchError.message);
    }
    
    res.json({ name: name || 'Playlist', songs: [] });
});

app.get('/api/artist', async (req, res) => {
    const artistId = req.query.id;
    const name = req.query.name || '';
    
    try {
        const artist = await withRetry(() => ytmusic.getArtist(artistId));
        // If topSongs is empty or missing, try to fetch artist songs
        if (!artist.topSongs || artist.topSongs.length === 0) {
            artist.topSongs = await withRetry(() => ytmusic.getArtistSongs(artistId)).catch(() => []);
        }
        if (artist.topSongs && artist.topSongs.length > 0) {
            return res.json(artist);
        }
    } catch (error) {
        console.log(`Artist info: getArtist for ID ${artistId} not fetched directly:`, error.message);
    }
    
    // Try getArtistSongs directly with retry
    try {
        const songs = await withRetry(() => ytmusic.getArtistSongs(artistId));
        if (songs && songs.length > 0) {
            return res.json({ name: name || 'Artist', topSongs: songs });
        }
    } catch (error) {
        console.log(`Artist info: getArtistSongs for ID ${artistId} not fetched directly:`, error.message);
    }
    
    // Fallback: search for songs by the artist name
    console.log(`Artist Info: trying search fallback for: ${name}`);
    try {
        if (name) {
            const songs = await withRetry(() => ytmusic.searchSongs(name));
            if (songs && songs.length > 0) {
                return res.json({ name: name, topSongs: songs });
            }
        }
    } catch (searchError) {
        console.log('Artist fallback search info:', searchError.message);
    }
    
    res.json({ name: name || 'Artist', topSongs: [] });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Metro Player backend running on port ${port}`);
});