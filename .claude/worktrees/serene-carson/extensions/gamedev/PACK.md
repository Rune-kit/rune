---
name: "@rune/gamedev"
description: Game development patterns — Three.js, WebGL, game loops, physics engines, and asset pipelines.
metadata:
  author: runedev
  version: "0.1.0"
  layer: L4
  price: "$12"
  target: Game developers
---

# @rune/gamedev

## Purpose

Web game development hits performance walls that traditional web apps never encounter: 60fps render loops that stutter on garbage collection, physics simulations that diverge between clients, shaders that work on desktop but fail on mobile GPUs, and asset loading that blocks the first frame for 10 seconds. This pack provides patterns for the full web game stack — rendering, simulation, physics, and assets — each optimized for the unique constraints of real-time interactive applications running in a browser.

## Triggers

- Auto-trigger: when `three`, `@react-three/fiber`, `pixi.js`, `phaser`, `cannon`, `rapier`, `*.glsl`, `*.wgsl` detected
- `/rune threejs-patterns` — audit or optimize Three.js scene
- `/rune webgl` — raw WebGL/shader development
- `/rune game-loops` — implement or audit game loop architecture
- `/rune physics-engine` — set up or optimize physics simulation
- `/rune asset-pipeline` — optimize asset loading and management
- Called by `cook` (L1) when game development task detected

## Skills Included

### threejs-patterns

Three.js patterns — scene setup, React Three Fiber integration, PBR materials, post-processing, performance optimization.

#### Workflow

**Step 1 — Detect Three.js setup**
Use Grep to find Three.js usage: `THREE.`, `useThree`, `useFrame`, `Canvas`, `@react-three/fiber`, `@react-three/drei`. Read the main scene file to understand: renderer setup, scene graph structure, camera type, and lighting model.

**Step 2 — Audit performance**
Check for: objects created inside `useFrame` (GC pressure), missing `dispose()` on unmount (memory leak), no frustum culling on large scenes, textures without power-of-two dimensions, unoptimized geometry (too many draw calls), and missing LOD for distant objects.

**Step 3 — Emit optimized scene**
Emit: properly structured R3F scene with declarative lights, memoized geometries, disposal on unmount, instanced meshes for repeated objects, and post-processing pipeline.

#### Example

```tsx
// React Three Fiber — optimized scene with instancing and post-processing
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF, Instances, Instance } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { useRef, useMemo } from 'react';

function InstancedTrees({ count = 500 }) {
  const positions = useMemo(() =>
    Array.from({ length: count }, () => [
      (Math.random() - 0.5) * 100,
      0,
      (Math.random() - 0.5) * 100,
    ] as [number, number, number]),
  [count]);

  return (
    <Instances limit={count}>
      <cylinderGeometry args={[0.2, 0.4, 3]} />
      <meshStandardMaterial color="#4a7c59" />
      {positions.map((pos, i) => <Instance key={i} position={pos} />)}
    </Instances>
  );
}

function GameScene() {
  return (
    <Canvas camera={{ position: [0, 10, 20], fov: 60 }} gl={{ antialias: true }}>
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      <Environment preset="sunset" />
      <InstancedTrees count={500} />
      <OrbitControls maxPolarAngle={Math.PI / 2.2} />
      <EffectComposer>
        <Bloom intensity={0.3} luminanceThreshold={0.8} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
```

---

### webgl

WebGL patterns — shader programming, GLSL, buffer management, texture handling, instanced rendering.

#### Workflow

**Step 1 — Detect WebGL usage**
Use Grep to find WebGL code: `getContext('webgl`, `gl.createShader`, `gl.createProgram`, `*.glsl`, `*.vert`, `*.frag`. Read shader files and GL initialization to understand: WebGL version, shader complexity, and buffer strategy.

**Step 2 — Audit shader and buffer efficiency**
Check for: uniforms set every frame that don't change (use UBO), separate draw calls for identical geometry (use instancing), textures not using mipmaps, missing `gl.deleteBuffer`/`gl.deleteTexture` cleanup, and shaders with expensive per-fragment branching.

**Step 3 — Emit optimized WebGL code**
Emit: WebGL2 setup with proper context attributes, VAO-based buffer management, instanced rendering for repeated geometry, and GLSL shaders with documented inputs/outputs.

#### Example

```glsl
// Vertex shader — instanced rendering with per-instance transform
#version 300 es
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in mat4 aInstanceMatrix; // per-instance (locations 2-5)

uniform mat4 uViewProjection;

out vec3 vNormal;
out vec3 vWorldPos;

void main() {
  vec4 worldPos = aInstanceMatrix * vec4(aPosition, 1.0);
  vWorldPos = worldPos.xyz;
  vNormal = mat3(transpose(inverse(aInstanceMatrix))) * aNormal;
  gl_Position = uViewProjection * worldPos;
}
```

