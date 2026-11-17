import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';
import { Button, ErrorNote, Label } from '@/components/ui';
import { uploadCoverImage } from '@/services/uploads/cover-upload';
import { colors as c } from '@/theme/tokens';

/**
 * Cover image chooser for channels and titles. Picks a photo from the phone,
 * uploads it straight away and reports the public URL through onChange.
 */
export function CoverImageField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose() {
    setError(null);
    try {
      // Phone photos are large; re-encoding at 0.7 keeps covers well under the 5 MB limit.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
      const picked = result.canceled ? undefined : result.assets[0];
      if (!picked) return;
      setUploading(true);
      onChange(await uploadCoverImage(picked));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The image could not be added.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ gap: 7 }}>
      <Label style={{ fontSize: 13, fontWeight: '600' }}>Cover image (optional)</Label>
      {value ? (
        <Image
          source={value}
          accessibilityLabel="Selected cover image"
          style={{ aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: c.line }}
          contentFit="cover"
          transition={180}
        />
      ) : null}
      <Button
        title={value ? 'Change image' : 'Choose image'}
        icon={ImagePlus}
        variant="outline"
        loading={uploading}
        disabled={disabled}
        onPress={() => void choose()}
      />
      {value && !uploading ? (
        <Button
          title="Remove image"
          variant="outline"
          disabled={disabled}
          onPress={() => onChange('')}
        />
      ) : null}
      <ErrorNote message={error} />
    </View>
  );
}
