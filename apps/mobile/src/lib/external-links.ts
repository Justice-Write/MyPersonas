import { Alert, Linking } from 'react-native';

export async function openExternalUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Only web links can be opened.');
    }
    if (!(await Linking.canOpenURL(parsed.href))) {
      throw new Error('No browser is available for this link.');
    }
    await Linking.openURL(parsed.href);
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : 'The link could not be opened.';
    Alert.alert('Could not open link', detail);
  }
}
