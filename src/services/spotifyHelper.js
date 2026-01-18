import { fetch } from 'undici';
import creators from 'spotify-url-info';
const spotify = creators(fetch);

export async function getSpotifyMetadata(url) {
  try {
    const data = await spotify.getData(url);
    const durationMs = data.duration || data.duration_ms || 0;
    const images = data.visualIdentity?.image || data.images || data.coverArt?.sources || [];
    
    return {
      title: data.name || data.title,
      artist: data.artists?.[0]?.name || 'Unknown Artist',
      duration: Math.round(durationMs / 1000),
      thumbnail: images.sort((a, b) => (b.maxWidth || 0) - (a.maxWidth || 0))[0]?.url,
    };
  } catch (error) {
    console.error('Error fetching Spotify metadata:', error.message);
    throw new Error('Failed to fetch Spotify metadata');
  }
}