```glsl
// Fragment shader — PBR-lite with single directional light
#version 300 es
precision highp float;

in vec3 vNormal;
in vec3 vWorldPos;
out vec4 fragColor;

uniform vec3 uLightDir;
uniform vec3 uCameraPos;
uniform vec3 uBaseColor;

void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 H = normalize(L + V);

  float diffuse = max(dot(N, L), 0.0);
  float specular = pow(max(dot(N, H), 0.0), 32.0);
  vec3 ambient = uBaseColor * 0.15;

  fragColor = vec4(ambient + uBaseColor * diffuse + vec3(specular * 0.5), 1.0);
}
```

---

### game-loops

Game loop architecture — fixed timestep, interpolation, input handling, state machines, ECS.

#### Workflow

**Step 1 — Detect game loop pattern**
Use Grep to find loop code: `requestAnimationFrame`, `setInterval.*16`, `update`, `fixedUpdate`, `deltaTime`, `gameLoop`. Read the main loop to understand: timestep strategy, update/render separation, and input handling.

**Step 2 — Audit loop correctness**
Check for: variable timestep physics (non-deterministic), no accumulator for fixed update (physics tied to framerate), input polled inside render (inconsistent), missing interpolation between fixed steps (visual stuttering), and no frame budget monitoring.

**Step 3 — Emit fixed timestep loop**
Emit: fixed timestep (60Hz) with accumulator, interpolation for smooth rendering, decoupled input handler, and frame budget monitoring.

#### Example

```typescript
// Fixed timestep game loop with interpolation
const TICK_RATE = 60;
const TICK_DURATION = 1000 / TICK_RATE;

class GameLoop {
  private accumulator = 0;
  private previousTime = 0;
  private running = false;

  constructor(
    private update: (dt: number) => void,     // fixed timestep logic
    private render: (alpha: number) => void,   // interpolated rendering
  ) {}

  start() {
    this.running = true;
    this.previousTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (currentTime: number) => {
    if (!this.running) return;
    const elapsed = Math.min(currentTime - this.previousTime, 250); // cap spiral of death
    this.previousTime = currentTime;
    this.accumulator += elapsed;

    while (this.accumulator >= TICK_DURATION) {
      this.update(TICK_DURATION / 1000); // dt in seconds
      this.accumulator -= TICK_DURATION;
    }

    const alpha = this.accumulator / TICK_DURATION; // interpolation factor [0, 1)
    this.render(alpha);
    requestAnimationFrame(this.tick);
  };

  stop() { this.running = false; }
}

// Usage
const loop = new GameLoop(
  (dt) => { world.step(dt); entities.forEach(e => e.update(dt)); },
  (alpha) => { renderer.render(scene, camera, alpha); },
);
loop.start();
```

---

### physics-engine

Physics integration — Rapier.js, rigid bodies, constraints, raycasting, collision callbacks, deterministic simulation.

#### Workflow

**Step 1 — Detect physics setup**
Use Grep to find physics libraries: `rapier`, `cannon`, `ammo`, `@dimforge/rapier3d`, `RigidBody`, `Collider`. Read physics initialization and body creation to understand: engine choice, world configuration, and collision handling.

**Step 2 — Audit physics configuration**
Check for: physics step tied to render frame (non-deterministic), missing collision groups (everything collides with everything), no sleep threshold (wasted CPU on static objects), raycasts without max distance (expensive), and missing body cleanup on entity destroy.

**Step 3 — Emit optimized physics**
Emit: Rapier.js (WASM, deterministic) setup with proper collision groups, sleep thresholds, event-driven collision callbacks, and raycasting utility.

#### Example

```typescript
// Rapier.js (WASM) — setup with collision groups and raycasting
import RAPIER from '@dimforge/rapier3d-compat';

await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

// Collision groups: player=0x0001, enemy=0x0002, ground=0x0004, projectile=0x0008
const GROUPS = { PLAYER: 0x0001, ENEMY: 0x0002, GROUND: 0x0004, PROJECTILE: 0x0008 };

// Ground — static, collides with everything
const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0));
world.createCollider(
  RAPIER.ColliderDesc.cuboid(50, 0.1, 50)
    .setCollisionGroups((GROUPS.GROUND << 16) | 0xFFFF),
  groundBody,
);

// Player — dynamic, collides with ground + enemy (not own projectiles)
const playerBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0));
world.createCollider(
  RAPIER.ColliderDesc.capsule(0.5, 0.3)
    .setCollisionGroups((GROUPS.PLAYER << 16) | (GROUPS.GROUND | GROUPS.ENEMY))
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
  playerBody,
);

// Raycast utility
function raycast(origin: RAPIER.Vector3, direction: RAPIER.Vector3, maxDist = 100) {
  const ray = new RAPIER.Ray(origin, direction);
  const hit = world.castRay(ray, maxDist, true);
  if (hit) {
    const point = ray.pointAt(hit.timeOfImpact);
    return { point, normal: hit.normal, collider: hit.collider };
  }
  return null;
}
```

---

### asset-pipeline

Game asset pipeline — glTF loading, texture compression, audio management, asset manifest, preloading.

#### Workflow

