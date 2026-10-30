"use client";
import { useEffect, useRef, useState } from "react";

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
        box(28, 0.2, 8, 0, -0.12, -8, 0x8fcad0);
        box(28, 0.15, 15, 0, 0, 3.6, colors.light);
        // Approach road, cross road and independent entry lanes.
        box(28, 0.04, 3.2, 0, 0.1, 5, colors.road);
        box(3.6, 0.05, 7, -8, 0.11, 9, colors.road);
        for (let x = -13; x < 14; x += 1.6)
          box(0.7, 0.015, 0.07, x, 0.14, 5, 0xffffff);
        const barriers: InstanceType<typeof T.Group>[] = [];
        for (let i = 0; i < 8; i++) {
          const x = -10.5 + i * 3;
          box(2.3, 0.03, 7, x, 0.12, 1, colors.road);
          box(0.12, 2.05, 0.2, x - 1.05, 1, 0, colors.navy);
          box(0.12, 2.05, 0.2, x + 1.05, 1, 0, colors.navy);
          box(
            2.5,
            0.42,
            1.15,
            x,
            2.1,
            0,
            i < 3 ? colors.petrol : i < 6 ? colors.navy : colors.teal,
          );
          box(0.7, 1.1, 0.9, x + 0.92, 0.62, 1.15, 0xffffff);
          box(0.5, 0.35, 0.02, x + 0.92, 0.9, 1.61, colors.navy);
          const arm = new T.Group();
          arm.position.set(x - 1, 1, 0.8);
          world.add(arm);
          box(1.9, 0.09, 0.12, 0.95, 0, 0, 0xf7fafb, arm);
          for (let n = 0; n < 4; n++)
            box(0.2, 0.1, 0.13, 0.3 + n * 0.45, 0, 0, colors.petrol, arm);
          barriers.push(arm);
          box(
            0.15,
            0.4,
            0.15,
            x - 1.1,
            1.45,
            0.8,
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
            plate.position.set(x, 2.1, 0.59);
            world.add(plate);
          }
        }
        // Container stacks, ribs, cranes and a small ship form the miniature's silhouette.
        for (let col = 0; col < 6; col++)
          for (let row = 0; row < 2; row++) {
            const x = -10 + col * 3.7,
              z = -3.3 - row * 1.65;
            const height = col % 3 === 0 ? 2 : 1;
            for (let level = 0; level < height; level++) {
              const color = [
                colors.petrol,
                colors.navy,
                colors.orange,
                0xc6d9df,
              ][(col + row + level) % 4];
              box(3.2, 1.05, 1.35, x, 0.7 + level * 1.08, z, color);
              for (let rib = 0; rib < 10; rib++)
                box(
                  0.045,
                  0.9,
                  0.045,
                  x - 1.42 + rib * 0.31,
                  0.7 + level * 1.08,
                  z + 0.69,
                  color,
                );
            }
          }
        for (const x of [-8, 2, 10]) {
          box(0.25, 6, 0.3, x, 3, -7, colors.navy);
          box(5, 0.23, 0.25, x + 1.4, 6, -7, colors.navy);
          box(0.19, 2, 0.19, x + 1.4, 7, -7, colors.petrol);
          const cable = box(0.035, 3, 0.035, x + 3.4, 4.4, -7, colors.navy);
          cable.castShadow = false;
          box(0.6, 0.15, 0.4, x + 3.4, 3, -7, colors.petrol);
        }
        const ship = new T.Group();
        ship.position.set(-2, 0.05, -9.5);
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
          box(1.2, 0.7, 2.4, 0, 0.65, -0.4, color, group);
          box(1.15, 0.85, 1.05, 0, 0.65, 1.3, 0xffffff, group);
          box(1.02, 0.35, 0.03, 0, 0.84, 1.84, colors.navy, group);
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
          return group;
        }
        const hero = truck(colors.petrol);
        const queued = [
          truck(colors.orange),
          truck(colors.navy),
          truck(0x9fc4ce),
        ];
        queued.forEach((g, i) => {
          g.position.set(-8, 0, 8 + i * 3);
          g.scale.setScalar(0.7);
        });
        hero.scale.setScalar(0.75);
        for (const x of [-13, 13])
          for (const z of [-1, 3, 8]) {
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
          previous = 0;
        function animate(time: number) {
          if (!alive) return;
          frame = requestAnimationFrame(animate);
          if (document.hidden || time - previous < 32) return;
          const delta = Math.min((time - previous) / 1000, 0.05);
          previous = time;
          const s = state.current;
          if (!s.paused && !reduced) phase += delta;
          const p = positions[s.chapter] ?? positions[0];
          target.set(
            p[0] + (reduced ? 0 : pointer.x),
            p[1],
            p[2] + (reduced ? 0 : pointer.y),
          );
          camera.position.lerp(target, reduced ? 1 : 0.035);
          camera.lookAt(look);
          const chosen = s.alternate ? -7.5 : -10.5;
          const u = reduced ? 0.45 : (phase % 14) / 14;
          if (s.chapter < 2) {
            hero.position.set(-8, 0, 8 - u * 4);
            hero.rotation.y = Math.PI;
          } else if (u < 0.45) {
            hero.position.set(-8 + ((chosen + 8) * u) / 0.45, 0, 5);
            hero.rotation.y = -Math.PI / 2;
          } else {
            hero.position.set(
              chosen,
              0,
              5 -
                ((u - 0.45) / 0.55) * (s.chapter >= 5 && !s.failure ? 8 : 3.4),
            );
            hero.rotation.y = Math.PI;
          }
          barriers.forEach((arm, i) => {
            const open =
              s.chapter >= 5 && !s.failure && i === (s.alternate ? 1 : 0);
            arm.rotation.z = T.MathUtils.lerp(
              arm.rotation.z,
              open ? -Math.PI / 2 : 0,
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
