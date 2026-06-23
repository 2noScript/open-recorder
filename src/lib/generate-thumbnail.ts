export async function generateVideoThumbnail(blob: Blob, seekTime = 0.5, maxSize = 320): Promise<Blob | undefined> {
  try {
    const url = URL.createObjectURL(blob)
    const video = document.createElement("video")
    video.src = url
    video.muted = true
    video.playsInline = true
    video.currentTime = seekTime
    await video.play()

    const width = Math.min(video.videoWidth, maxSize)
    const height = Math.round(width * (video.videoHeight / video.videoWidth))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(video, 0, 0, width, height)

    video.pause()
    URL.revokeObjectURL(url)

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob ?? undefined), "image/webp", 0.7)
    })
  } catch {
    return undefined
  }
}
