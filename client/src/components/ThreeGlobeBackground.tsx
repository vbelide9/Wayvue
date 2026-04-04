import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

function ParticleSphere() {
    const pointsRef = useRef<THREE.Points>(null);

    // Generate random points on a sphere
    const count = 3000;
    const radius = 3;

    const [positions, colors] = useMemo(() => {
        const pos = new Float32Array(count * 3);
        const col = new Float32Array(count * 3);
        const colorA = new THREE.Color('#3b82f6'); // Electric blue
        const colorB = new THREE.Color('#8b5cf6'); // Purple/Pink

        for (let i = 0; i < count; i++) {
            // Point on sphere distribution
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            const r = radius + (Math.random() * 0.2 - 0.1); // slight surface noise

            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);

            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;

            // Mix colors
            const mixedColor = colorA.clone().lerp(colorB, Math.random());
            col[i * 3] = mixedColor.r;
            col[i * 3 + 1] = mixedColor.g;
            col[i * 3 + 2] = mixedColor.b;
        }
        return [pos, col];
    }, []);

    useFrame((state, delta) => {
        if (!pointsRef.current) return;

        // Smooth, slow rotation
        pointsRef.current.rotation.y += delta * 0.05;
        pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1;

        // Advanced mouse parallax (eased)
        const targetX = (state.pointer.x * 0.5);
        const targetY = (state.pointer.y * 0.5);
        pointsRef.current.position.x += (targetX - pointsRef.current.position.x) * 0.05;
        pointsRef.current.position.y += (targetY - pointsRef.current.position.y) * 0.05;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
                <bufferAttribute
                    attach="attributes-color"
                    args={[colors, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.03}
                vertexColors
                transparent
                // Additive blending creates the glowing neon effect when particles overlap
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
            {/* Inner dark core to block particles from the other side, creating solid depth */}
            <mesh>
                <sphereGeometry args={[radius * 0.98, 32, 32]} />
                <meshBasicMaterial color="#05050A" />
            </mesh>
        </points>
    );
}

// Background floating stars/dust
function Dust() {
    const dustRef = useRef<THREE.Points>(null);
    const dustCount = 1000;

    const dustPositions = useMemo(() => {
        const pos = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 20 - 5; // Push back a bit
        }
        return pos;
    }, []);

    useFrame((state) => {
        if (!dustRef.current) return;
        dustRef.current.rotation.y = state.clock.elapsedTime * 0.01;
        dustRef.current.rotation.x = state.clock.elapsedTime * 0.005;
    });

    return (
        <points ref={dustRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[dustPositions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial size={0.02} color="#ffffff" transparent opacity={0.3} sizeAttenuation />
        </points>
    );
}

export function ThreeGlobeBackground() {
    return (
        <div className="absolute inset-0 z-[-1] pointer-events-none overflow-hidden bg-[#05050A]">
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                <fog attach="fog" args={['#05050A', 5, 20]} />
                <ParticleSphere />
                <Dust />
                <EffectComposer multisampling={0}>
                    <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={1.5} />
                </EffectComposer>
            </Canvas>
            {/* Deep gradient fade at bottom to blend into content */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </div>
    );
}
