import { convertFileSrc, invoke } from "@tauri-apps/api/core"

export interface Recording {
  id: number
  name: string
  filePath: string
  thumbnailPath: string | null
  mimeType: string
  duration: number
  size: number
  createdAt: string
}

export interface NewRecording {
  name: string
  filePath: string
  thumbnailPath: string | null
  mimeType: string
  duration: number
  size: number
  createdAt: string
}

export async function saveRecording(recording: NewRecording): Promise<Recording> {
  return invoke<Recording>("save_recording", { recording })
}

export async function getAllRecordings(): Promise<Recording[]> {
  return invoke<Recording[]>("get_all_recordings")
}

export async function deleteRecording(id: number): Promise<void> {
  return invoke<void>("delete_recording", { id })
}

export async function updateRecordingName(id: number, name: string): Promise<void> {
  return invoke<void>("update_recording_name", { id, name })
}

export async function openRecordingInFolder(filePath: string): Promise<void> {
  return invoke<void>("open_recording_in_folder", { filePath })
}

export async function exportRecordingFile(
  sourcePath: string,
  destPath: string
): Promise<void> {
  return invoke<void>("export_recording_file", { sourcePath, destPath })
}

export function getMediaUrl(filePath: string): string {
  return convertFileSrc(filePath)
}
