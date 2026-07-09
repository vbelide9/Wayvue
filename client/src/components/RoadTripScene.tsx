import { useMemo, useRef, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

// ── Warm Homie palette ──
const C = {
    fog: '#FBF6EE',
    road: '#403A34',
    dash: '#F6E8CE',
    ground: '#E9E0CB',
    hillA: '#E1935C', // terracotta
    hillB: '#C7A96B', // wheat
    hillC: '#A9B085', // olive
    tree: '#7E9B6B',
    trunk: '#8A6A4A',
    cloud: '#FFFFFF',
    car: '#E86A2A', // brand amber
    sun: '#F7B267',
};

const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// A gentle S-curve receding toward the horizon (−z is "away").
function useRoadCurve() {
    return useMemo(
        () =>
            new THREE.CatmullRomCurve3([
                new THREE.Vector3(0.4, 0, 9),
                new THREE.Vector3(-1.6, 0, 5),
                new THREE.Vector3(1.8, 0, 1),
                new THREE.Vector3(-1.2, 0, -4),
                new THREE.Vector3(1.4, 0, -9),
                new THREE.Vector3(-0.3, 0, -15),
                new THREE.Vector3(0.1, 0, -24),
            ]),
        [],
    );
}

// Flat ribbon geometry laid on the ground, following the curve.
function useRoadGeometry(curve: THREE.CatmullRomCurve3, halfWidth = 1.15, segments = 220) {
    return useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const pos: number[] = [];
        const idx: number[] = [];
        const up = new THREE.Vector3(0, 1, 0);
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const p = curve.getPointAt(t);
            const tan = curve.getTangentAt(t);
            const side = new THREE.Vector3().crossVectors(tan, up).normalize().multiplyScalar(halfWidth);
            pos.push(p.x + side.x, 0.02, p.z + side.z);
            pos.push(p.x - side.x, 0.02, p.z - side.z);
        }
        for (let i = 0; i < segments; i++) {
            const a = i * 2;
            idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        return geo;
    }, [curve, halfWidth, segments]);
}

function Road() {
    const curve = useRoadCurve();
    const roadGeo = useRoadGeometry(curve);
    const dashesRef = useRef<THREE.Group>(null);
    const carRef = useRef<THREE.Group>(null);
    const offset = useRef(0);
    const carProgress = useRef(0);
    const reduced = useMemo(prefersReducedMotion, []);

    const DASHES = 26;
    const dashParams = useMemo(() => Array.from({ length: DASHES }, (_, i) => i / DASHES), []);

    useFrame((_, delta) => {
        if (reduced) return;
        const dt = Math.min(delta, 0.05); // clamp so tab-refocus doesn't jump
        offset.current = (offset.current + dt * 0.14) % 1;
        carProgress.current = (carProgress.current + dt * 0.11) % 1;

        // Scroll the centre-line dashes toward the viewer for a sense of speed.
        if (dashesRef.current) {
            dashesRef.current.children.forEach((child, i) => {
                const t = (dashParams[i] + offset.current) % 1;
                const p = curve.getPointAt(t);
                child.position.set(p.x, 0.04, p.z);
                const tan = curve.getTangentAt(t);
                child.rotation.y = Math.atan2(tan.x, tan.z);
                // Fade dashes into the foggy horizon.
                const s = THREE.MathUtils.clamp((t - 0.02) * 6, 0, 1);
                child.scale.setScalar(s);
            });
        }

        // Drive the car toward the camera on its own faster loop so it sweeps
        // through the visible mid-section of the road regularly.
        if (carRef.current) {
            const u = 1 - carProgress.current; // travel toward the camera
            const p = curve.getPointAt(u);
            const tan = curve.getTangentAt(u);
            carRef.current.position.set(p.x, 0.16 + Math.sin(carProgress.current * 60) * 0.012, p.z);
            carRef.current.rotation.y = Math.atan2(-tan.x, -tan.z);
            // Shrink the car as it recedes toward the horizon.
            carRef.current.scale.setScalar(THREE.MathUtils.lerp(0.6, 1.05, u));
        }
    });

    return (
        <group>
            <mesh geometry={roadGeo} receiveShadow>
                <meshStandardMaterial color={C.road} roughness={0.9} metalness={0} side={THREE.DoubleSide} />
            </mesh>

            <group ref={dashesRef}>
                {dashParams.map((t, i) => {
                    const p = curve.getPointAt(t);
                    return (
                        <mesh key={i} position={[p.x, 0.04, p.z]}>
                            <boxGeometry args={[0.09, 0.02, 0.55]} />
                            <meshStandardMaterial color={C.dash} roughness={0.7} />
                        </mesh>
                    );
                })}
            </group>

            <group ref={carRef}>
                <Car />
            </group>
        </group>
    );
}

// A friendly low-poly car built from primitives.
function Car() {
    return (
        <group scale={0.9}>
            {/* body */}
            <mesh castShadow position={[0, 0.16, 0]}>
                <boxGeometry args={[0.5, 0.22, 0.95]} />
                <meshStandardMaterial color={C.car} roughness={0.4} metalness={0.1} />
            </mesh>
            {/* cabin */}
            <mesh castShadow position={[0, 0.34, -0.02]}>
                <boxGeometry args={[0.42, 0.2, 0.5]} />
                <meshStandardMaterial color={'#FCEBDD'} roughness={0.3} metalness={0.2} />
            </mesh>
            {/* wheels */}
            {[
                [-0.26, 0.06, 0.32],
                [0.26, 0.06, 0.32],
                [-0.26, 0.06, -0.32],
                [0.26, 0.06, -0.32],
            ].map((pos, i) => (
                <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
                    <cylinderGeometry args={[0.11, 0.11, 0.1, 16]} />
                    <meshStandardMaterial color={'#2C2620'} roughness={0.6} />
                </mesh>
            ))}
        </group>
    );
}

