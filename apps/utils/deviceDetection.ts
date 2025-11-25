import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Map iOS model IDs to human-readable device names
 * Based on official Apple device identifiers
 * Reference: https://www.theiphonewiki.com/wiki/Models
 */
const iphoneModelMap: { [key: string]: string } = {
  // iPhone 15 series (2023)
  'iPhone16,2': 'iPhone 15 Pro',
  'iPhone16,1': 'iPhone 15 Pro Max',
  'iPhone15,5': 'iPhone 15',
  'iPhone15,4': 'iPhone 15 Plus',
  'iPhone15,3': 'iPhone 15 Pro Max',
  'iPhone15,2': 'iPhone 15 Pro',
  'iPhone15,1': 'iPhone 15',

  // iPhone 14 series (2022)
  'iPhone15,0': 'iPhone 14',
  'iPhone14,8': 'iPhone 14',
  'iPhone14,7': 'iPhone 14 Plus',
  'iPhone14,5': 'iPhone 14 Plus',
  'iPhone14,4': 'iPhone 14 Pro Max',
  'iPhone14,3': 'iPhone 14 Pro',
  'iPhone14,2': 'iPhone 14 Pro',
  'iPhone14,1': 'iPhone 14',

  // iPhone 13 series (2021) - IMPORTANT: These are the correct mappings
  'iPhone14,0': 'iPhone 13',
  'iPhone13,4': 'iPhone 13 Pro Max', // THIS IS THE KEY ONE FOR YOU
  'iPhone13,3': 'iPhone 13 Pro',
  'iPhone13,2': 'iPhone 13',
  'iPhone13,1': 'iPhone 13 mini',
  'iPhone13,0': 'iPhone 13',

  // iPhone 12 series (2020)
  'iPhone13,5': 'iPhone 12 Pro Max',
  'iPhone13,6': 'iPhone 12',
  'iPhone12,5': 'iPhone 12 Pro Max',
  'iPhone12,4': 'iPhone 12 Pro',
  'iPhone12,3': 'iPhone 12 Pro',
  'iPhone12,2': 'iPhone 12',
  'iPhone12,1': 'iPhone 12 mini',

  // iPhone 11 series (2019)
  'iPhone12,0': 'iPhone 11',
  'iPhone11,8': 'iPhone XS Max',
  'iPhone11,7': 'iPhone XS Max',
  'iPhone11,6': 'iPhone XS',
  'iPhone11,4': 'iPhone XR',
  'iPhone11,2': 'iPhone XS',
  'iPhone11,1': 'iPhone XR',

  // iPhone X series (2017-2018)
  'iPhone11,0': 'iPhone 11',
  'iPhone10,6': 'iPhone X',
  'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,4': 'iPhone 8',
  'iPhone10,3': 'iPhone X',
  'iPhone10,2': 'iPhone XS Max',
  'iPhone10,1': 'iPhone XS',

  // iPhone SE series
  'iPhone14,6': 'iPhone SE (3rd generation)',
  'iPhone12,8': 'iPhone SE (2nd generation)',
  'iPhone8,4': 'iPhone SE (1st generation)',

  // Older models
  'iPhone9,4': 'iPhone 7 Plus',
  'iPhone9,3': 'iPhone 7 Plus',
  'iPhone9,2': 'iPhone 7 Plus',
  'iPhone9,1': 'iPhone 7',
  'iPhone8,2': 'iPhone 6s Plus',
  'iPhone8,1': 'iPhone 6s',
  'iPhone7,2': 'iPhone 6 Plus',
  'iPhone7,1': 'iPhone 6 Plus',
};

/**
 * Convert iOS model ID to human-readable name
 */
const getIPhoneModelName = (modelId: string): string => {
  if (!modelId) return 'iPhone';
  return iphoneModelMap[modelId] || `iPhone (${modelId})`;
};

/**
 * Get detailed device information including model, OS, and brand
 * Returns an object with device model and OS information suitable for logging
 */
