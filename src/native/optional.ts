/**
 * Native modules that some installed copies of the app do not have.
 *
 * Over-the-air updates reach every install on the same app version, including
 * ones built before a native module was added (the gallery and camera picker,
 * the step sensor). Importing such a module at the top of a file makes the
 * whole update crash on launch on those phones, and the phone quietly falls
 * back to its old version — so the update never seems to arrive. These are
 * looked up when used instead: missing means the one feature says so, never
 * that the app will not start.
 */
type ImagePickerModule = typeof import("expo-image-picker");
type SensorsModule = typeof import("expo-sensors");

export function imagePicker(): ImagePickerModule | null {
  try {
    return require("expo-image-picker") as ImagePickerModule;
  } catch {
    return null;
  }
}

export function sensors(): SensorsModule | null {
  try {
    return require("expo-sensors") as SensorsModule;
  } catch {
    return null;
  }
}

type FileSystemModule = typeof import("expo-file-system/legacy");

/** File access — shipped inside Expo itself, but looked up all the same. */
export function fileSystem(): FileSystemModule | null {
  try {
    return require("expo-file-system/legacy") as FileSystemModule;
  } catch {
    return null;
  }
}
