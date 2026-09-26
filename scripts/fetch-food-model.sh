#!/usr/bin/env bash
# Downloads Google's AIY food_V1 classifier (Apache-2.0), converts it to a
# TensorFlow.js graph model quantised to 8 bits, and writes it with its label
# map into assets/model/food. Run by .github/workflows/food-model.yml.
set -euo pipefail

OUT=assets/model/food
HUB=https://tfhub.dev/google/aiy/vision/classifier/food_V1/1
KAGGLE=https://www.kaggle.com/api/v1/models/google/aiy/tensorFlow1/vision-classifier-food-v1/1/download
LABELS=https://www.gstatic.com/aihub/tfhub/labelmaps/aiy_food_V1_labelmap.csv

python -m pip install --quiet "tensorflowjs==4.17.0" "tensorflow_hub==0.16.1"
# The converter pulls in decision forests, whose protobuf build clashes with
# TensorFlow's; the converter only imports it optionally, so drop it.
python -m pip uninstall -y --quiet tensorflow_decision_forests yggdrasil_decision_forests ydf || true

rm -rf "$OUT" /tmp/food && mkdir -p "$OUT" /tmp/food
# The Kaggle archive is the module itself; the hub URL is the fallback.
if curl -fsSL -o /tmp/food.tgz "$KAGGLE" && tar -xzf /tmp/food.tgz -C /tmp/food; then
  SRC=/tmp/food
else
  SRC="$HUB"
fi
echo "converting from $SRC"
tensorflowjs_converter --input_format=tf_hub --quantize_uint8='*' "$SRC" "$OUT"
curl -fsSL -o "$OUT/labels.csv" "$LABELS"

ls -la "$OUT"
head -c 600 "$OUT/model.json"; echo
head -5 "$OUT/labels.csv"
wc -l "$OUT/labels.csv"
