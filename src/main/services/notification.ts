import { Notification, shell } from "electron";

export class NotificationService {
  showLiveNotification(options: {
    displayName: string;
    platform: string;
    channelUrl: string;
  }) {
    if (!Notification.isSupported()) {
      return;
    }

    const notification = new Notification({
      title: `${options.displayName} is live`,
      body: `Click to open on ${options.platform}.`,
      silent: false,
    });

    notification.on("click", () => {
      void shell.openExternal(options.channelUrl);
    });

    notification.show();
  }

  showUpdateNotification(options: {
    version: string;
    releaseNotes?: string;
    downloadUrl?: string;
    onDownload?: () => void;
    onInstall?: () => void;
  }) {
    if (!Notification.isSupported()) {
      return;
    }

    const notification = new Notification({
      title: "StageDock Update Available",
      body: `Version ${options.version} is now available. Click to download and install.`,
      silent: false,
      actions: [
        {
          type: "button",
          text: "Download",
        },
        {
          type: "button",
          text: "Install Later",
        },
      ],
    });

    notification.on("click", () => {
      if (options.onDownload) {
        options.onDownload();
      }
    });

    notification.on("action", (_event, index) => {
      if (index === 0 && options.onDownload) {
        options.onDownload();
      }
      // index === 1 is "Install Later" - do nothing
    });

    notification.show();
  }

  showUpdateDownloadedNotification(options: {
    version: string;
    onInstall?: () => void;
    onRestartLater?: () => void;
  }) {
    if (!Notification.isSupported()) {
      return;
    }

    const notification = new Notification({
      title: "StageDock Update Ready",
      body: `Version ${options.version} has been downloaded. Click to install and restart.`,
      silent: false,
      actions: [
        {
          type: "button",
          text: "Install & Restart",
        },
        {
          type: "button",
          text: "Restart Later",
        },
      ],
    });

    notification.on("click", () => {
      if (options.onInstall) {
        options.onInstall();
      }
    });

    notification.on("action", (_event, index) => {
      if (index === 0 && options.onInstall) {
        options.onInstall();
      } else if (index === 1 && options.onRestartLater) {
        options.onRestartLater();
      }
    });

    notification.show();
  }
}
