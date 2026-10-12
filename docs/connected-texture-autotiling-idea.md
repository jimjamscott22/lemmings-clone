# Connected-Texture Autotiling Integration Spec

## 1. Overview
Connected-texture autotiling (bitmask autotiling) dynamically selects tile sprites based on neighboring cells of matching type. It replaces uniform grid tiles with contextual visuals (grass caps, rounded corners, cliff edges) without altering underlying physics or collision data.

---

## 2. Core Concepts & Math

### 4-Neighbor (Cardinal) Bitmasking — 16 Tiles
Evaluates orthogonal neighbors (North, East, South, West) around coordinate `(x, y)`: