"use client";
import { useEffect, useRef, useState } from "react";
import {
  advanceStoryTruck,
  backgroundGateTraffic,
  DISPATCH_CYCLE,
  entryRoute,
  gateTraffic,
  portGateX,
  PORT_TRAFFIC,
} from "@/lib/domain/port-traffic";

// A18: procedural, illustrative port. No real port, camera or barrier connection.
export default function PortScene({
  chapter,
  paused,
  alternate,
  failure,
}: {
  chapter: number;
  paused: boolean;
  alternate: boolean;
  failure: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const state = useRef({ chapter, paused, alternate, failure });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    state.current = { chapter, paused, alternate, failure };
  }, [chapter, paused, alternate, failure]);
  useEffect(() => {
    let alive = true,
      frame = 0;
    let release: (() => void) | undefined;
    import("three")
      .then((T) => {
        if (!alive || !host.current) return;
        const el = host.current;
        let renderer: InstanceType<typeof T.WebGLRenderer>;
        try {
          renderer = new T.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "low-power",
          });
        } catch {
          return;
        }
        renderer.localClippingEnabled = true;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        el.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(36, 1, 0.1, 180);
        camera.position.set(29, 26, 34);
        const world = new T.Group();
        scene.add(world);
        scene.add(new T.HemisphereLight(0xffffff, 0x7f8e9e, 1.65));
        const sun = new T.DirectionalLight(0xffe6c5, 3.1);
        sun.position.set(-20, 25, 14);
        sun.castShadow = true;
        sun.shadow.normalBias = 0.025;
        Object.assign(sun.shadow.camera, {
          left: -24,
          right: 24,
          top: 24,
          bottom: -24,
        });
        sun.shadow.bias = -0.001;
        scene.add(sun);
        const colors = {
          navy: 0x142d4e,
          petrol: 0x087f8c,
          light: 0xf4f7fa,
          road: 0x48525a,
          teal: 0x80bdc1,
          sand: 0x788c95,
          orange: 0xa95232,
        };
        const concrete = 0x9da4a5;
        const steel = 0x617280;
        const glass = 0x274957;
        const rubber = 0x24292c;
        const safety = 0xe3ab47;
        const water = 0x367988;
        const gritCanvas = document.createElement("canvas");
        gritCanvas.width = gritCanvas.height = 128;
        const gritContext = gritCanvas.getContext("2d");
        if (gritContext) {
          const pixels = gritContext.createImageData(128, 128);
          let seed = 2026;
          for (let i = 0; i < pixels.data.length; i += 4) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const grain = 174 + (seed >>> 26);
            pixels.data.set([grain, grain, grain, 255], i);
          }
          gritContext.putImageData(pixels, 0, 0);
        }
        const grit = new T.CanvasTexture(gritCanvas);
        grit.colorSpace = T.SRGBColorSpace;
        grit.wrapS = grit.wrapT = T.RepeatWrapping;
        grit.repeat.set(5, 3);
        const materials = new Map<
          number,
          InstanceType<typeof T.MeshStandardMaterial>
        >();
        function material(color: number) {
          if (!materials.has(color))
            materials.set(
              color,
              new T.MeshStandardMaterial({
                color,
                roughness: color === water ? 0.32 : color === glass ? 0.22 : 0.8,
                metalness: color === steel ? 0.35 : 0,
                map: color === colors.road || color === concrete ? grit : null,
              }),
            );
          return materials.get(color)!;
        }
        // Batch fixed structures and paint by material. Moving parts stay independent.
        const unitBox = new T.BoxGeometry(1, 1, 1);
        const batches = new Map<number, InstanceType<typeof T.Matrix4>[]>();
        const transform = new T.Object3D();
        function box(
          w: number,
          h: number,
          d: number,
          x: number,
          y: number,
          z: number,
          color: number,
          parent: InstanceType<typeof T.Group> = world,
          tilt = 0,
        ) {
          if (parent === world) {
            transform.position.set(x, y, z);
            transform.scale.set(w, h, d);
            transform.rotation.z = tilt;
            transform.updateMatrix();
            const matrices = batches.get(color) ?? [];
            matrices.push(transform.matrix.clone());
            batches.set(color, matrices);
            return;
          }
          const mesh = new T.Mesh(unitBox, material(color));
          mesh.position.set(x, y, z);
          mesh.scale.set(w, h, d);
          mesh.rotation.z = tilt;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          parent.add(mesh);
        }
        box(28, 0.9, 23, 0, -0.7, 0, colors.sand);
        box(28, 0.2, 3.8, 0, -0.12, -9.6, water);
        box(28, 0.15, 19.2, 0, 0, 1.9, concrete);
        // A20: same footprint; a clear apron separates entry from the yard.
        box(28, 0.04, 3.6, 0, 0.1, PORT_TRAFFIC.approachZ, colors.road);
        box(26, 0.03, 2.1, 0, 0.1, -3.15, colors.road);
        // The far end of each lane leads under the terminal inspection canopy.
        box(23.6, 0.18, 1.03, 0, 1.59, -3.93, steel);
        box(23.6, 1.47, 0.15, 0, 0.83, -4.38, colors.navy);
        box(23.65, 0.095, 0.075, 0, 1.59, -3.39, safety);
        for (let gate = 1; gate <= 8; gate++) {
          const x = portGateX(gate);
          box(0.12, 1.44, 0.16, x - 1.14, 0.84, -3.48, steel);
          box(0.2, 0.25, 0.23, x - 1.14, 0.24, -3.48, safety);
          box(0.92, 0.045, 0.19, x, 1.49, -3.61, colors.light);
          box(1.5, 0.07, 0.67, x, 1.69, -3.97, colors.navy);
          for (const offset of [-0.72, 0.72])
            box(0.07, 0.009, 1.15, x + offset, 0.13, -3.62, safety);
        }
        // The entry gantry marks the cut edge of the access road.
        const entryX = PORT_TRAFFIC.entryEdgeX - 0.21;
        for (const z of [6.75, 10.45]) {
          box(0.18, 1.76, 0.18, entryX, 1, z, steel);
          box(0.24, 0.38, 0.24, entryX, 0.3, z, safety);
        }
        box(0.19, 0.21, 3.9, entryX, 1.95, PORT_TRAFFIC.approachZ, colors.navy);
        box(0.21, 0.035, 1.45, entryX, 1.94, PORT_TRAFFIC.approachZ, safety);
        // Perimeter fencing frames the access road without masking traffic.
        box(25.8, 0.045, 0.035, 0, 0.64, 11.23, steel);
        box(25.8, 0.035, 0.035, 0, 0.39, 11.23, steel);
        for (let x = -12.9; x <= 13; x += 1.72)
          box(0.042, 0.61, 0.042, x, 0.39, 11.23, steel);
        box(27.9, 0.23, 0.24, 0, 0.03, -7.66, steel);
        for (let x = -13; x <= 13; x += 2) {
          box(0.2, 0.2, 0.25, x, 0.13, -7.47, rubber);
          box(0.06, 0.008, 1.5, x, 0.078, -6.7, steel);
        }
        for (const z of [-10.95, -10.6, -9.05, -8.62])
          for (let x = -12; x <= 12; x += 3.7)
            box(1.45, 0.005, 0.018, x + (z % 1), -0.016, z, 0x558996);
        function arrow(x: number, z: number, rotation = 0) {
          const shape = new T.Shape();
          shape.moveTo(-0.55, 0);
          shape.lineTo(0.02, 0.3);
          shape.lineTo(0.02, 0.11);
          shape.lineTo(0.6, 0.11);
          shape.lineTo(0.6, -0.11);
          shape.lineTo(0.02, -0.11);
          shape.lineTo(0.02, -0.3);
          shape.closePath();
          const paint = new T.Mesh(
            new T.ShapeGeometry(shape),
            material(0xffffff),
          );
          paint.rotation.x = -Math.PI / 2;
          const group = new T.Group();
          group.position.set(x, 0.155, z);
          group.rotation.y = rotation;
          group.add(paint);
          world.add(group);
        }
        for (const x of [-6, 1, 8]) arrow(x, 8.6);
        for (let x = -13; x < 14; x += 1.5)
          box(0.65, 0.015, 0.055, x, 0.14, 10.15, 0xffffff);
        const barriers: InstanceType<typeof T.Group>[] = [];
        const signals: InstanceType<typeof T.Mesh>[] = [];
        const redSignal = new T.MeshBasicMaterial({ color: 0xb84435 });
        const greenSignal = new T.MeshBasicMaterial({ color: 0x51df9e });
        for (let i = 0; i < 8; i++) {
          const x = portGateX(i + 1);
          const gateZ = 1.1;
          box(1.9, 0.03, 10.6, x, 0.12, 2.2, colors.road);
          for (const edge of [-0.83, 0.83]) {
            box(0.045, 0.012, 3.7, x + edge, 0.145, 4.95, 0xffffff);
            box(0.045, 0.012, 2.4, x + edge, 0.145, -1.2, 0xffffff);
          }
          arrow(x, 5.25, -Math.PI / 2);
          box(0.12, 1.9, 0.2, x - 0.98, 1, gateZ, colors.navy);
          box(0.12, 1.9, 0.2, x + 0.98, 1, gateZ, colors.navy);
          box(
            2.3,
            0.32,
            1.05,
            x,
            2,
            gateZ,
            i < 3 ? colors.petrol : i < 6 ? colors.navy : colors.teal,
          );
          box(2.42, 0.08, 1.18, x, 2.19, gateZ, steel);
          box(0.95, 0.08, 1.9, x + 1.34, 0.13, gateZ + 0.2, concrete);
          box(0.67, 1.02, 0.86, x + 1.34, 0.68, gateZ + 0.21, colors.light);
          box(0.78, 0.1, 0.97, x + 1.34, 1.23, gateZ + 0.21, steel);
          box(0.48, 0.32, 0.02, x + 1.34, 0.94, gateZ + 0.65, glass);
          box(0.02, 0.32, 0.52, x + 1, 0.94, gateZ + 0.21, glass);
          box(0.23, 0.83, 0.26, x - 0.98, 0.54, gateZ + 0.65, steel);
          for (const xOffset of [-1.15, 1.15])
            box(0.095, 0.46, 0.095, x + xOffset, 0.38, gateZ + 1.02, safety);
          box(1.66, 0.009, 0.1, x, 0.145, gateZ + 1.23, colors.light);
          const arm = new T.Group();
          arm.position.set(x - 0.98, 0.95, gateZ + 0.65);
          world.add(arm);
          box(1.9, 0.09, 0.12, 0.95, 0, 0, 0xf7fafb, arm);
          for (let n = 0; n < 4; n++)
            box(0.2, 0.1, 0.13, 0.3 + n * 0.45, 0, 0, 0xa93e33, arm);
          barriers.push(arm);
          box(0.22, 0.28, 0.18, x - 0.98, 1.47, gateZ + 0.15, rubber);
          const signal = new T.Mesh(unitBox, redSignal);
          signal.scale.set(0.12, 0.12, 0.025);
          signal.position.set(x - 0.98, 1.47, gateZ + 0.25);
          signals.push(signal);
          world.add(signal);
          // Printed gate number on a canvas texture.
          const label = document.createElement("canvas");
          label.width = 128;
          label.height = 64;
          const ctx = label.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#142d4e";
            ctx.fillRect(9, 3, 110, 58);
            ctx.strokeStyle = "#c6d9df";
            ctx.lineWidth = 2;
            ctx.strokeRect(9, 3, 110, 58);
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 46px Arial";
            ctx.textAlign = "center";
            ctx.fillText(String(i + 1).padStart(2, "0"), 64, 47);
            const texture = new T.CanvasTexture(label);
            const plate = new T.Mesh(
              new T.PlaneGeometry(0.87, 0.37),
              new T.MeshBasicMaterial({ map: texture, transparent: true }),
            );
            plate.position.set(x, 2, gateZ + 0.545);
            world.add(plate);
          }
        }
        // ISO-style container frames, quay gantries and a moored feeder ship.
        for (let col = 0; col < 6; col++)
          for (let row = 0; row < 2; row++) {
            const x = -10.5 + col * 3.8,
              z = -5 - row * 1.6;
            const height = col % 3 === 0 ? 2 : 1;
            for (let level = 0; level < height; level++) {
              const color = [
                colors.petrol,
                colors.navy,
                colors.orange,
                0xc6d9df,
              ][(col + row + level) % 4];
              const y = 0.56 + level * 0.88;
              box(2.65, 0.85, 1.15, x, y, z, color);
              for (const edge of [-1, 1]) {
                box(2.68, 0.046, 1.17, x, y + edge * 0.405, z, color);
                box(0.036, 0.66, 0.025, x + 1.342, y, z + edge * 0.28, steel);
              }
              box(0.026, 0.12, 0.2, x + 1.35, y + 0.22, z + 0.32, colors.light);
              for (let rib = 0; rib < 9; rib++)
                box(
                  0.045,
                  0.73,
                  0.045,
                  x - 1.15 + rib * 0.29,
                  0.56 + level * 0.88,
                  z + 0.59,
                  color,
                );
            }
          }
        for (const x of [-9, 1, 10]) {
          for (const side of [-1, 1]) {
            box(0.23, 4.35, 0.27, x + side * 1.02, 2.26, -7.1, steel, world, side * 0.08);
            box(0.43, 0.23, 0.54, x + side * 1.18, 0.23, -7.1, rubber);
            box(0.2, 0.37, 3.8, x + side * 0.84, 4.45, -8.25, colors.navy);
            box(0.085, 1.65, 0.085, x + side * 0.67, 5.17, -7.55, steel);
          }
          box(2.3, 0.29, 0.28, x, 2.02, -7.1, steel);
          for (const side of [-1, 1]) {
            box(0.09, 1.46, 0.13, x + side * 0.57, 3.77, -7.09, steel, world, side * 0.65);
            box(0.11, 0.15, 1.42, x + side * 0.84, 4.7, -9.25, safety);
          }
          box(2.05, 0.21, 0.26, x, 5.96, -7.55, colors.navy);
          box(1.95, 0.25, 0.4, x, 4.42, -9.58, colors.navy);
          for (const dx of [-0.28, 0.28])
            box(0.025, 2.3, 0.025, x + dx, 3.19, -9.55, rubber);
          box(0.8, 0.14, 0.45, x, 2.03, -9.55, safety);
        }
        // Control building stays outside the truck lanes.
        box(2.08, 0.16, 2.5, 11.85, 0.15, -4.75, steel);
        box(1.9, 1.22, 2.3, 11.85, 0.83, -4.75, colors.light);
        box(2.08, 0.14, 2.48, 11.85, 1.5, -4.75, colors.navy);
        for (const dx of [-0.54, 0, 0.54])
          box(0.45, 0.38, 0.024, 11.85 + dx, 1.1, -3.59, glass);
        box(0.33, 0.67, 0.025, 12.35, 0.64, -3.58, steel);
        const ship = new T.Group();
        ship.position.set(-2, 0.05, -9.7);
        world.add(ship);
        const hull = new T.Shape();
        hull.moveTo(-5.4, -0.72);
        hull.lineTo(-4.95, -1.05);
        hull.lineTo(4.18, -1.05);
        hull.quadraticCurveTo(5.06, -0.82, 5.62, 0);
        hull.quadraticCurveTo(5.06, 0.82, 4.18, 1.05);
        hull.lineTo(-4.95, 1.05);
        hull.lineTo(-5.4, 0.72);
        hull.closePath();
        const shipHull = new T.Mesh(
          new T.ExtrudeGeometry(hull, {
            depth: 0.61,
            bevelEnabled: false,
            curveSegments: 6,
          }),
          material(colors.navy),
        );
        shipHull.rotation.x = -Math.PI / 2;
        shipHull.position.y = -0.21;
        shipHull.castShadow = true;
        shipHull.receiveShadow = true;
        ship.add(shipHull);
        box(8.9, 0.12, 1.92, -0.2, 0.47, 0, steel, ship);
        box(1.38, 1.18, 1.56, -4, 1.07, 0, colors.light, ship);
        box(1.45, 0.24, 1.64, -4, 1.54, 0, glass, ship);
        box(1.55, 0.1, 1.7, -4, 1.71, 0, colors.light, ship);
        box(0.09, 0.65, 0.09, -4.1, 2, 0, steel, ship);
        for (let i = 0; i < 5; i++)
          for (const z of [-0.43, 0.43])
            box(
              1.35, 0.57, 0.74,
              -2.55 + i * 1.5, 0.81, z,
              i % 2 ? colors.orange : colors.petrol,
              ship,
            );
        const tireGeometry = new T.CylinderGeometry(0.24, 0.24, 0.16, 12);
        const hubGeometry = new T.CylinderGeometry(0.12, 0.12, 0.035, 10);
        const truckMaterials = new Map<InstanceType<typeof T.Material>, InstanceType<typeof T.Material>>();
        const laneClipping = [
          new T.Plane(new T.Vector3(-1, 0, 0), PORT_TRAFFIC.entryEdgeX),
          new T.Plane(new T.Vector3(0, 0, 1), -PORT_TRAFFIC.exitEdgeZ),
        ];
        function truck(color: number) {
          const group = new T.Group();
          box(1.12, 0.8, 2.45, 0, 0.72, -0.5, color, group);
          box(1.1, 0.16, 3.5, 0, 0.35, 0.05, colors.navy, group);
          box(1.15, 0.85, 1.05, 0, 0.65, 1.3, 0xffffff, group);
          box(1.02, 0.34, 0.03, 0, 0.86, 1.84, glass, group);
          box(0.74, 0.2, 0.035, 0, 0.56, 1.85, rubber, group);
          box(1.18, 0.11, 0.1, 0, 0.35, 1.84, steel, group);
          box(0.8, 0.07, 0.7, 0, 1.1, 1.26, colors.light, group);
          for (const x of [-0.59, 0.59]) {
            box(0.025, 0.29, 0.53, x, 0.86, 1.38, glass, group);
            box(0.17, 0.045, 0.045, x * 1.14, 0.91, 1.73, steel, group);
            box(0.07, 0.18, 0.09, x * 1.3, 0.91, 1.73, rubber, group);
            box(0.025, 0.46, 0.56, x, 0.5, 1.37, colors.light, group);
          }
          for (const x of [-0.3, 0.3])
            box(0.12, 0.09, 0.035, x, 0.42, -1.73, 0x9e302b, group);
          for (const x of [-0.4, 0.4])
            box(0.18, 0.12, 0.035, x, 0.48, 1.85, 0xf4dca6, group);
          for (let rib = 0; rib < 7; rib++)
            for (const x of [-0.57, 0.57])
              box(0.025, 0.68, 0.04, x, 0.73, -1.5 + rib * 0.33, color, group);
          for (const x of [-0.62, 0.62])
            for (const z of [-1.1, 0.8, 1.4]) {
              const tire = new T.Mesh(
                tireGeometry,
                material(rubber),
              );
              tire.rotation.z = Math.PI / 2;
              tire.position.set(x, 0.3, z);
              tire.castShadow = true;
              const hub = new T.Mesh(hubGeometry, material(steel));
              hub.rotation.z = Math.PI / 2;
              hub.position.set(x * 1.14, 0.3, z);
              group.add(tire, hub);
            }
          world.add(group);
          group.scale.setScalar(0.62);
          // Trucks pass into view at the road edge and disappear behind the canopy.
          group.traverse((obj) => {
            if (!(obj instanceof T.Mesh) || Array.isArray(obj.material)) return;
            const base = obj.material;
            if (!truckMaterials.has(base)) {
              const clipped = base.clone();
              clipped.clippingPlanes = laneClipping;
              clipped.clipShadows = true;
              truckMaterials.set(base, clipped);
            }
            obj.material = truckMaterials.get(base)!;
          });
          return group;
        }
        const storyTruck = truck(colors.petrol);
        const backgroundTrucks = [
          colors.orange,
          0x789799,
          colors.navy,
          0x805d48,
          0xc6d9df,
        ].map(truck);
        function moveTruck(
          truck: typeof storyTruck,
          pose: ReturnType<typeof gateTraffic>,
        ) {
          truck.position.set(pose.x, 0.1, pose.z);
          truck.rotation.y = pose.heading;
        }
        for (const x of [-13, 13])
          for (const z of [-2.4, 3.5, 10.8]) {
            box(0.08, 3, 0.08, x, 1.5, z, colors.navy);
            box(0.7, 0.08, 0.25, x + 0.25, 3, z, 0xffffff);
          }
        for (const [color, matrices] of batches) {
          const mesh = new T.InstancedMesh(
            unitBox,
            material(color),
            matrices.length,
          );
          matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
          mesh.castShadow = ![colors.road, concrete, water, 0xffffff].includes(color);
          mesh.receiveShadow = true;
          world.add(mesh);
        }
        let compact = false;
        const resize = new ResizeObserver(() => {
          const { width, height } = el.getBoundingClientRect();
          const nextCompact = width < 600;
          if (!sun.shadow.map || nextCompact !== compact) {
            compact = nextCompact;
            sun.shadow.map?.dispose();
            sun.shadow.map = null;
            sun.shadow.mapSize.setScalar(compact ? 512 : 1024);
          }
          renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, compact ? 1.2 : 1.6),
          );
          renderer.setSize(width, height, false);
          camera.aspect = width / Math.max(1, height);
          camera.updateProjectionMatrix();
        });
        resize.observe(el);
        const pointer = { x: 0, y: 0 };
        const onPointer = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
          pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
        };
        el.addEventListener("pointermove", onPointer);
        const lost = (e: Event) => {
          e.preventDefault();
          setReady(false);
        };
        renderer.domElement.addEventListener("webglcontextlost", lost);
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const positions = [
          [29, 26, 34],
          [25, 20, 31],
          [31, 25, 30],
          [21, 19, 26],
          [25, 24, 23],
          [15, 15, 23],
          [20, 19, 28],
          [28, 29, 36],
        ];
        const target = new T.Vector3(),
          look = new T.Vector3(0, 0, 0);
        let phase = 7;
        let previous = 0;
        const story = { gate: 1, elapsed: phase, nextDispatch: DISPATCH_CYCLE };
        function animate(time: number) {
          if (!alive) return;
          frame = requestAnimationFrame(animate);
          if (document.hidden || time - previous < (compact ? 32 : 16)) return;
          const delta = Math.min((time - previous) / 1000, 0.05);
          const cameraBlend = 1 - Math.exp(-delta * 2.2);
          previous = time;
          const s = state.current;
          const motionDelta = s.paused || reduced ? 0 : delta;
          phase += motionDelta;
          const p = positions[s.chapter] ?? positions[0];
          target.set(
            p[0] + (reduced ? 0 : pointer.x),
            p[1],
            p[2] + (reduced ? 0 : pointer.y),
          );
          if (compact) target.multiplyScalar(1.18);
          camera.position.lerp(target, reduced ? 1 : cameraBlend);
          look.y = compact ? -0.8 : 0;
          camera.lookAt(look);
          advanceStoryTruck(
            story, phase, motionDelta, s.alternate ? 2 : 1,
            s.chapter >= 5 && !s.failure,
          );
          const activeGate = reduced ? (s.alternate ? 2 : 1) : story.gate;
          const activeRoute = entryRoute(activeGate);
          const storyPose = gateTraffic(
            activeRoute,
            reduced
              ? s.chapter >= 5 && !s.failure
                ? activeRoute.releaseTime + 1.1
                : activeRoute.stopTime
              : story.elapsed,
          );
          moveTruck(storyTruck, storyPose);
          const background = backgroundGateTraffic(phase);
          background.forEach((pose, index) =>
            moveTruck(backgroundTrucks[index], pose),
          );
          barriers.forEach((arm, i) => {
            const gate = i + 1;
            const open = gate === activeGate
              ? storyPose.open
              : (background.find((pose) => pose.gate === gate)?.open ?? false);
            arm.rotation.z = T.MathUtils.lerp(
              arm.rotation.z,
              open ? Math.PI / 2 : 0,
              reduced ? 1 : 1 - Math.exp(-motionDelta * 4),
            );
            signals[i].material = arm.rotation.z > 1.35 ? greenSignal : redSignal;
          });
          ship.position.x = -2 + (reduced ? 0 : Math.sin(phase * 0.12) * 0.3);
          renderer.render(scene, camera);
        }
        frame = requestAnimationFrame(animate);
        setReady(true);
        release = () => {
          cancelAnimationFrame(frame);
          resize.disconnect();
          el.removeEventListener("pointermove", onPointer);
          renderer.domElement.removeEventListener("webglcontextlost", lost);
          const geometries = new Set<InstanceType<typeof T.BufferGeometry>>();
          const usedMaterials = new Set<InstanceType<typeof T.Material>>([
            ...materials.values(), ...truckMaterials.values(), redSignal, greenSignal,
          ]);
          const textures = new Set<InstanceType<typeof T.Texture>>([grit]);
          scene.traverse((obj) => {
            if (obj instanceof T.Mesh) {
              geometries.add(obj.geometry);
              if (obj instanceof T.InstancedMesh) obj.dispose();
              const mats = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];
              mats.forEach((m) => {
                if ("map" in m && m.map instanceof T.Texture) textures.add(m.map);
                usedMaterials.add(m);
              });
            }
          });
          geometries.forEach((geometry) => geometry.dispose());
          textures.forEach((texture) => texture.dispose());
          usedMaterials.forEach((material) => material.dispose());
          sun.shadow.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
      })
      .catch(() => {
        if (alive) setReady(false);
      });
    return () => {
      alive = false;
      release?.();
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      className="port-scene"
      ref={host}
      data-ready={ready}
      aria-label="مجسم ميناء توضيحي ثلاثي الأبعاد، ثماني بوابات وشاحنات وحاويات"
      role="img"
    >
      {!ready ? (
        <div className="port-fallback" aria-hidden>
          <span>SMARTGATE</span>
          <div>
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i}>{i + 1}</i>
            ))}
          </div>
          <b>╱ ╱ ╱</b>
        </div>
      ) : null}
    </div>
  );
}