function Hill({ position, scale, color }: { position: [number, number, number]; scale: number; color: string }) {
    return (
        <mesh position={position} castShadow receiveShadow>
            <coneGeometry args={[scale, scale * 1.15, 5]} />
            <meshStandardMaterial color={color} roughness={1} flatShading />
        </mesh>
    );
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
    return (
        <group position={position} scale={scale}>
            <mesh position={[0, 0.18, 0]} castShadow>
                <cylinderGeometry args={[0.05, 0.07, 0.36, 6]} />
                <meshStandardMaterial color={C.trunk} roughness={1} />
            </mesh>
            <mesh position={[0, 0.55, 0]} castShadow>
                <coneGeometry args={[0.32, 0.7, 7]} />
                <meshStandardMaterial color={C.tree} roughness={1} flatShading />
            </mesh>
            <mesh position={[0, 0.85, 0]} castShadow>
                <coneGeometry args={[0.24, 0.5, 7]} />
                <meshStandardMaterial color={'#8FA878'} roughness={1} flatShading />
            </mesh>
        </group>
    );
}

function Cloud3D({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
    const ref = useRef<THREE.Group>(null);
    const reduced = useMemo(prefersReducedMotion, []);
    const drift = useMemo(() => Math.random() * 10, []);
    useFrame(({ clock }) => {
        if (reduced || !ref.current) return;
        ref.current.position.x = position[0] + Math.sin(clock.elapsedTime * 0.05 + drift) * 1.2;
    });
    return (
        <group ref={ref} position={position} scale={scale}>
            {[
                [0, 0, 0, 0.55],
                [0.5, -0.06, 0, 0.42],
                [-0.5, -0.05, 0, 0.4],
                [0.15, 0.14, 0.1, 0.36],
            ].map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]}>
                    <sphereGeometry args={[r, 16, 16]} />
                    <meshStandardMaterial color={C.cloud} roughness={1} />
                </mesh>
            ))}
        </group>
    );
}

function Sun() {
    return (
        <mesh position={[-6.5, 6, -22]}>
            <circleGeometry args={[1.9, 48]} />
            <meshBasicMaterial color={C.sun} transparent opacity={0.85} />
        </mesh>
    );
}

// Subtle pointer parallax + idle sway on the camera.
function CameraRig() {
    const { camera, pointer } = useThree();
    const reduced = useMemo(prefersReducedMotion, []);
    useFrame(({ clock }) => {
        const px = reduced ? 0 : pointer.x;
        const py = reduced ? 0 : pointer.y;
        const sway = reduced ? 0 : Math.sin(clock.elapsedTime * 0.22) * 0.2;
        camera.position.x += (px * 1.2 + sway - camera.position.x) * 0.04;
        camera.position.y += (6.4 - py * 0.6 - camera.position.y) * 0.04;
        camera.lookAt(0, 0.2, -7);
    });
    return null;
}

function Scene() {
    return (
        <>
            <fog attach="fog" args={[C.fog, 14, 46]} />
            <hemisphereLight args={['#FFF4E0', C.ground, 0.9]} />
            <ambientLight intensity={0.35} />
            <directionalLight position={[-6, 8, 4]} intensity={1.7} color="#FFE6BE" />

            <Sun />

            {/* Ground */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6]} receiveShadow>
                <planeGeometry args={[120, 90]} />
                <meshStandardMaterial color={C.ground} roughness={1} />
            </mesh>

            <Road />

            {/* Rolling hills flanking the road horizon */}
            <Hill position={[-6, 1.6, -16]} scale={4.0} color={C.hillA} />
            <Hill position={[7, 2.0, -19]} scale={4.8} color={C.hillC} />
            <Hill position={[-11, 1.4, -21]} scale={3.4} color={C.hillB} />
            <Hill position={[3.2, 1.3, -14]} scale={3.0} color={C.hillB} />
            <Hill position={[12, 1.8, -15]} scale={4.0} color={C.hillA} />
            <Hill position={[-2.5, 1.1, -18]} scale={2.8} color={C.hillC} />

            {/* Roadside trees */}
            {[
                [-3.2, -2, 0.9],
                [3.4, 1.5, 0.8],
                [-4.4, -6, 1.1],
                [4.8, -4, 1.0],
                [-2.6, -10, 0.9],
                [3.9, -9, 1.05],
                [-5.2, -13, 1.2],
                [5.6, -14, 1.15],
            ].map((t, i) => (
                <Tree key={i} position={[t[0], 0, t[1]]} scale={t[2]} />
            ))}

            {/* Drifting clouds — high in the sky so they frame, not crowd */}
            <Float speed={1.2} rotationIntensity={0} floatIntensity={0.5}>
                <Cloud3D position={[-7, 7.4, -20]} scale={0.9} />
            </Float>
            <Float speed={1} rotationIntensity={0} floatIntensity={0.45}>
                <Cloud3D position={[5.5, 8.2, -22]} scale={1.1} />
            </Float>
            <Float speed={1.4} rotationIntensity={0} floatIntensity={0.6}>
                <Cloud3D position={[10, 6.6, -18]} scale={0.75} />
            </Float>

            <CameraRig />
        </>
    );
}

export function RoadTripScene({ className = '' }: { className?: string }) {
    return (
        <div className={className} aria-hidden="true">
            <Canvas
                dpr={[1, 1.75]}
                camera={{ position: [0, 6.4, 6.5], fov: 46 }}
                gl={{ antialias: true, alpha: true }}
                style={{ pointerEvents: 'none' }}
            >
                <Suspense fallback={null}>
                    <Scene />
                </Suspense>
            </Canvas>
        </div>
    );
}

export default RoadTripScene;
