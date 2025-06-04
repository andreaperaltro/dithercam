import { useEffect, useRef, useState, useCallback } from 'react'

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gridSize, setGridSize] = useState(4)
  const [threshold, setThreshold] = useState(0)
  const animationFrameRef = useRef<number>()
  const [showControls, setShowControls] = useState(false)

  // Handle touch/mouse interaction
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Calculate threshold based on X position (-1 to 1)
    const newThreshold = (x / rect.width) * 2 - 1
    // Calculate grid size based on Y position (2 to 16)
    const newGridSize = Math.floor(((rect.height - y) / rect.height) * 14 + 2)
    
    setThreshold(newThreshold)
    setGridSize(newGridSize)
  }, [])

  const handleCapture = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Create a temporary link element
    const link = document.createElement('a')
    link.download = `dithercam-${new Date().toISOString()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [])

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
          videoRef.current.play()
        }
      } catch (err) {
        console.error('Error accessing camera:', err)
      }
    }

    startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
        tracks.forEach(track => track.stop())
      }
    }
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

    // Bayer matrix 4x4 for dithering
    const bayerMatrix = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ]

    // Apply dithering effect
    for (let y = 0; y < canvas.height; y += gridSize) {
      for (let x = 0; x < canvas.width; x += gridSize) {
        const i = (y * canvas.width + x) * 4
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
        const bayerValue = bayerMatrix[y % 4][x % 4]
        const normalizedBayer = (bayerValue / 16) - 0.5
        const isWhite = (gray / 255) > (0.5 + normalizedBayer + threshold)
        
        ctx.fillStyle = isWhite ? '#FFFFFF' : '#0000FF'
        ctx.fillRect(x, y, gridSize, gridSize)
      }
    }

    // Request next frame
    animationFrameRef.current = requestAnimationFrame(applyDithering)
  }, [gridSize, threshold])

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
        className="w-full h-full touch-none"
        style={{ 
          imageRendering: 'pixelated',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={() => setShowControls(true)}
      />

      {/* Capture button */}
      <button
        onClick={handleCapture}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm border-4 border-white/80 flex items-center justify-center shadow-lg z-50"
        aria-label="Capture photo"
      >
        <div className="w-14 h-14 rounded-full bg-white shadow-inner"></div>
      </button>

      {/* Debug overlay (optional) */}
      {showControls && (
        <div className="absolute top-4 left-4 bg-black/50 text-white p-2 rounded text-sm">
          Grid: {gridSize}px<br/>
          Threshold: {threshold.toFixed(2)}
        </div>
      )}
    </div>
  )
}

export default App
