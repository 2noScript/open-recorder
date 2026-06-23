import Dexie, { type EntityTable } from "dexie"

export interface Recording {
  id?: number
  name: string
  blob: Blob
  mimeType: string
  duration: number
  size: number
  thumbnail?: Blob
  createdAt: Date
}

const db = new Dexie("OpenRecorder") as Dexie & {
  recordings: EntityTable<Recording, "id">
}

db.version(1).stores({
  recordings: "++id, name, createdAt",
})

export async function saveRecording(recording: Omit<Recording, "id">) {
  return db.recordings.add(recording)
}

export async function getAllRecordings() {
  return db.recordings.orderBy("createdAt").reverse().toArray()
}

export async function deleteRecording(id: number) {
  return db.recordings.delete(id)
}

export async function updateRecordingName(id: number, name: string) {
  return db.recordings.update(id, { name })
}

export default db
