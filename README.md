# DitherCam

A real-time camera dithering web app that applies a 2-color (blue and white) dithering effect to your camera feed.

## Features

- Real-time camera feed processing with Bayer matrix dithering
- Interactive controls:
  - Move finger/mouse horizontally to adjust threshold (-1 to 1)
  - Move finger/mouse vertically to adjust grid size (2px to 16px)
- Capture button to save the current view as PNG
- Fullscreen experience
- Works on both desktop and mobile browsers
- Minimal UI design

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev -- --host
```

## License

MIT
