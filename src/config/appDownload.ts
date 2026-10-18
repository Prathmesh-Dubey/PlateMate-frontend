// src/config/appDownload.ts
// Paste the DIRECT download URL of the app file (e.g. the .apk) below.
// It must point straight at the file (not a web page / preview page) so the
// download starts instantly when a user taps "Download App".
// Examples:
//   GitHub release : https://github.com/<user>/<repo>/releases/latest/download/PlateMate.apk
//   Google Drive   : https://drive.google.com/uc?export=download&id=<FILE_ID>
//   Own hosting    : https://yourdomain.com/downloads/PlateMate.apk  (or put the file in /public and use '/PlateMate.apk')
export const APP_DOWNLOAD_URL = 'https://github.com/Prathmesh-Dubey/PlateMate-frontend/releases/latest/download/PlateMate.apk';

/** File name suggested to the browser when it saves the download. */
export const APP_DOWNLOAD_FILENAME = 'PlateMate.apk';

/** True when running inside the installed Capacitor (Android/iOS) app, where the download link is pointless. */
export const isNativeApp = (): boolean => {
  const cap = (window as any).Capacitor;
  return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
};
