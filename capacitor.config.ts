import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Native packaging for Google Play and the App Store.
 * The static export in `out/` is bundled into the app, so Owwy runs fully
 * offline with no server. Plugins are optional; the web build degrades gracefully.
 */
const config: CapacitorConfig = {
  appId: "app.owwy.budget",
  appName: "Owwy",
  webDir: "out",
  backgroundColor: "#0b1310",
  android: {
    // No cleartext traffic, no remote content: everything ships in the bundle.
    allowMixedContent: false,
    captureInput: true,
  },
  ios: {
    contentInset: "never",
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#0b1310",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_owwy",
      iconColor: "#14463f",
    },
  },
};

export default config;
