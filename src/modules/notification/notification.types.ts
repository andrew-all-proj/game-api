export enum NotificationType {
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
}

export type NotificationPayload = {
  type: NotificationType
  message: string
  publishAt: string
  userIds: string[]
}

export interface NotificationChannel {
  send(payload: NotificationPayload): Promise<void>
}
