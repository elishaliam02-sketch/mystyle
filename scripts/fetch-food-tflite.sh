#!/usr/bin/env bash
# Downloads the TensorFlow Lite build of Google's AIY food_V1 classifier
# (Apache-2.0) into assets/model/food/food.tflite, and checks it on a known
# photo before it is committed. The phone runs this one natively (LiteRT):
# the same model as the TensorFlow.js copy beside it, but ~50x faster, because
# JavaScript on the phone has no JIT and took 20 s or more per photo.
# Run by .github/workflows/food-model.yml.
set -euo pipefail

OUT=assets/model/food
KAGGLE=https://www.kaggle.com/api/v1/models/google/aiy/tfLite/vision-classifier-food-v1/1/download
HUB="https://tfhub.dev/google/lite-model/aiy/vision/classifier/food_V1/1?lite-format=tflite"

mkdir -p "$OUT" /tmp/foodlite
rm -f "$OUT/food.tflite"
if curl -fsSL -o /tmp/foodlite.tgz "$KAGGLE" && tar -xzf /tmp/foodlite.tgz -C /tmp/foodlite; then
  cp "$(find /tmp/foodlite -name '*.tflite' | head -1)" "$OUT/food.tflite"
else
  curl -fsSL -o "$OUT/food.tflite" "$HUB"
fi
ls -la "$OUT/food.tflite"

# Load it, print the tensors, and classify a dish photo the app ships: the
# app reads these shapes and types, so a surprise here must fail the job.
python -m pip install --quiet "tensorflow==2.15.1" pillow numpy
python - <<'PY'
import json, numpy as np, tensorflow as tf
from PIL import Image
it = tf.lite.Interpreter(model_path="assets/model/food/food.tflite")
it.allocate_tensors()
inp, out = it.get_input_details()[0], it.get_output_details()[0]
print("input ", inp["shape"], inp["dtype"], inp["quantization"])
print("output", out["shape"], out["dtype"], out["quantization"])
assert list(inp["shape"]) == [1, 192, 192, 3], inp["shape"]
labels = [l.split(",", 1)[1].strip() for l in open("assets/model/food/labels.csv", encoding="utf-8").read().splitlines()[1:]]
assert out["shape"][-1] == len(labels), (out["shape"], len(labels))
for name in ["shakshuka", "omelette-salad", "salmon-veg"]:
    im = Image.open(f"assets/meals/{name}.jpg").convert("RGB")
    s = min(im.size); l = (im.width - s) // 2; t = (im.height - s) // 2
    im = im.crop((l, t, l + s, t + s)).resize((192, 192), Image.BILINEAR)
    x = np.asarray(im)[None]
    x = x.astype(inp["dtype"]) if inp["dtype"] == np.uint8 else (x / 255.0).astype(inp["dtype"])
    it.set_tensor(inp["index"], x); it.invoke()
    y = it.get_tensor(out["index"])[0].astype(np.float32)
    sc, zp = out["quantization"]
    if sc: y = (y - zp) * sc
    top = np.argsort(-y)[:3]
    print(name, [(labels[i], round(float(y[i]), 3)) for i in top])
json.dump({"input": {"shape": [int(v) for v in inp["shape"]], "dtype": str(np.dtype(inp["dtype"]))},
           "output": {"shape": [int(v) for v in out["shape"]], "dtype": str(np.dtype(out["dtype"])),
                      "scale": float(out["quantization"][0]), "zeroPoint": int(out["quantization"][1])}},
          open("assets/model/food/tflite.json", "w"), indent=1)
PY
cat "$OUT/tflite.json"
