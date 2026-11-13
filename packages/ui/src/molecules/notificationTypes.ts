export type NotificationType = "success" | "error" | "info";

export interface NotificationMessage {
  id: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  conversationId?: string;
}

export interface UploadProgressState {
  phase: "uploading" | "publishing";
  fileName: string;
  progress: number;
}

export interface UploadResult {
  id: string;
  message: string;
  type: "success" | "error";
}
