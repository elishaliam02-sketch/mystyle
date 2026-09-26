#!/usr/bin/env bash
# Downloads Google's AIY food_V1 classifier (Apache-2.0), converts it to a
# TensorFlow.js graph model quantised to 8 bits, and writes it with its label
# map into assets/model/food. Run by .github/workflows/food-model.yml.
set -euo pipefail

OUT=assets/model/food
HUB=https://tfhub.dev/google/aiy/vision/classifier/food_V1/1
KAGGLE=https://www.kaggle.com/api/v1/models/google/aiy/tensorFlow1/vision-classifier-food-v1/1/download
LABELS=https://www.gstatic.com/aihub/tfhub/labelmaps/aiy_food_V1_labelmap.csv

# hub.Module (the TF1 module format this model ships in) was removed in
# tensorflow_hub 0.16, and TensorFlow 2.16 dropped the TF1 pieces it uses.
python -m pip install --quiet "tensorflow==2.15.1" "tensorflowjs==4.17.0"
python -m pip install --quiet --no-deps --force-reinstall "tensorflow_hub==0.15.0"
export PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python
# The converter pulls in decision forests, whose protobuf build clashes with
# TensorFlow's; the converter only imports it optionally, so drop it.
python -m pip uninstall -y --quiet tensorflow_decision_forests yggdrasil_decision_forests ydf || true
# ...but it imports the name unconditionally: an empty stand-in satisfies it
# (it is only consulted for decision-forest models, which this is not).
SITE=$(python -c "import site; print(site.getsitepackages()[0])")
mkdir -p "$SITE/tensorflow_decision_forests" && : > "$SITE/tensorflow_decision_forests/__init__.py"

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