**Step 1 — Detect asset strategy**
Use Glob to find asset files: `*.gltf`, `*.glb`, `*.ktx2`, `*.basis`, `*.png` in `assets/` or `public/`. Use Grep to find loaders: `GLTFLoader`, `TextureLoader`, `KTX2Loader`, `Howler`, `Audio`. Read the loading code to understand: preloading strategy, compression, and caching.

**Step 2 — Audit asset efficiency**
Check for: uncompressed textures (PNG/JPG instead of KTX2/Basis), glTF without Draco compression, no asset manifest (scattered inline paths), missing preloader (assets load mid-gameplay causing stutters), audio files in WAV format (use OGG/MP3), and no LOD variants for 3D models.

**Step 3 — Emit asset pipeline**
Emit: asset manifest with typed entries, preloader with progress tracking, glTF loader with Draco decoder, KTX2 texture loader, and audio manager with Howler.js.

#### Example

```typescript
// Asset manifest + preloader with progress tracking
interface AssetManifest {
  models: Record<string, { url: string; draco?: boolean }>;
  textures: Record<string, { url: string; format: 'ktx2' | 'png' }>;
  audio: Record<string, { url: string; volume?: number; loop?: boolean }>;
}

const MANIFEST: AssetManifest = {
  models: {
    player: { url: '/assets/player.glb', draco: true },
    level1: { url: '/assets/level1.glb', draco: true },
  },
  textures: {
    terrain: { url: '/assets/terrain.ktx2', format: 'ktx2' },
  },
  audio: {
    bgm: { url: '/assets/bgm.ogg', volume: 0.5, loop: true },
    jump: { url: '/assets/jump.ogg', volume: 0.8 },
  },
};

class AssetLoader {
  private loaded = 0;
  private total = 0;

  async loadAll(manifest: AssetManifest, onProgress: (pct: number) => void) {
    const entries = [
      ...Object.values(manifest.models),
      ...Object.values(manifest.textures),
      ...Object.values(manifest.audio),
    ];
    this.total = entries.length;

    await Promise.all(entries.map(async (entry) => {
      await fetch(entry.url); // preload into browser cache
      this.loaded++;
      onProgress(this.loaded / this.total);
    }));
  }
}
```

---

## Connections

```
Calls → perf (L2): frame budget and rendering performance audit
Calls → asset-creator (L3): generate placeholder assets and sprites
Called By ← cook (L1): when game development task detected
Called By ← review (L2): when game code under review
```

## Tech Stack Support

| Engine | Rendering | Physics | ECS |
|--------|-----------|---------|-----|
| Three.js | WebGL2 / WebGPU | Rapier.js (WASM) | bitECS |
| React Three Fiber | Three.js (declarative) | @react-three/rapier | Custom |
| PixiJS | WebGL2 (2D) | Matter.js | Custom |
| Phaser 3 | WebGL / Canvas | Arcade / Matter | Built-in |
| Babylon.js | WebGL2 / WebGPU | Havok (WASM) | Built-in |

## Constraints

1. MUST use fixed timestep for physics — variable timestep causes non-deterministic simulation.
2. MUST dispose all GPU resources (geometries, textures, materials) on scene teardown — GPU memory leaks crash tabs.
3. MUST NOT create objects inside the render loop — allocate outside, reuse inside.
4. MUST test on target minimum hardware (mobile GPU) not just development machine.
5. MUST use compressed asset formats (Draco for geometry, KTX2/Basis for textures) — raw assets cause unacceptable load times.

## Sharp Edges

| Failure Mode | Severity | Mitigation |
|---|---|---|
| Objects created in useFrame/render loop cause GC stutters at 60fps | CRITICAL | Pre-allocate all vectors, quaternions, matrices outside the loop; reuse with `.set()` |
| GPU memory leak from undisposed textures/geometries (tab crashes after 5 minutes) | CRITICAL | Implement disposal manager; call `.dispose()` on every Three.js resource on unmount |
| Physics spiral of death: update takes longer than frame, accumulator grows unbounded | HIGH | Cap accumulator at 250ms (skip frames); reduce physics complexity if consistent |
| Shader compiles on first use causing frame drop (shader cache miss) | MEDIUM | Pre-warm shaders during loading screen; use `renderer.compile(scene, camera)` |
| Asset loading blocks first frame (white screen for 5+ seconds) | HIGH | Implement progressive loading with preloader UI; prioritize visible assets |
| Mobile GPU fails on desktop-quality shaders (WebGL context lost) | HIGH | Detect GPU tier with `detect-gpu`; provide shader LOD variants |

## Done When

- Scene renders at stable 60fps on target hardware
- Physics simulation is deterministic with fixed timestep
- All GPU resources properly disposed on cleanup
- Assets compressed and preloaded with progress indicator
- Game loop decouples update from render with interpolation
- Structured report emitted for each skill invoked

## Cost Profile

~10,000–20,000 tokens per full pack run (all 5 skills). Individual skill: ~2,000–4,000 tokens. Sonnet default. Use haiku for asset detection scans; escalate to sonnet for shader optimization and physics configuration.
