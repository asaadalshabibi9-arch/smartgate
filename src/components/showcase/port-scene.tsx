"use client";
import { useEffect, useRef, useState } from "react";
import { portTraffic } from "@/lib/domain/port-traffic";

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
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.setClearColor(0x000000, 0);
        el.appendChild(renderer.domElement);
        const scene = new T.Scene();
        const camera = new T.PerspectiveCamera(36, 1, 0.1, 180);
        camera.position.set(29, 26, 34);
        const world = new T.Group();
        scene.add(world);
        scene.add(new T.HemisphereLight(0xffffff, 0x7898a9, 3));
        const sun = new T.DirectionalLight(0xfff5df, 4.5);
        sun.position.set(-15, 30, 15);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
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
          road: 0x879ca8,
          teal: 0x80bdc1,
          sand: 0xd7e2e4,
          orange: 0xd9a579,
        };
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
                roughness: 0.7,
                metalness: 0.08,
              }),
            );
          return materials.get(color)!;
        }
        function box(
          w: number,
          h: number,
          d: number,
          x: number,
          y: number,
          z: number,
          color: number,
          parent: InstanceType<typeof T.Group> = world,
        ) {
          const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material(color));
          mesh.position.set(x, y, z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          parent.add(mesh);
          return mesh;
        }
        box(28, 0.9, 23, 0, -0.7, 0, colors.sand);
        box(28, 0.2, 3.8, 0, -0.12, -9.6, 0x8fcad0);
        box(28, 0.15, 19.2, 0, 0, 1.9, colors.light);
        // A20: same footprint; a deep, clear apron separates entry from the yard.
        box(27.6, 0.04, 3.6, 0, 0.1, 8.6, colors.road);
        box(26, 0.03, 2.1, 0, 0.1, -3.15, 0xb3c4ca);
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
        for (let i = 0; i < 8; i++) {
          const x = -10.5 + i * 3;
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
          box(0.57, 0.95, 0.8, x + 1.13, 0.57, gateZ + 1, 0xffffff);
          box(0.4, 0.28, 0.02, x + 1.13, 0.78, gateZ + 1.41, colors.navy);
          const arm = new T.Group();
          arm.position.set(x - 0.98, 0.95, gateZ + 0.65);
          world.add(arm);
          box(1.9, 0.09, 0.12, 0.95, 0, 0, 0xf7fafb, arm);
          for (let n = 0; n < 4; n++)
            box(0.2, 0.1, 0.13, 0.3 + n * 0.45, 0, 0, colors.petrol, arm);
          barriers.push(arm);
          box(
            0.15,
            0.4,
            0.15,
            x - 0.98,
            1.45,
            gateZ + 0.15,
            i === 3 || i === 7 ? 0xcc6b64 : 0x57b995,
          );
          // Printed gate number on a canvas texture.
          const label = document.createElement("canvas");
          label.width = 128;
          label.height = 64;
          const ctx = label.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 42px Arial";
            ctx.textAlign = "center";
            ctx.fillText(String(i + 1).padStart(2, "0"), 64, 47);
            const texture = new T.CanvasTexture(label);
            const plate = new T.Mesh(
              new T.PlaneGeometry(0.7, 0.35),
              new T.MeshBasicMaterial({ map: texture, transparent: true }),
            );
            plate.position.set(x, 2, gateZ + 0.54);
            world.add(plate);
          }
        }
        // Container stacks, ribs, cranes and a small ship form the miniature's silhouette.
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
              box(2.65, 0.85, 1.15, x, 0.56 + level * 0.88, z, color);
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
        for (const x of [-10, -1, 8]) {
          box(0.25, 5.5, 0.3, x, 2.75, -7.4, colors.navy);
          box(4.8, 0.23, 0.25, x + 1.3, 5.5, -7.4, colors.navy);
          box(0.19, 1.65, 0.19, x + 1.3, 6.3, -7.4, colors.petrol);
          const cable = box(0.035, 2.6, 0.035, x + 3.3, 4.1, -7.4, colors.navy);
          cable.castShadow = false;
          box(0.6, 0.15, 0.4, x + 3.3, 2.8, -7.4, colors.petrol);
        }
        // Small control building leaves the central forecourt unobstructed.
        box(1.9, 1.3, 2.3, 11.6, 0.73, -5.5, 0xffffff);
        box(2.1, 0.16, 2.5, 11.6, 1.46, -5.5, colors.navy);
        box(1.5, 0.38, 0.025, 11.6, 1.05, -4.33, colors.petrol);
        const ship = new T.Group();
        ship.position.set(-2, 0.05, -9.7);
        world.add(ship);
        box(11, 0.8, 2.1, 0, 0.1, 0, colors.navy, ship);
        box(1.8, 1.5, 1.6, -4, 1, 0, 0xffffff, ship);
        for (let i = 0; i < 4; i++)
          box(
            1.6,
            0.9,
            1.4,
            -1.8 + i * 1.8,
            0.95,
            0,
            i % 2 ? colors.orange : colors.petrol,
            ship,
          );
        function truck(color: number) {
          const group = new T.Group();
          box(1.12, 0.8, 2.45, 0, 0.72, -0.5, color, group);
          box(1.1, 0.16, 3.5, 0, 0.35, 0.05, colors.navy, group);
          box(1.15, 0.85, 1.05, 0, 0.65, 1.3, 0xffffff, group);
          box(1.02, 0.35, 0.03, 0, 0.84, 1.84, colors.navy, group);
          for (const x of [-0.4, 0.4])
            box(0.18, 0.12, 0.035, x, 0.48, 1.85, 0xf4dca6, group);
          for (let rib = 0; rib < 7; rib++)
            for (const x of [-0.57, 0.57])
              box(0.025, 0.68, 0.04, x, 0.73, -1.5 + rib * 0.33, color, group);
          for (const x of [-0.62, 0.62])
            for (const z of [-1.1, 0.8, 1.4]) {
              const tire = new T.Mesh(
                new T.CylinderGeometry(0.24, 0.24, 0.16, 10),
                material(colors.navy),
              );
              tire.rotation.z = Math.PI / 2;
              tire.position.set(x, 0.3, z);
              group.add(tire);
            }
          world.add(group);
          group.scale.setScalar(0.62);
          // Independent truck materials: fading a loop never fades port structures.
          const own = new Map<
            InstanceType<typeof T.Material>,
            InstanceType<typeof T.Material>
          >();
          group.traverse((obj) => {
            if (obj instanceof T.Mesh && !Array.isArray(obj.material)) {
              const base = obj.material;
              if (!own.has(base)) {
                const copy = base.clone();
                copy.transparent = true;
                own.set(base, copy);
              }
              obj.material = own.get(base)!;
            }
          });
          return { group, materials: [...own.values()] };
        }
        const fleet = [
          truck(colors.petrol),
          truck(colors.orange),
          truck(colors.navy),
          truck(0x9fc4ce),
        ];
        for (const x of [-13, 13])
          for (const z of [-2.4, 3.5, 10.8]) {
            box(0.08, 3, 0.08, x, 1.5, z, colors.navy);
            box(0.7, 0.08, 0.25, x + 0.25, 3, z, 0xffffff);
          }
        const resize = new ResizeObserver(() => {
          const { width, height } = el.getBoundingClientRect();
          renderer.setSize(width, height);
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
        let phase = 0,
          trafficTime = 1.2,
          transition = 0,
          previous = 0;
        let trafficMode = { alternate: false, crossing: false, blocked: false };
        function animate(time: number) {
          if (!alive) return;
          frame = requestAnimationFrame(animate);
          if (document.hidden || time - previous < 32) return;
          const delta = Math.min((time - previous) / 1000, 0.05);
          previous = time;
          const s = state.current;
          if (!s.paused && !reduced) {
            phase += delta;
            trafficTime += delta;
          }
          const p = positions[s.chapter] ?? positions[0];
          target.set(
            p[0] + (reduced ? 0 : pointer.x),
            p[1],
            p[2] + (reduced ? 0 : pointer.y),
          );
          camera.position.lerp(target, reduced ? 1 : 0.035);
          camera.lookAt(look);
          const desired = {
            alternate: s.alternate,
            crossing: s.chapter >= 5 && !s.failure,
            blocked: s.chapter >= 5 && s.failure,
          };
          const changing = Object.keys(desired).some(
            (key) =>
              desired[key as keyof typeof desired] !==
              trafficMode[key as keyof typeof trafficMode],
          );
          if (changing) {
            transition =
              reduced || s.paused ? 1 : Math.min(1, transition + delta / 0.35);
            if (transition >= 1) {
              trafficMode = desired;
              trafficTime = reduced || s.paused ? 5 : 0;
              transition = 0;
            }
          } else if (!changing) transition = 0;
          const traffic = portTraffic(
            reduced ? 5 : trafficTime,
            trafficMode.alternate,
            trafficMode.crossing,
            trafficMode.blocked,
          );
          fleet.forEach(({ group, materials }, index) => {
            const pose = traffic.trucks[index];
            group.position.set(pose.x, 0.1, pose.z);
            group.rotation.y = pose.heading;
            const opacity = reduced ? 1 : traffic.opacity * (1 - transition);
            group.visible = opacity > 0.01;
            materials.forEach((m) => {
              m.opacity = opacity;
            });
          });
          barriers.forEach((arm, i) => {
            const open =
              trafficMode.crossing &&
              traffic.trucks[0].distance >= traffic.route.stopDistance - 2 &&
              i === (trafficMode.alternate ? 1 : 0);
            arm.rotation.z = T.MathUtils.lerp(
              arm.rotation.z,
              open ? Math.PI / 2 : 0,
              0.06,
            );
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
          scene.traverse((obj) => {
            if (obj instanceof T.Mesh) {
              obj.geometry.dispose();
              const mats = Array.isArray(obj.material)
                ? obj.material
                : [obj.material];
              mats.forEach((m) => {
                if ("map" in m && m.map instanceof T.Texture) m.map.dispose();
                m.dispose();
              });
            }
          });
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
