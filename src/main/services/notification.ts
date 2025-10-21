import { Notification, shell } from 'electron';

export class NotificationService {
  showLiveNotification(options: { displayName: string; platform: string; channelUrl: string }) {
    if (!Notification.isSupported()) {
      return;
    }

    const notification = new Notification({
      title: `${options.displayName} is live`,
      body: `Click to open on ${options.platform}.`,
      silent: false
    });

    notification.on('click', () => {
      void shell.openExternal(options.channelUrl);
    });

    notification.show();
  }
}
