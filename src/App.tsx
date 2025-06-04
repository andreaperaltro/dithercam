import React, { useEffect, useRef, useState } from 'react'

function App(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gridSize, setGridSize] = useState<number>(4)
  const [threshold, setThreshold] = useState<number>(0)
  const frameRef = useRef<number>()

  // Initialize camera
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: window.innerWidth },
        height: { ideal: window.innerHeight }
      }
    })
    .then(stream => {
      video.srcObject = stream
      video.play()
    })
    .catch(err => console.error('Camera error:', err))

    return () => {
      const tracks = video.srcObject as MediaStream
      tracks?.getTracks().forEach(track => track.stop())
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  // Dithering effect
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bayer4x4 = [
      [ 0,  8,  2, 10],
      [12,  4, 14,  6],
      [ 3, 11,  1,  9],
      [15,  7, 13,  5]
    ]

    const render = () => {
      // Match canvas to screen size
      canvas.width = window.innerWidth * window.devicePixelRatio
      canvas.height = window.innerHeight * window.devicePixelRatio

      // Scale video to fill canvas
      const scale = Math.max(
        canvas.width / video.videoWidth,
        canvas.height / video.videoHeight
      )
      const w = video.videoWidth * scale
      const h = video.videoHeight * scale
      const x = (canvas.width - w) / 2
      const y = (canvas.height - h) / 2

      // Draw video frame
      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(video, x, y, w, h)

      // Get frame data
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = frame.data

      // Apply dithering
      for (let y = 0; y < canvas.height; y += gridSize) {
        for (let x = 0; x < canvas.width; x += gridSize) {
          const i = (y * canvas.width + x) * 4
          if (i >= data.length - 4) continue

          // Convert to grayscale
          const gray = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255

          // Apply Bayer dithering
          const bayerValue = bayer4x4[y % 4][x % 4] / 16 - 0.5
          const isWhite = gray > 0.5 + bayerValue + threshold

          // Draw pixel
          ctx.fillStyle = isWhite ? 'white' : 'blue'
          ctx.fillRect(x, y, gridSize, gridSize)
        }
      }

      frameRef.current = requestAnimationFrame(render)
    }

    frameRef.current = requestAnimationFrame(render)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [gridSize, threshold])

  // Screenshot function
  const takeScreenshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const link = document.createElement('a')
    link.download = `dithercam-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Hidden video element */}
      <video 
        ref={videoRef}
        className="hidden"
        playsInline 
        muted
      />

      {/* Fullscreen canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Controls drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-lg">
        <div className="max-w-sm mx-auto px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
          {/* Grid size control */}
          <div>
            <div className="flex justify-between text-white mb-2">
              <span>Grid Size</span>
              <span>{gridSize}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              value={gridSize}
              onChange={e => setGridSize(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Threshold control */}
          <div>
            <div className="flex justify-between text-white mb-2">
              <span>Threshold</span>
              <span>{threshold.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-0.5"
              max="0.5"
              step="0.05"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Screenshot button */}
          <button
            onClick={takeScreenshot}
            className="w-full py-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-lg text-white font-medium"
          >
            Take Screenshot
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
