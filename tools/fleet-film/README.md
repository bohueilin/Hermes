# Original FleetLab concept film

`render.py` builds every mesh, material and camera setup in Blender. This is a deliberately stylized, Bay-inspired scene: unbranded electric AV concepts, a waterfront promenade, a small depot and a neighborhood. The vehicles are not licensed manufacturer models or dimensionally faithful replicas. The scene is not the OSM street network and the motion is not output from FleetLab's simulator.

The three scenes connect the visitor's desired outcome to the product question:

1. **The ride:** a close tracking shot makes the AV legible and approachable, with a public waterfront and people in view.
2. **Readiness:** vehicles, chargers, solar canopies and an operator show that the trip depends on work and infrastructure between rides.
3. **The system:** a wider view connects multiple moving vehicles to the neighborhood and depot.

The film has no audio or embedded claims/metrics. The website supplies accessible text describing the scene and explains that it is an original concept film. It is independent of the simulation playback controls.

## Reproduce

Requirements: Blender 4.5 (tested with 4.5.0 on Apple Silicon using Cycles/Metal) and FFmpeg with libx264, and Python with Pillow for poster format conversion. The Blender script selects Metal; change the device setup to CPU if rendering on a different platform. The browser does not need either program.

From the repository root, set `BLENDER_BIN` to your Blender executable and render review frames first:

```sh
"$BLENDER_BIN" -b --python tools/fleet-film/render.py -- --output artifacts/film/preview --preview
```

Then render 384 frames at 24 fps. Outputs remain under the ignored artifacts directory. You can resume a range with `--start` and `--end`.

```sh
"$BLENDER_BIN" -b --python tools/fleet-film/render.py -- --output artifacts/film/frames
ffmpeg -framerate 24 -start_number 1 -i artifacts/film/frames/frame-%04d.png -an -c:v libx264 -preset slow -crf 25 -pix_fmt yuv420p -movflags +faststart playground/fleetlab/media/fleet-film.mp4
python - <<'PYTHON'
from PIL import Image
with Image.open("artifacts/film/frames/frame-0045.png") as frame:
    frame.save("playground/fleetlab/media/fleet-film-poster.webp", "WEBP", quality=84)
PYTHON
```

Inspect the three shots, their cuts and the loop before packaging. Verify duration, resolution, codec, lack of audio and file size with `ffprobe`. The static packer caps the film at 4 MiB and poster at 200 KiB. Frame renders and the editable `.blend` are authoring artifacts, not website files.

## Provenance

All scene geometry, choreography and materials were authored for FleetLab. No downloaded models, stock footage, music, fonts, photography or textures are used. Wayve's website informed the page's large-motion/short-message composition only; no Wayve assets are used. Scene source and delivered media follow this repository's license.
