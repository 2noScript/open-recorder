import { useCallback, useState } from "react"
import {
  type Recording,
  saveRecording,
  getAllRecordings,
  deleteRecording,
  updateRecordingName,
} from "@/lib/db"

export function useRecordingStorage() {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getAllRecordings()
      setRecordings(list)
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(
    async (data: Omit<Recording, "id">) => {
      const id = await saveRecording(data)
      await refresh()
      return id
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: number) => {
      await deleteRecording(id)
      await refresh()
    },
    [refresh]
  )

  const rename = useCallback(
    async (id: number, name: string) => {
      await updateRecordingName(id, name)
      await refresh()
    },
    [refresh]
  )

  return { recordings, loading, refresh, save, remove, rename }
}
