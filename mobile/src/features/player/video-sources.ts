import type { VideoSource } from 'expo-video';
import { Platform } from 'react-native';

/** Bundle the preview clip so demo playback does not depend on a public video CDN. */
export function playbackSource(uri: string): VideoSource {
  if (uri.startsWith('https://storage.googleapis.com/gtv-videos-bucket/sample/')) {
    // Web uses Expo's static public directory; native resolves the packaged asset.
    if (Platform.OS === 'web') return '/preview.webm';
    return require('../../../assets/video/flower.webm');
  }
  return uri.includes('/manifest/video.m3u8')
    ? { uri, contentType: 'hls', useCaching: false }
    : uri;
}