export const getDeviceInfo = () => {
  try {
    let deviceModel = 'Unknown Device';

    // Debug log all available device info
    console.log('=== DEVICE INFO DEBUG ===');
    console.log('modelId:', Device.modelId);
    console.log('modelName:', Device.modelName);
    console.log('brand:', Device.brand);
    console.log('manufacturer:', Device.manufacturer);
    console.log('osVersion:', Device.osVersion);
    console.log('isDevice:', Device.isDevice);
    console.log('platformOS:', Platform.OS);
    console.log('======================');

    // For iOS, try multiple approaches to get the model
    if (Platform.OS === 'ios') {
      // IMPORTANT: On iOS, modelName is more reliable than modelId because:
      // - modelId can be shared across generations (e.g., iPhone14,3 for both iPhone 13 Pro Max and iPhone 14 Pro)
      // - modelName from Device.modelName is the actual device name from the system
      if (Device.modelName) {
        // PRIMARY: Use modelName if available (most accurate on physical devices)
        deviceModel = Device.modelName;
        console.log('✓ Using Device.modelName (PRIMARY):', deviceModel);
      } else if (Device.modelId) {
        // FALLBACK: Use modelId if modelName not available
        deviceModel = getIPhoneModelName(Device.modelId);
        console.log(
          '✓ Using Device.modelId (FALLBACK):',
          Device.modelId,
          '→',
          deviceModel,
        );
      } else if (Device.brand === 'Apple') {
        // LAST RESORT: We know it's an Apple device but don't have the model
        deviceModel = 'Apple iPhone (model unknown)';
        console.log('✓ Using fallback Apple device');
      }
    } else if (Platform.OS === 'android') {
      // For Android, prioritize modelName or manufacturer + modelName
      if (Device.modelName) {
        deviceModel = Device.modelName;
        console.log('✓ Using Android modelName:', deviceModel);
      } else if (Device.manufacturer && Device.designName) {
        deviceModel = `${Device.manufacturer} ${Device.designName}`;
        console.log('✓ Using Android manufacturer + designName:', deviceModel);
      } else if (Device.manufacturer) {
        deviceModel = Device.manufacturer;
        console.log('✓ Using Android manufacturer:', deviceModel);
      } else if (Device.brand) {
        deviceModel = Device.brand;
        console.log('✓ Using Android brand:', deviceModel);
      }
    } else {
      // Web platform
      deviceModel = Device.modelName || Device.brand || 'Web Browser';
      console.log('✓ Using web device info:', deviceModel);
    }

    const osName =
      Platform.OS === 'ios'
        ? 'iOS'
        : Platform.OS === 'android'
          ? 'Android'
          : 'Web';
    const osVersion = Device.osVersion || 'Unknown';

    // Construct device string: "iPhone 15 Pro (iOS 17.1)" or "Samsung Galaxy S24 (Android 14)"
    const deviceString = `${deviceModel} (${osName} ${osVersion})`;

    console.log('Final device string:', deviceString);

    return {
      modelName: deviceModel,
      osName: osName,
      osVersion: osVersion,
      deviceString: deviceString,
      brand: Device.brand || Platform.OS,
      manufacturer: Device.manufacturer || undefined,
      totalMemory: Device.totalMemory || 0,
    };
  } catch (error) {
    console.error('Error detecting device:', error);
    return {
      modelName: 'Unknown Device',
      osName: Platform.OS,
      osVersion: 'Unknown',
      deviceString: 'Unknown Device',
      brand: Platform.OS,
      manufacturer: undefined,
      totalMemory: 0,
    };
  }
};

/**
 * Get a formatted device string for logging purposes
 */
export const getFormattedDeviceString = (): string => {
  return getDeviceInfo().deviceString;
};

/**
 * Get device info as an object suitable for sending to backend
 */
export const getDeviceHeader = () => {
  const info = getDeviceInfo();
  return {
    'X-Device-Model': info.modelName,
    'X-Device-OS': info.osName,
    'X-Device-String': info.deviceString,
  };
};
