import React, { useEffect, useRef, useState, useCallback } from 'react'

interface BayerMatrix extends Array<number[]> {
  [index: number]: number[];
}

function App(): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gridSize, setGridSize] = useState(() => 4)
  const [threshold, setThreshold] = useState(() => 0)
  const animationFrameRef = useRef<number | undefined>(undefined)

  // Bayer matrix 4x4 for dithering
  const bayerMatrix: BayerMatrix = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ]

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: window.innerWidth },
            height: { ideal: window.innerHeight }
          } 
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
      }
    }

    void startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
  }, [])

  const handleCapture = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `dithercam-${new Date().toISOString()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

  const applyDithering = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio

    // Clear previous frame
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Calculate video scaling
    const scale = Math.max(
      canvas.width / video.videoWidth,
      canvas.height / video.videoHeight
    )
    const scaledWidth = video.videoWidth * scale
    const scaledHeight = video.videoHeight * scale
    const x = (canvas.width - scaledWidth) / 2
    const y = (canvas.height - scaledHeight) / 2

    // Create temporary canvas for video frame
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // Draw and scale video frame
    tempCtx.fillStyle = '#000000'
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height)
    tempCtx.drawImage(video, x, y, scaledWidth, scaledHeight)

    // Get frame data
    const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // Apply dithering effect
    for (let y = 0; y < canvas.height; y += gridSize) {
      for (let x = 0; x < canvas.width; x += gridSize) {
        const i = (y * canvas.width + x) * 4
        if (i >= data.length - 4) continue

        const r = data[i] || 0
        const g = data[i + 1] || 0
        const b = data[i + 2] || 0
        const gray = (r + g + b) / 3

        const bayerX = Math.abs(x % 4)
        const bayerY = Math.abs(y % 4)
        const bayerValue = bayerMatrix[bayerY]?.[bayerX] ?? 8 // Fallback to middle value if undefined
        const normalizedBayer = (bayerValue / 16) - 0.5
        const isWhite = (gray / 255) > (0.5 + normalizedBayer + threshold)
        
        ctx.fillStyle = isWhite ? '#FFFFFF' : '#0000FF'
        ctx.fillRect(x, y, gridSize, gridSize)
      }
    }

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(applyDithering)
  }, [gridSize, threshold, bayerMatrix])

  useEffect(() => {
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(applyDithering)
    }
    animate()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [applyDithering])

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Hidden video element - make sure it's really hidden */}
      <video
        ref={videoRef}
        className="hidden w-0 h-0 opacity-0 absolute"
        playsInline
        muted
        style={{ visibility: 'hidden', position: 'absolute' }}
      />
      
      {/* Fullscreen canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ 
          imageRendering: 'pixelated',
          objectFit: 'cover'
        }}
      />

      {/* Floating Control Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-50">
        <div className="bg-black/80 backdrop-blur-sm p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto space-y-4">
            {/* Grid Size Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-white text-sm font-medium">Grid Size</label>
                <span className="text-white/80 text-sm">{gridSize}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="16"
                value={gridSize}
                onChange={(e) => setGridSize(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Threshold Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-white text-sm font-medium">Threshold</label>
                <span className="text-white/80 text-sm">{threshold.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
                style={{
                  WebkitAppearance: 'none',
                  appearance: 'none'
                }}
              />
            </div>

            {/* Capture Button */}
            <button
              onClick={handleCapture}
              className="w-full py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-lg border border-white/20 text-white font-medium transition-colors"
            >
              Capture
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
