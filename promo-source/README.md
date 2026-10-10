# Boise Mold Removal promo video source

3D promo built on the Diorama engine from
[habibtalib/claude-motion-promo-skill](https://github.com/habibtalib/claude-motion-promo-skill) (MIT).

- `scene.js`: the house, worker, mold spots, scan, scrubber, camera and captions
- `index.html`: brand colors and the ending-screen text (phone number, tagline)
- `assets/logo.png`: placeholder logo

Re-render (needs Node 20+, ffmpeg, Python 3 with numpy, Chromium):

```bash
npm install
CHROME_PATH=/path/to/chromium ./make.sh 30 "" boise-mold-removal-promo   # → out/boise-mold-removal-promo.mp4
```
