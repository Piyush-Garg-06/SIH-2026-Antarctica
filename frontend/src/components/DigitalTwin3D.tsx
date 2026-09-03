import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Anomaly Severity System
// ---------------------------------------------------------------------------
// A single, shared classifier + pulsing-glow hook used by every department
// mesh (Admin Core, Living Module, Science Labs, Water Utility, Logistics
// Warehouse, Generators, Fuel Tanks, and generic procedural buildings) so
// anomalies are surfaced consistently across the whole station, not just on
// the handful of assets that happened to have bespoke glow logic before.
export type AnomalySeverity = 'nominal' | 'warning' | 'critical';

export const ANOMALY_GLOW_COLOR: Record<AnomalySeverity, string> = {
  nominal: '#000000',
  warning: '#f59e0b', // amber — degraded / attention needed
  critical: '#ef4444', // red — critical / immediate action needed
};

/**
 * Classifies any live telemetry object (generator, equipment, or building)
 * into a severity tier so every department can react to anomalies uniformly.
 */
export function getAnomalySeverity(liveStatus: any, emergencyMode: boolean = false): AnomalySeverity {
  if (emergencyMode) return 'critical';
  if (!liveStatus) return 'nominal';

  const status = liveStatus.status;
  if (status === 'critical' || status === 'offline' || status === 'cooling_issue') return 'critical';
  if (status === 'degraded' || status === 'high_load') return 'warning';

  if (typeof liveStatus.health === 'number') {
    if (liveStatus.health < 40) return 'critical';
    if (liveStatus.health < 75) return 'warning';
  }

  if (typeof liveStatus.temp === 'number') {
    if (liveStatus.temp > 90) return 'critical';
    if (liveStatus.temp > 78) return 'warning';
  }

  return 'nominal';
}

/**
 * Attaches a per-frame pulsing emissive glow to a mesh's standard material
 * whenever its asset is in a warning/critical state. Critical pulses faster
 * and brighter than warning so severity reads at a glance from across the
 * 3D twin without needing to open the inspector panel.
 */
function useAnomalyPulse(
  materialRef: React.MutableRefObject<THREE.MeshStandardMaterial | null | undefined>,
  severity: AnomalySeverity,
  interactionOverrideActive: boolean
) {
  useFrame((state) => {
    const mat = materialRef.current;
    if (!mat || severity === 'nominal' || interactionOverrideActive) return;
    const speed = severity === 'critical' ? 3.4 : 1.6;
    const baseIntensity = severity === 'critical' ? 0.28 : 0.14;
    const depth = severity === 'critical' ? 0.4 : 0.22;
    const pulse = (Math.sin(state.clock.elapsedTime * speed) + 1) / 2; // 0..1
    mat.emissive.set(ANOMALY_GLOW_COLOR[severity]);
    mat.emissiveIntensity = baseIntensity + pulse * depth;
  });
}

// Helper functions for procedural textures (panel seams, snow crystals, compacted tire tracks)
let globalIndustrialPanelTexture: THREE.CanvasTexture | null = null;
const getIndustrialPanelTexture = () => {
  if (!globalIndustrialPanelTexture && typeof window !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Base texture color (neutral white so standard materials can tint it)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);

      // Vertical metal sheet seams
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(62, 0, 4, 256);
      ctx.fillRect(126, 0, 4, 256);
      ctx.fillRect(190, 0, 4, 256);
      ctx.fillRect(254, 0, 4, 256);

      // Horizontal sheet seams
      ctx.fillRect(0, 126, 256, 4);

      // Draw industrial rivets along the seams
      ctx.fillStyle = '#606060';
      for (let y = 10; y < 256; y += 20) {
        if (Math.abs(y - 128) > 8) {
          ctx.fillRect(58, y, 3, 3);
          ctx.fillRect(68, y, 3, 3);
          ctx.fillRect(122, y, 3, 3);
          ctx.fillRect(132, y, 3, 3);
          ctx.fillRect(186, y, 3, 3);
          ctx.fillRect(196, y, 3, 3);
          ctx.fillRect(250, y, 3, 3);
        }
      }
    }
    globalIndustrialPanelTexture = new THREE.CanvasTexture(canvas);
    globalIndustrialPanelTexture.wrapS = THREE.RepeatWrapping;
    globalIndustrialPanelTexture.wrapT = THREE.RepeatWrapping;
    globalIndustrialPanelTexture.repeat.set(4, 3);
  }
  return globalIndustrialPanelTexture;
};

let globalSnowTexture: THREE.CanvasTexture | null = null;
const getSnowTexture = () => {
  if (!globalSnowTexture && typeof window !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Base snow color
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 512, 512);

      // Wind-swept sastrugi streaks (soft diagonal lines)
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const len = Math.random() * 90 + 30;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + len * 0.15); // soft wind direction
        ctx.stroke();
      }

      // Specular ice crystal highlights
      for (let i = 0; i < 1500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const val = Math.random();
        ctx.fillStyle = val > 0.45 ? 'rgba(255, 255, 255, 0.95)' : 'rgba(148, 163, 184, 0.4)';
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    globalSnowTexture = new THREE.CanvasTexture(canvas);
    globalSnowTexture.wrapS = THREE.RepeatWrapping;
    globalSnowTexture.wrapT = THREE.RepeatWrapping;
    globalSnowTexture.repeat.set(16, 16);
  }
  return globalSnowTexture;
};

let globalPathwayTexture: THREE.CanvasTexture | null = null;
const getPathwayTexture = () => {
  if (!globalPathwayTexture && typeof window !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Compacted dirty road base
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, 128, 256);

      // Fine road noise/pebbles
      for (let i = 0; i < 1500; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 256;
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(100, 116, 139, 0.45)' : 'rgba(255, 255, 255, 0.55)';
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      // Repeating dual tire tracks/tread marks
      ctx.fillStyle = '#94a3b8';
      for (let y = 0; y < 256; y += 16) {
        // Left tracks
        ctx.fillRect(16, y, 14, 5);
        ctx.fillRect(22, y + 8, 14, 5);
        // Right tracks
        ctx.fillRect(98, y, 14, 5);
        ctx.fillRect(92, y + 8, 14, 5);
      }
    }
    globalPathwayTexture = new THREE.CanvasTexture(canvas);
    globalPathwayTexture.wrapS = THREE.RepeatWrapping;
    globalPathwayTexture.wrapT = THREE.RepeatWrapping;
    globalPathwayTexture.repeat.set(1, 6);
  }
  return globalPathwayTexture;
};

// Compass dial needle rotation sync
const CompassController: React.FC = () => {
  useFrame((state) => {
    const angle = Math.atan2(state.camera.position.x, state.camera.position.z);
    const deg = (angle * 180) / Math.PI;
    const needleEl = document.getElementById('compass-dial-needle');
    if (needleEl) {
      needleEl.style.transform = `rotate(${-deg}deg)`;
    }
  });
  return null;
};

interface AssetData {
  id: string;
  name: string;
  type: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  telemetryField: string;
}

interface DigitalTwin3DProps {
  telemetry: any;
  selectedAssetId: string | null;
  onAssetSelect: (asset: any) => void;
  activeScenario?: string;
  emergencyMode?: boolean;
  isNight?: boolean;
}

// 1. Camera Glide Controller Component for focus transition
const CameraController: React.FC<{
  targetPos: THREE.Vector3;
  targetLook: THREE.Vector3;
}> = ({ targetPos, targetLook }) => {
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
  }, [targetPos, targetLook]);

  useFrame((state) => {
    if (!active.current) return;

    const dist = state.camera.position.distanceTo(targetPos);
    if (dist < 0.1) {
      active.current = false;
      return;
    }

    state.camera.position.lerp(targetPos, 0.08);
    const controls = state.controls as any;
    if (controls) {
      controls.target.lerp(targetLook, 0.08);
      controls.update();
    }
  });

  return null;
};

// 2. Generator Exhaust Smoke Particles
const GeneratorSmoke: React.FC<{ position: [number, number, number]; running: boolean }> = ({ position, running }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 30;
  const positions = useRef(new Float32Array(particleCount * 3));
  const ages = useRef(new Float32Array(particleCount));

  useEffect(() => {
    for (let i = 0; i < particleCount; i++) {
      positions.current[i * 3] = position[0] + (Math.random() - 0.5) * 0.05;
      positions.current[i * 3 + 1] = position[1] + Math.random() * 1.2;
      positions.current[i * 3 + 2] = position[2] + (Math.random() - 0.5) * 0.05;
      ages.current[i] = Math.random() * 2.0;
    }
  }, [position]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;
    if (!posAttr) return;

    for (let i = 0; i < particleCount; i++) {
      if (!running) {
        posAttr.setXYZ(i, 0, -50, 0);
        continue;
      }

      let y = posAttr.getY(i);
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);

      ages.current[i] += delta;

      // Rise up and drift slightly with polar wind
      y += delta * 1.8;
      x -= delta * 0.5;
      z += delta * 0.15;

      if (ages.current[i] > 1.8 || y > position[1] + 2.5) {
        ages.current[i] = 0;
        y = position[1];
        x = position[0] + (Math.random() - 0.5) * 0.1;
        z = position[2] + (Math.random() - 0.5) * 0.1;
      }

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#94a3b8" size={0.16} transparent opacity={running ? 0.35 : 0} sizeAttenuation />
    </points>
  );
};

// 3. Tower Flashing Beacon
const TowerWarningLight: React.FC<{ position: [number, number, number]; color?: string }> = ({ position, color = '#ef4444' }) => {
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (lightRef.current) {
      lightRef.current.intensity = (Math.sin(state.clock.getElapsedTime() * 5.0) + 1.0) * 1.2;
    }
  });
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight ref={lightRef} color={color} distance={8} intensity={1} />
    </group>
  );
};

// 4. Structural Stilts with Diagonal Engineering Braces
const Stilts: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  height?: number;
}> = ({ position, size, height = 0.8 }) => {
  const stiltPositions = [
    [position[0] - size[0] / 2 + 0.18, position[2] - size[2] / 2 + 0.18],
    [position[0] + size[0] / 2 - 0.18, position[2] - size[2] / 2 + 0.18],
    [position[0] - size[0] / 2 + 0.18, position[2] + size[2] / 2 - 0.18],
    [position[0] + size[0] / 2 - 0.18, position[2] + size[2] / 2 - 0.18],
  ];

  return (
    <group>
      {stiltPositions.map(([x, z], idx) => {
        const bottomY = position[1] - size[1] / 2 - height;
        const topY = position[1] - size[1] / 2;
        return (
          <group key={idx}>
            {/* Main Support Leg */}
            <mesh position={[x, (topY + bottomY) / 2, z]} castShadow>
              <cylinderGeometry args={[0.08, 0.08, height]} />
              <meshStandardMaterial color="#475569" metalness={0.95} roughness={0.15} />
            </mesh>
            {/* Footpad anchor */}
            <mesh position={[x, bottomY, z]}>
              <cylinderGeometry args={[0.22, 0.22, 0.08, 8]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
      })}
      {/* Diagonal cross bracing for wind reinforcement */}
      <mesh position={[position[0], position[1] - size[1] / 2 - height / 2, (stiltPositions[0][1] + stiltPositions[2][1]) / 2]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, size[0] * 1.15]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>
      <mesh position={[position[0], position[1] - size[1] / 2 - height / 2, (stiltPositions[0][1] + stiltPositions[2][1]) / 2]} rotation={[0, 0, -Math.PI / 4]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, size[0] * 1.15]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>
    </group>
  );
};

// 5. Connecting Utility Pipings & Animated Flow Indicators
const PipeBridge: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color?: string;
  flowActive?: boolean;
  flowColor?: string;
}> = ({ start, end, color = '#64748b', flowActive = true, flowColor = '#0ea5e9' }) => {
  const startVec = new THREE.Vector3(...start);
  const endVec = new THREE.Vector3(...end);
  const distance = startVec.distanceTo(endVec);
  const center = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);

  const direction = new THREE.Vector3().subVectors(endVec, startVec).normalize();
  const up = new THREE.Vector3(0, 1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);

  const dotRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (dotRef.current && flowActive) {
      const t = (state.clock.getElapsedTime() * 0.4) % 1.0;
      const currentPos = new THREE.Vector3().lerpVectors(startVec, endVec, t);
      dotRef.current.position.copy(currentPos);
    }
  });

  return (
    <group>
      {/* Insulated Primary Pipe */}
      <mesh position={[center.x, center.y - 0.1, center.z]} quaternion={quaternion} castShadow>
        <cylinderGeometry args={[0.07, 0.07, distance]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Conduit brackets/support poles */}
      {[0.25, 0.5, 0.75].map((t, idx) => {
        const supportPos = new THREE.Vector3().lerpVectors(startVec, endVec, t);
        return (
          <mesh key={idx} position={[supportPos.x, (supportPos.y - 0.2) / 2, supportPos.z]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, supportPos.y - 0.2]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>
        );
      })}
      {/* Animated utility flow dot indicator */}
      {flowActive && (
        <mesh ref={dotRef}>
          <sphereGeometry args={[0.13, 8, 8]} />
          <meshBasicMaterial color={flowColor} />
        </mesh>
      )}
    </group>
  );
};

// 6. Fluttering Indian Tricolor Flag
const WavingIndianFlag: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const flagRef = useRef<THREE.Mesh>(null);

  const flagTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FF9933';
      ctx.fillRect(0, 0, 128, 32);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 32, 128, 32);
      ctx.fillStyle = '#138808';
      ctx.fillRect(0, 64, 128, 32);

      // Ashoka Chakra
      ctx.strokeStyle = '#000080';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(64, 48, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const angle = (i * Math.PI) / 12;
        ctx.moveTo(64, 48);
        ctx.lineTo(64 + Math.cos(angle) * 8, 48 + Math.sin(angle) * 8);
      }
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    if (flagRef.current) {
      const geometry = flagRef.current.geometry as THREE.PlaneGeometry;
      const posAttr = geometry.attributes.position;
      const time = state.clock.getElapsedTime();
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        // Multi-frequency organic flutter for polar winds
        const wave = Math.sin(x * 3.4 - time * 8.5) * 0.07 * (x + 0.6) + Math.cos(y * 2.2 + time * 4.5) * 0.03 * x;
        posAttr.setZ(i, wave);
      }
      posAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 2.5, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 5.0]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.95} />
      </mesh>
      <mesh ref={flagRef} position={[0.6, 4.4, 0]} castShadow>
        <planeGeometry args={[1.2, 0.8, 12, 12]} />
        <meshStandardMaterial map={flagTexture} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
};

// 7. Dynamic Antarctic Terrain & Compacted Roads
const AntarcticTerrain: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const terrainGeometry = useMemo(() => {
    // Increased vertex density (96x96) for high-fidelity sastrugi wind ripples
    const geo = new THREE.PlaneGeometry(120, 120, 96, 96);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Multi-frequency fractal FBM equations for glacier drifts, dunes, and fine sastrugi
      let y = Math.sin(x * 0.08) * Math.cos(z * 0.07) * 2.0;    // main glacier swell
      y += Math.sin(x * 0.02) * Math.cos(z * 0.02) * 5.0;       // distant polar ridges
      y += Math.sin(x * 0.55 + z * 0.35) * 0.16;                // sastrugi wind-ripples
      y += Math.cos(x * 0.9 - z * 0.9) * 0.08;                  // fine snow dune texture

      const dist = Math.sqrt(x * x + z * z);
      if (dist < 15) {
        // Smooth transition to make the station compound flat so modules sit perfectly
        const factor = dist / 15;
        y *= (factor * factor);
      }

      pos.setY(i, y - 0.22);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <group>
      <mesh geometry={terrainGeometry} receiveShadow>
        <meshStandardMaterial
          color={isNight ? '#475569' : '#ffffff'}
          map={getSnowTexture() || undefined}
          bumpMap={getSnowTexture() || undefined}
          bumpScale={0.08}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>

      {/* Compacted utility snow pathways & vehicle tracks */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 2.6]} receiveShadow>
        <planeGeometry args={[19, 9.5]} />
        <meshStandardMaterial
          map={getPathwayTexture() || undefined}
          bumpMap={getPathwayTexture() || undefined}
          bumpScale={0.03}
          roughness={0.85}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-4, -0.2, 0.5]} receiveShadow>
        <planeGeometry args={[4.2, 8.2]} />
        <meshStandardMaterial
          map={getPathwayTexture() || undefined}
          bumpMap={getPathwayTexture() || undefined}
          bumpScale={0.03}
          roughness={0.85}
        />
      </mesh>
    </group>
  );
};

// 8. Distant Glacier Cliffs/Mountains
const AntarcticMountains: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  return (
    <group position={[0, -2, 0]}>
      {/* Layered jagged mountain peaks */}
      <mesh position={[-38, 8, -38]} rotation={[0, 0.4, 0]}>
        <coneGeometry args={[16, 26, 5]} />
        <meshStandardMaterial
          color={isNight ? '#1e293b' : '#cbd5e1'}
          emissive={isNight ? '#0b1329' : '#e0f2fe'}
          emissiveIntensity={isNight ? 0.3 : 0.15}
          roughness={0.8}
          flatShading
        />
      </mesh>
      <mesh position={[40, 6, -30]} rotation={[0, -0.3, 0]}>
        <coneGeometry args={[14, 20, 5]} />
        <meshStandardMaterial
          color={isNight ? '#1e293b' : '#e2e8f0'}
          emissive={isNight ? '#090d16' : '#f0f9ff'}
          emissiveIntensity={isNight ? 0.25 : 0.1}
          roughness={0.8}
          flatShading
        />
      </mesh>
      <mesh position={[4, 10, -48]} rotation={[0, 0.15, 0]}>
        <coneGeometry args={[22, 32, 5]} />
        <meshStandardMaterial
          color={isNight ? '#111827' : '#cbd5e1'}
          emissive={isNight ? '#0b1329' : '#e0f2fe'}
          emissiveIntensity={isNight ? 0.35 : 0.2}
          roughness={0.8}
          flatShading
        />
      </mesh>
      <mesh position={[-44, 4, 22]} rotation={[0, 1.1, 0]}>
        <coneGeometry args={[12, 16, 5]} />
        <meshStandardMaterial color={isNight ? '#1e293b' : '#cbd5e1'} roughness={0.85} flatShading />
      </mesh>
      <mesh position={[35, 6, 25]} rotation={[0, -0.8, 0]}>
        <coneGeometry args={[10, 14, 5]} />
        <meshStandardMaterial color={isNight ? '#1e293b' : '#cbd5e1'} roughness={0.85} flatShading />
      </mesh>
    </group>
  );
};

// 9. Helipad Facility
const Helipad: React.FC = () => {
  return (
    <group position={[5.8, 0.02, 7.8]}>
      {/* Octagon platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[1.7, 1.9, 0.08, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} metalness={0.2} />
      </mesh>
      {/* H marker */}
      <group position={[0, 0.05, 0]}>
        <mesh position={[-0.4, 0, 0]}>
          <boxGeometry args={[0.15, 0.01, 0.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.4, 0, 0]}>
          <boxGeometry args={[0.15, 0.01, 0.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.8, 0.01, 0.15]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>
      {/* Perimeter green lights */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => {
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * 1.6;
        const z = Math.sin(rad) * 1.6;
        return (
          <group key={idx} position={[x, 0.05, z]}>
            <mesh>
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshBasicMaterial color="#10b981" />
            </mesh>
            <pointLight color="#10b981" intensity={0.6} distance={2.0} />
          </group>
        );
      })}
    </group>
  );
};

// 10. Snow groomer PistenBully Service Vehicle
const PistenBullyVehicle: React.FC = () => {
  const warningLightRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (warningLightRef.current) {
      warningLightRef.current.intensity = (Math.sin(state.clock.getElapsedTime() * 10.0) + 1.0) * 1.8;
    }
  });

  return (
    <group position={[-4.5, 0.15, 7.5]} rotation={[0, -0.4, 0]}>
      {/* Tracks */}
      <mesh position={[-0.45, 0.08, 0]} castShadow>
        <boxGeometry args={[0.22, 0.2, 1.25]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[0.45, 0.08, 0]} castShadow>
        <boxGeometry args={[0.22, 0.2, 1.25]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Industrial Chassis and red body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.82, 0.28, 1.0]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Frosted cabin glass */}
      <mesh position={[0, 0.54, 0.12]} castShadow>
        <boxGeometry args={[0.72, 0.22, 0.56]} />
        <meshStandardMaterial color="#0f172a" roughness={0.1} transparent opacity={0.8} />
      </mesh>
      {/* Rotating amber hazard beacon on cabin */}
      <mesh position={[0, 0.68, 0.12]}>
        <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
        <meshStandardMaterial color="#f97316" emissive="#f97316" />
      </mesh>
      <pointLight ref={warningLightRef} position={[0, 0.72, 0.12]} color="#f97316" distance={6} intensity={1.5} />

      {/* Front plow */}
      <mesh position={[0, 0.12, 0.74]} rotation={[-0.2, 0, 0]} castShadow>
        <boxGeometry args={[1.3, 0.2, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
};

// 11. Satellite SATCOM Tracking Dish
const SatcomDish: React.FC<{ position: [number, number, number]; status: string }> = ({ position, status }) => {
  const dishGroupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (dishGroupRef.current) {
      if (status === 'nominal') {
        dishGroupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.08) * 0.28;
        dishGroupRef.current.rotation.x = -0.4 + Math.sin(state.clock.getElapsedTime() * 0.15) * 0.05;
      } else {
        dishGroupRef.current.rotation.y = state.clock.getElapsedTime() * 1.6;
        dishGroupRef.current.rotation.x = -0.7 + Math.cos(state.clock.getElapsedTime() * 1.0) * 0.2;
      }
    }
  });

  return (
    <group position={position}>
      {/* Lattice steel support column */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 3.0, 4]} />
        <meshStandardMaterial color="#475569" metalness={0.85} wireframe />
      </mesh>
      {/* Rotor hub */}
      <mesh position={[0, 3.05, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.2, 8]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>
      {/* Motor & Parabolic Dish */}
      <group ref={dishGroupRef} position={[0, 3.25, 0]}>
        <mesh position={[0, 0.15, 0.2]} rotation={[0.4, 0, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.45]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.25, 0.45]} rotation={[Math.PI / 3, 0, 0]} castShadow>
          <cylinderGeometry args={[1.0, 0.08, 0.2, 18, 1, true]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.75} side={THREE.DoubleSide} roughness={0.3} />
        </mesh>
        {/* Signal feedback horn */}
        <mesh position={[0, 0.65, 0.7]} rotation={[Math.PI / 3, 0, 0]}>
          <coneGeometry args={[0.06, 0.26, 8]} />
          <meshBasicMaterial color="#0ea5e9" />
        </mesh>
      </group>
    </group>
  );
};

// 12. Meteorological Anemometer / Comm Tower (Detailed Lattice structure)
const CommTower: React.FC<{ position: [number, number, number]; windSpeed: number }> = ({ position, windSpeed }) => {
  const rotorRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (rotorRef.current) {
      rotorRef.current.rotation.y = state.clock.getElapsedTime() * (windSpeed * 0.16 + 0.5);
    }
  });

  return (
    <group position={position}>
      {/* Main Tall Lattice Mast */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.25, 4.4, 4]} />
        <meshStandardMaterial color="#475569" metalness={0.9} wireframe />
      </mesh>
      {/* Secondary outer supports */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.35, 2.2, 4]} />
        <meshStandardMaterial color="#334155" metalness={0.9} wireframe />
      </mesh>
      {/* Horizontal warning bars */}
      <mesh position={[0, 3.8, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.05, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 2.0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 8]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* Weather sensors platform */}
      <group position={[0, 4.4, 0]}>
        <mesh>
          <cylinderGeometry args={[0.25, 0.25, 0.1, 8]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Anemometer Rotor */}
        <group ref={rotorRef} position={[0, 0.3, 0]}>
          <mesh>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
            <group key={i} rotation={[0, angle, 0]}>
              <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.012, 0.012, 0.4]} />
                <meshStandardMaterial color="#475569" />
              </mesh>
              <mesh position={[0.38, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <sphereGeometry args={[0.09, 8, 8, 0, Math.PI]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
};

// 13. Admin Control Module (High-fidelity detailed industrial panels)
const AdminCore: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
  emergencyMode: boolean;
}> = ({ asset, isSelected, liveStatus, onClick, isNight, emergencyMode }) => {
  const [hovered, setHovered] = useState(false);
  const anomalySeverity = getAnomalySeverity(liveStatus, emergencyMode);
  const fanRef = useRef<THREE.Mesh>(null);
  const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  useAnomalyPulse(bodyMaterialRef, anomalySeverity, isSelected || hovered);

  useFrame((state) => {
    if (fanRef.current) {
      fanRef.current.rotation.y = state.clock.getElapsedTime() * 8.0;
    }
  });

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Stilts foundation legs with cross-bracing */}
      <Stilts position={[0, 0, 0]} size={asset.size} height={0.65} />

      {/* Raised steel deck platform */}
      <mesh position={[0, -asset.size[1] / 2, 0]} receiveShadow>
        <boxGeometry args={[asset.size[0] + 0.3, 0.1, asset.size[2] + 0.3]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Main Cabin Pod */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={asset.size} />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={asset.color}
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.035}
          roughness={0.35}
          metalness={0.6}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.35 : anomalySeverity === 'warning' ? 0.18 : 0}
        />
      </mesh>

      {/* Exterior Structural Ribs (breaks up the boxy shape) */}
      {[-asset.size[0] / 2, 0, asset.size[0] / 2].map((x, i) => (
        <group key={i}>
          {/* Front Ribs */}
          <mesh position={[x, 0, asset.size[2] / 2 + 0.04]} castShadow>
            <boxGeometry args={[0.06, asset.size[1] + 0.05, 0.08]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
          {/* Back Ribs */}
          <mesh position={[x, 0, -asset.size[2] / 2 - 0.04]} castShadow>
            <boxGeometry args={[0.06, asset.size[1] + 0.05, 0.08]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Sloped solar panel roof array */}
      <group position={[0, asset.size[1] / 2 + 0.15, 0]} rotation={[0.08, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[asset.size[0] + 0.1, 0.15, asset.size[2] + 0.1]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Photovoltaic Cells */}
        <mesh position={[0, 0.09, 0]}>
          <boxGeometry args={[asset.size[0] - 0.2, 0.02, asset.size[2] - 0.2]} />
          <meshStandardMaterial color="#1e1b4b" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Safety perimeter railings */}
      {[-asset.size[0] / 2 - 0.12, asset.size[0] / 2 + 0.12].map((x, idx) => (
        <mesh key={idx} position={[x, -asset.size[1] / 2 + 0.4, 0]} castShadow>
          <boxGeometry args={[0.04, 0.8, asset.size[2] + 0.2]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} wireframe />
        </mesh>
      ))}
      <mesh position={[0, -asset.size[1] / 2 + 0.4, asset.size[2] / 2 + 0.12]} castShadow>
        <boxGeometry args={[asset.size[0] + 0.2, 0.8, 0.04]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} wireframe />
      </mesh>

      {/* Raised entrance stairs */}
      <group position={[-0.8, -0.4, asset.size[2] / 2 + 0.3]}>
        {[0, 1, 2, 3].map((step) => (
          <mesh key={step} position={[0, step * 0.16 - 0.2, step * 0.2]} castShadow>
            <boxGeometry args={[0.7, 0.1, 0.25]} />
            <meshStandardMaterial color="#475569" metalness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Glow windows with inset frames */}
      {[-0.6, 0.6].map((xOffset, idx) => (
        <group key={idx} position={[xOffset, 0.4, asset.size[2] / 2 + 0.01]}>
          {/* Frame */}
          <mesh castShadow>
            <boxGeometry args={[0.54, 0.42, 0.04]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          {/* Glass */}
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[0.48, 0.36, 0.03]} />
            <meshStandardMaterial
              color={isNight ? '#eab308' : '#38bdf8'}
              emissive={isNight ? '#eab308' : '#38bdf8'}
              emissiveIntensity={isNight ? 2.5 : 0.8}
            />
          </mesh>
        </group>
      ))}

      {/* Small radome dish on roof */}
      <group position={[0.7, asset.size[1] / 2 + 0.25, -0.8]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <sphereGeometry args={[0.26, 12, 12]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 0.2, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.8} />
        </mesh>
      </group>

      {/* Rooftop Industrial Air Handling Unit (HVAC) */}
      <group position={[-0.8, asset.size[1] / 2 + 0.25, -0.5]}>
        {/* Main box */}
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.4, 0.6]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Spinning fan grille */}
        <mesh ref={fanRef} position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
};
// 14. Living Pods (Triple interconnected modular polar capsules)
const LivingModule: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
}> = ({ asset, isSelected, liveStatus, onClick, isNight }) => {
  const [hovered, setHovered] = useState(false);
  const anomalySeverity = getAnomalySeverity(liveStatus);
  const podMaterialRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  useFrame((state) => {
    if (anomalySeverity === 'nominal' || isSelected || hovered) return;
    const speed = anomalySeverity === 'critical' ? 3.4 : 1.6;
    const baseIntensity = anomalySeverity === 'critical' ? 0.28 : 0.14;
    const depth = anomalySeverity === 'critical' ? 0.4 : 0.22;
    const pulse = (Math.sin(state.clock.elapsedTime * speed) + 1) / 2;
    podMaterialRefs.current.forEach((mat) => {
      if (!mat) return;
      mat.emissive.set(ANOMALY_GLOW_COLOR[anomalySeverity]);
      mat.emissiveIntensity = baseIntensity + pulse * depth;
    });
  });

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Elevated structural truss foundation legs */}
      <Stilts position={[0, 0, 0]} size={asset.size} height={0.7} />

      {/* Structural steel frame deck */}
      <mesh position={[0, -0.7, 0]} receiveShadow>
        <boxGeometry args={[asset.size[0] + 0.2, 0.12, asset.size[2] + 0.2]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Cross girder reinforcement */}
      {[-1.5, 0, 1.5].map((xOffset, i) => (
        <mesh key={i} position={[xOffset, -0.76, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, asset.size[2] + 0.2]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
      ))}

      {/* Interconnected Modular Capsules (3 side-by-side) */}
      {[-1.25, 0, 1.25].map((xOffset, podIdx) => (
        <group key={podIdx} position={[xOffset, 0, 0]}>
          {/* Main capsule cylinder */}
          <mesh
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          >
            <cylinderGeometry args={[0.62, 0.62, 1.8, 16]} />
            <meshStandardMaterial
              ref={(el) => { podMaterialRefs.current[podIdx] = el; }}
              color={asset.color}
              bumpMap={getIndustrialPanelTexture() || undefined}
              bumpScale={0.035}
              roughness={0.3}
              metalness={0.7}
              emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
              emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.3 : anomalySeverity === 'warning' ? 0.15 : 0}
            />
          </mesh>

          {/* Dome End Caps */}
          {[-0.9, 0.9].map((yOffset, capIdx) => (
            <mesh key={capIdx} position={[0, 0, yOffset]} castShadow>
              <sphereGeometry args={[0.62, 16, 16]} />
              <meshStandardMaterial
                color={asset.color}
                bumpMap={getIndustrialPanelTexture() || undefined}
                bumpScale={0.035}
                roughness={0.3}
                metalness={0.7}
              />
            </mesh>
          ))}

          {/* Circular double-glazed portholes (glowing windows) */}
          {[-0.3, 0.3].map((zOffset, winIdx) => (
            <group key={winIdx} position={[0.63, 0.1, zOffset]} rotation={[0, Math.PI / 2, 0]}>
              {/* Frame Ring */}
              <mesh castShadow>
                <torusGeometry args={[0.15, 0.03, 6, 12]} />
                <meshStandardMaterial color="#0f172a" metalness={0.8} />
              </mesh>
              {/* Glowing window glass */}
              <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.13, 0.13, 0.02, 12]} />
                <meshStandardMaterial
                  color={isNight ? '#eab308' : '#38bdf8'}
                  emissive={isNight ? '#eab308' : '#38bdf8'}
                  emissiveIntensity={isNight ? 2.2 : 0.8}
                />
              </mesh>
            </group>
          ))}

          {/* Warning beacon warning lights on top of each pod */}
          <TowerWarningLight position={[0, 0.72, 0]} color="#f97316" />
        </group>
      ))}

      {/* Accordion interconnecting bellows */}
      {[-0.625, 0.625].map((xOffset, i) => (
        <mesh key={i} position={[xOffset, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.48, 0.48, 0.28, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.6} />
        </mesh>
      ))}

      {/* Elevated tube corridor back to Admin block */}
      <mesh position={[-2.25, 0.1, 0.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 1.95, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Rooftop mechanical ventilation units */}
      <mesh position={[-0.7, asset.size[1] / 2 + 0.12, -0.2]} castShadow>
        <boxGeometry args={[0.45, 0.22, 0.45]} />
        <meshStandardMaterial color="#475569" metalness={0.7} />
      </mesh>
      <mesh position={[0.7, asset.size[1] / 2 + 0.12, -0.2]} castShadow>
        <boxGeometry args={[0.35, 0.22, 0.35]} />
        <meshStandardMaterial color="#475569" metalness={0.7} />
      </mesh>
    </group>
  );
};

// 15. Science Laboratory octagon pod cluster (High-fidelity detailed version)
const ScienceLabs: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
}> = ({ asset, isSelected, liveStatus, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const scannerRef = useRef<THREE.Group>(null);
  const anomalySeverity = getAnomalySeverity(liveStatus);
  const coreMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  useAnomalyPulse(coreMaterialRef, anomalySeverity, isSelected || hovered);

  useFrame((state) => {
    if (scannerRef.current) {
      scannerRef.current.rotation.y = state.clock.getElapsedTime() * 1.5;
    }
  });

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <Stilts position={[0, 0, 0]} size={asset.size} height={0.65} />

      {/* Main Octagonal Laboratory Core */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[asset.size[0] / 2, asset.size[0] / 2, asset.size[1], 8]} />
        <meshStandardMaterial
          ref={coreMaterialRef}
          color={asset.color}
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.035}
          roughness={0.28}
          metalness={0.72}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.35 : anomalySeverity === 'warning' ? 0.18 : 0}
        />
      </mesh>

      {/* Geodesic structural frame rings for the dome */}
      <group position={[0, asset.size[1] / 2 + 0.16, 0]}>
        {/* Observatory Glass Dome */}
        <mesh castShadow>
          <sphereGeometry args={[0.72, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#0ea5e9" metalness={0.9} roughness={0.05} transparent opacity={0.65} />
        </mesh>
        {/* Structural Torus rings */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.72, 0.03, 6, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.5, 0.02, 6, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>
      </group>

      {/* Radial Scientific Annexes (Radial Pods on sides) */}
      {[0, Math.PI * 2 / 3, Math.PI * 4 / 3].map((angle, idx) => {
        const radius = asset.size[0] / 2 + 0.2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <group key={idx} position={[x, -0.2, z]} rotation={[0, -angle, 0]}>
            {/* Small cylindrical annex container */}
            <mesh castShadow>
              <cylinderGeometry args={[0.35, 0.35, 0.9, 12]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Connection bracket */}
            <mesh position={[0, 0, -0.22]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.45]} />
              <meshStandardMaterial color="#334155" metalness={0.9} />
            </mesh>
          </group>
        );
      })}

      {/* Cryogenic Storage Canisters (small gas tanks on side) */}
      <group position={[0.9, -0.35, -0.9]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.6, 10]} />
          <meshStandardMaterial color="#0284c7" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.18, 10, 8]} />
          <meshStandardMaterial color="#0284c7" metalness={0.85} />
        </mesh>
        {/* Guard rails around canisters */}
        <mesh position={[0, 0, 0.22]}>
          <boxGeometry args={[0.42, 0.5, 0.02]} />
          <meshStandardMaterial color="#475569" metalness={0.8} wireframe />
        </mesh>
      </group>

      {/* High-tech scientific laser scanner system */}
      <group position={[0, asset.size[1] / 2 + 0.1, 0.6]}>
        {/* Support tripod brackets */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 0.3]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        {/* Rotating scanner sensor head */}
        <group ref={scannerRef} position={[0, 0.35, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.26, 0.15, 0.26]} />
            <meshStandardMaterial color="#0f172a" metalness={0.8} />
          </mesh>
          {/* Lenses */}
          <mesh position={[0, 0, 0.135]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color="#06b6d4" />
          </mesh>
        </group>
        {/* Cyan laser guide ray */}
        <mesh position={[0, 8.2, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 16.0]} />
          <meshBasicMaterial color="#06b6d4" transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Interconnecting corridor to living module */}
      <mesh position={[-2.1, 0.05, -0.1]} rotation={[0, 0.2, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 2.15, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} />
      </mesh>
    </group>
  );
};

// 16. Water Utility Annex & Subglacial Lake Pump (High-fidelity detailed version)
const WaterUtility: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
  freezeActive?: boolean;
  lowWater?: boolean;
  waterPercent?: number;
}> = ({ asset, isSelected, liveStatus: _liveStatus, onClick, isNight, freezeActive = false, lowWater = false, waterPercent = 85 }) => {
  const [hovered, setHovered] = useState(false);
  const steamRef = useRef<THREE.Points>(null);
  const waterVol = waterPercent;
  const liquidHeight = Math.max(0.1, (asset.size[1] - 0.4) * (waterVol / 100));

  useFrame(() => {
    if (steamRef.current) {
      const posAttr = steamRef.current.geometry.attributes.position;
      const count = posAttr.count;
      for (let i = 0; i < count; i++) {
        let y = posAttr.getY(i);
        y += 0.02;
        if (y > 1.2) {
          y = 0.2;
          posAttr.setX(i, (Math.random() - 0.5) * 0.1);
          posAttr.setZ(i, (Math.random() - 0.5) * 0.1);
        }
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }
  });

  const steamPositions = useMemo(() => {
    const arr = new Float32Array(15 * 3);
    for (let i = 0; i < 15; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.1;
      arr[i * 3 + 1] = Math.random() * 1.0;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    return arr;
  }, []);

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Foundation platform with steel beams */}
      <mesh position={[0, -asset.size[1] / 2 + 0.05, 0]} receiveShadow>
        <boxGeometry args={[asset.size[0] + 0.3, 0.1, asset.size[2] + 0.3]} />
        <meshStandardMaterial color="#475569" roughness={0.8} metalness={0.7} />
      </mesh>
      {/* Structural frame borders */}
      <mesh position={[0, -asset.size[1] / 2 + 0.1, asset.size[2] / 2 + 0.12]}>
        <boxGeometry args={[asset.size[0] + 0.3, 0.05, 0.04]} />
        <meshStandardMaterial color="#ea580c" metalness={0.8} />
      </mesh>

      {/* Utility Annex Pod */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[asset.size[0] - 0.4, asset.size[1], asset.size[2]]} />
        <meshStandardMaterial
          color={freezeActive ? '#0f172a' : lowWater ? '#1e3a5f' : asset.color}
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.035}
          roughness={0.35}
          metalness={0.65}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : freezeActive ? (isNight ? '#93c5fd' : '#60a5fa') : lowWater ? '#fbbf24' : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : freezeActive ? 0.35 : lowWater ? 0.2 : 0}
        />
      </mesh>

      {freezeActive && (
        <group position={[-0.2, 0.25, 0.25]}>
          <mesh position={[0.2, 0.6, 0.2]}>
            <boxGeometry args={[0.8, 0.2, 0.8]} />
            <meshStandardMaterial color="#dbeafe" emissive="#93c5fd" emissiveIntensity={0.8} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0.2, 0.75, 0.2]}>
            <boxGeometry args={[0.95, 0.08, 0.95]} />
            <meshStandardMaterial color="#e2e8f0" emissive="#bfdbfe" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        </group>
      )}

      {/* External Heat Exchanger & Vent Stack */}
      <group position={[-0.9, 0, -0.4]}>
        {/* Heat core radiator */}
        <mesh castShadow>
          <boxGeometry args={[0.35, 0.7, 0.5]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Exhaust Stack */}
        <mesh position={[0, 0.6, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.6, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.95} />
        </mesh>
        {/* Steam Particles */}
        <points ref={steamRef} position={[0, 0.8, 0]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[steamPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial color="#cbd5e1" size={0.09} transparent opacity={0.4} />
        </points>
      </group>

      {/* Double Translucent Water Tanks side-by-side */}
      {[-0.2, 0.5].map((zOffset, tIdx) => (
        <group key={tIdx} position={[1.1, 0.05, zOffset]}>
          {/* Glass Outer Cylinder */}
          <mesh castShadow>
            <cylinderGeometry args={[0.32, 0.32, 1.4, 12]} />
            <meshStandardMaterial color="#cbd5e1" transparent opacity={0.35} roughness={0.1} metalness={0.2} />
          </mesh>
          {/* Blue dynamic liquid inside */}
          <mesh position={[0, -0.7 + liquidHeight / 2, 0]}>
            <cylinderGeometry args={[0.3, 0.3, liquidHeight, 12]} />
            <meshStandardMaterial
              color={freezeActive ? '#dbeafe' : lowWater ? '#f8fafc' : '#0ea5e9'}
              transparent
              opacity={freezeActive ? 0.9 : lowWater ? 0.75 : 0.8}
              roughness={0.2}
              emissive={freezeActive ? '#93c5fd' : lowWater ? '#fbbf24' : '#000000'}
              emissiveIntensity={freezeActive ? 0.35 : lowWater ? 0.22 : 0}
            />
          </mesh>
          {/* Tank Metal Cap */}
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.33, 0.33, 0.06, 12]} />
            <meshStandardMaterial color="#475569" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Connective pipeline from tanks to building */}
      <mesh position={[0.7, 0.2, 0.15]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.6]} />
        <meshStandardMaterial color="#ea580c" metalness={0.95} />
      </mesh>
    </group>
  );
};

// 17. Logistics Warehouse Quonset Hangar (High-fidelity detailed version)
const LogisticsWarehouse: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
}> = ({ asset, isSelected, liveStatus, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const anomalySeverity = getAnomalySeverity(liveStatus);
  const roofMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  useAnomalyPulse(roofMaterialRef, anomalySeverity, isSelected || hovered);

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Foundation Platform */}
      <mesh position={[0, -asset.size[1] / 2 + 0.05, 0]} receiveShadow>
        <boxGeometry args={[asset.size[0] + 0.4, 0.1, asset.size[2] + 0.4]} />
        <meshStandardMaterial color="#475569" roughness={0.9} />
      </mesh>

      {/* Quonset Hangar Curved Arch Roof */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        rotation={[Math.PI / 2, 0, Math.PI / 2]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[asset.size[1], asset.size[1], asset.size[0], 16, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          ref={roofMaterialRef}
          color={asset.color}
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.045}
          roughness={0.45}
          metalness={0.7}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.35 : anomalySeverity === 'warning' ? 0.18 : 0}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* External Structural Support Arches (breaks up the smooth cylinder) */}
      {[-1.6, -0.8, 0, 0.8, 1.6].map((xOffset, idx) => (
        <mesh key={idx} position={[xOffset, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[asset.size[1] + 0.04, asset.size[1] + 0.04, 0.1, 16, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Hangar Rolling Bay Doors with segmented horizontal slats */}
      <group position={[0, -asset.size[1] / 2 + 0.7, asset.size[2] / 2 + 0.01]}>
        {/* Frame */}
        <mesh castShadow>
          <boxGeometry args={[2.1, 1.45, 0.06]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} />
        </mesh>
        {/* Segmented slats */}
        {[0, 1, 2, 3, 4, 5].map((slatIdx) => (
          <mesh key={slatIdx} position={[0, -0.6 + slatIdx * 0.24, 0.02]} castShadow>
            <boxGeometry args={[1.9, 0.2, 0.04]} />
            <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.75} />
          </mesh>
        ))}
      </group>

      {/* Overhead Loading Area Spot Light Bracket */}
      <group position={[0, asset.size[1] - 0.2, asset.size[2] / 2 + 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.1, 0.1, 0.3]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh position={[0, -0.1, 0.15]} rotation={[0.4, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 0.15, 8]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.7} />
        </mesh>
      </group>

      {/* Scattered metal cargo/resupply storage crates on pallets */}
      <group position={[2.3, -asset.size[1] / 2 + 0.08, -0.4]} rotation={[0, 0.35, 0]}>
        {/* Wooden pallet base */}
        <mesh castShadow>
          <boxGeometry args={[1.2, 0.1, 1.8]} />
          <meshStandardMaterial color="#78350f" roughness={0.9} />
        </mesh>
        {/* Cargo Box A */}
        <mesh position={[-0.2, 0.4, 0.2]} castShadow>
          <boxGeometry args={[0.6, 0.7, 1.2]} />
          <meshStandardMaterial color="#ea580c" roughness={0.65} />
        </mesh>
        {/* Cargo Drums B */}
        {[0.6, -0.2].map((zPos, dIdx) => (
          <group key={dIdx} position={[0.32, 0.45, zPos]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.22, 0.22, 0.8, 10]} />
              <meshStandardMaterial color="#16a34a" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.41, 0]}>
              <cylinderGeometry args={[0.23, 0.23, 0.04, 10]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.8} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// 18. Diesel Generator Unit G1-G3
// 18. Diesel Generator Unit G1-G3 (Power House building / generator clusters)
const GeneratorUnit: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
  isNight: boolean;
  emergencyMode?: boolean;
  backupActive?: boolean;
}> = ({ asset, isSelected, liveStatus, onClick, isNight, emergencyMode = false, backupActive = false }) => {
  const isRunning = liveStatus?.status === 'running' || (liveStatus?.load > 0);
  const isCritical = liveStatus?.status === 'critical' || liveStatus?.temp > 85 || emergencyMode;
  const anomalySeverity: AnomalySeverity = isCritical
    ? 'critical'
    : (liveStatus?.status === 'degraded' || (typeof liveStatus?.temp === 'number' && liveStatus.temp > 78) || (typeof liveStatus?.health === 'number' && liveStatus.health < 75))
      ? 'warning'
      : 'nominal';
  const fanRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const shellMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    if (fanRef.current && isRunning) {
      fanRef.current.rotation.y = state.clock.getElapsedTime() * 16.0;
    }
    if (shellMaterialRef.current && !isSelected && !hovered) {
      if (anomalySeverity !== 'nominal') {
        // Anomaly pulse takes priority — faster/brighter for critical so
        // severity reads at a glance across the whole 3D twin.
        const speed = anomalySeverity === 'critical' ? 3.4 : 1.6;
        const baseIntensity = anomalySeverity === 'critical' ? 0.28 : 0.14;
        const depth = anomalySeverity === 'critical' ? 0.4 : 0.22;
        const pulse = (Math.sin(state.clock.elapsedTime * speed) + 1) / 2;
        shellMaterialRef.current.emissive.set(ANOMALY_GLOW_COLOR[anomalySeverity]);
        shellMaterialRef.current.emissiveIntensity = baseIntensity + pulse * depth;
      } else if (backupActive) {
        // Backup-power pulse: distinct blue tone so an operator can see
        // backup engage ambiently without it being confused for a fault.
        const pulse = (Math.sin(state.clock.getElapsedTime() * 3) + 1) / 2;
        shellMaterialRef.current.emissive.set('#38bdf8');
        shellMaterialRef.current.emissiveIntensity = 0.15 + pulse * 0.25;
      }
    }
  });

  // Render the main large building shell for gen_2 (The Power House core)
  if (asset.id === 'gen_2') {
    return (
      <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* Foundation */}
        <Stilts position={[0, 0, 0]} size={[3.4, 1.8, 2.6]} height={0.5} />

        {/* Main Hangar shell */}
        <mesh
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.4, 1.8, 2.6]} />
          <meshStandardMaterial
            ref={shellMaterialRef}
            color="#1e293b" // dark steel blue
            bumpMap={getIndustrialPanelTexture() || undefined}
            bumpScale={0.035}
            roughness={0.4}
            metalness={0.7}
            emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : isCritical ? '#ef4444' : backupActive ? '#38bdf8' : '#000000'}
            emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : isCritical ? 0.3 : backupActive ? 0.2 : 0}
          />
        </mesh>


        {/* Industrial Structural Ribs to make Power House look robust */}
        {[-1.7, 0, 1.7].map((xOffset, idx) => (
          <mesh key={idx} position={[xOffset, 0, 0]} castShadow>
            <boxGeometry args={[0.08, 1.84, 2.66]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* Sloped Roof */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[3.5, 0.2, 2.7]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} />
        </mesh>

        {/* Front double window panels with glowing warm light */}
        {[-1.0, 1.0].map((x, idx) => (
          <mesh key={idx} position={[x, 0.2, 1.31]}>
            <boxGeometry args={[0.6, 0.4, 0.02]} />
            <meshStandardMaterial
              color={isNight ? '#eab308' : '#38bdf8'}
              emissive={isNight ? '#eab308' : '#38bdf8'}
              emissiveIntensity={isNight ? 2.5 : 0.8}
            />
          </mesh>
        ))}

        {/* Double exit/rolling industrial doors */}
        <mesh position={[0, -0.3, 1.31]} castShadow>
          <boxGeometry args={[1.0, 1.0, 0.02]} />
          <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.8} />
        </mesh>

        {/* Rooftop mechanical cowl ventilators */}
        <mesh position={[-0.8, 1.15, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0.8, 1.15, 0.2]} castShadow>
          <boxGeometry args={[0.5, 0.2, 0.5]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
    );
  }

  // Render standard orange generator units next to it for gen_1 and gen_3
  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Base slab */}
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[asset.size[0] + 0.15, 0.15, asset.size[2] + 0.15]} />
        <meshStandardMaterial color="#475569" roughness={0.9} />
      </mesh>

      {/* Compact Generator container */}
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={asset.size} />
        <meshStandardMaterial
          ref={shellMaterialRef}
          color={anomalySeverity === 'critical' ? '#ef4444' : anomalySeverity === 'warning' ? '#f59e0b' : '#ea580c'} // bright industrial orange, tinted by severity
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.03}
          roughness={0.3}
          metalness={0.7}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
          emissiveIntensity={isSelected ? 0.65 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.35 : anomalySeverity === 'warning' ? 0.18 : 0}
        />
      </mesh>

      {/* Glowing Status diagnostic screen */}
      <mesh position={[asset.size[0] / 2 + 0.015, 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color={anomalySeverity === 'critical' ? '#ef4444' : anomalySeverity === 'warning' ? '#f59e0b' : isRunning ? '#10b981' : '#64748b'} />
      </mesh>

      {/* Electrical conduit loops */}
      <mesh position={[-asset.size[0] / 2 - 0.02, -0.15, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.18, 0.03, 4, 10, Math.PI]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} />
      </mesh>

      {/* Rotating fan blade on side for ventilation */}
      <group position={[0, 0.15, asset.size[2] / 2 + 0.01]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.04, 12]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh ref={fanRef}>
          <boxGeometry args={[0.25, 0.02, 0.05]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
        </mesh>
      </group>

      {/* Exhaust stack and particles */}
      <group position={[0, asset.size[1] / 2, -0.4]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.8]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        <GeneratorSmoke position={[0, 0.8, 0]} running={isRunning} />
      </group>
    </group>
  );
};

// 19. Diesel SAB Fuel Storage Silo (High fidelity white cylinder with dome top)
const FuelTanksGroup: React.FC<{
  position: [number, number, number];
  fuelPercentage: number;
  isSelected: boolean;
  onClick: () => void;
  isNight: boolean;
  isLeaking?: boolean;
}> = ({ position, fuelPercentage, isSelected, onClick, isNight, isLeaking = false }) => {
  const [hovered, setHovered] = useState(false);
  const liquidHeight = Math.max(0.1, 2.3 * (fuelPercentage / 100));

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {/* Safety concrete bund wall */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[1.5, 1.6, 0.4, 16]} />
        <meshStandardMaterial color="#475569" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[1.42, 1.42, 0.1, 16]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>

      {/* Concrete safety stairs leading to the bund wall */}
      <group position={[0, -0.15, 1.6]} rotation={[0, 0, 0]}>
        {[0, 1, 2].map((step) => (
          <mesh key={step} position={[0, step * 0.07 - 0.1, -step * 0.1]} castShadow>
            <boxGeometry args={[0.4, 0.08, 0.2]} />
            <meshStandardMaterial color="#475569" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Fuel line valve manifold and junction */}
      <group position={[1.1, -0.15, -0.7]} rotation={[0, -Math.PI / 4, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow>
          <boxGeometry args={[0.3, 0.25, 0.3]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} />
        </mesh>
        {/* Handwheel */}
        <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.025, 4, 8]} />
          <meshStandardMaterial color="#ef4444" metalness={0.8} />
        </mesh>
      </group>

      {/* Main Fuel Storage Silo */}
      <group position={[0, 1.0, 0]}>
        {/* Translucent white cylinder */}
        <mesh
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
          castShadow
        >
          <cylinderGeometry args={[0.9, 0.9, 2.4, 20]} />
          <meshStandardMaterial
            color={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : '#cbd5e1'}
            transparent
            opacity={0.35}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>

        {/* Internal orange liquid reserve */}
        <mesh position={[0, -1.2 + liquidHeight / 2, 0]}>
          <cylinderGeometry args={[0.86, 0.86, liquidHeight, 18]} />
          <meshStandardMaterial
            color={fuelPercentage < 30 ? '#ef4444' : '#f97316'}
            emissive={fuelPercentage < 30 ? '#ef4444' : '#ea580c'}
            emissiveIntensity={isNight ? 0.8 : 0.25}
            roughness={0.4}
          />
        </mesh>

        {/* White Dome top cap */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <sphereGeometry args={[0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.8} roughness={0.3} />
        </mesh>

        {isLeaking && (
          <group position={[0, -0.4, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
              <circleGeometry args={[0.9, 32]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.35} />
            </mesh>
            <mesh position={[0, -0.25, -0.6]}>
              <cylinderGeometry args={[0.08, 0.08, 0.7, 12]} />
              <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={0.6} />
            </mesh>
          </group>
        )}

        {/* Hazard warning decal sign (emissive orange warning plane) */}
        <mesh position={[0, 0.4, 0.915]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.3, 0.25]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.4, 0.92]}>
          <boxGeometry args={[0.18, 0.05, 0.01]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Safety metal girdles (Torus rings around the silo) */}
        <mesh position={[0, -0.4, 0]}>
          <torusGeometry args={[0.92, 0.03, 6, 24]} />
          <meshStandardMaterial color="#f97316" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0.6, 0]}>
          <torusGeometry args={[0.92, 0.03, 6, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.9} />
        </mesh>

        {/* Vertical ladder structure on side */}
        <group position={[0.88, 0, 0.2]}>
          {/* Rails */}
          <mesh position={[-0.04, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 2.4]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.04, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 2.4]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Rungs */}
          {[-1.0, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8, 1.0].map((h, idx) => (
            <mesh key={idx} position={[0, h, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.08]} />
              <meshStandardMaterial color="#475569" />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
};

// 20. Default Procedural Building block
const ProceduralBuilding: React.FC<{
  asset: AssetData;
  isSelected: boolean;
  liveStatus: any;
  onClick: () => void;
}> = ({ asset, isSelected, liveStatus, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  let primaryColor = asset.color;
  let status = liveStatus?.status || 'nominal';
  const anomalySeverity = getAnomalySeverity(liveStatus);
  useAnomalyPulse(bodyMaterialRef, anomalySeverity, isSelected || hovered);

  if (status === 'critical') {
    primaryColor = '#ef4444';
  } else if (status === 'high_load' || status === 'degraded') {
    primaryColor = '#f59e0b';
  }

  if (asset.id === 'eq_water_pump') {
    const isFrozen = liveStatus?.status === 'critical';
    return (
      <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        {/* Steel stilt foundation legs */}
        <Stilts position={[0, 0, 0]} size={asset.size} height={0.4} />

        {/* Raised concrete base deck */}
        <mesh position={[0, -asset.size[1] / 2, 0]} receiveShadow>
          <boxGeometry args={[asset.size[0] + 0.1, 0.1, asset.size[2] + 0.1]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>

        {/* Cylindrical pump chamber */}
        <mesh
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
          position={[0, 0.1, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.42, 0.45, 0.8, 12]} />
          <meshStandardMaterial
            color={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : isFrozen ? '#bfdbfe' : '#0284c7'}
            metalness={isFrozen ? 0.2 : 0.85}
            roughness={isFrozen ? 0.05 : 0.2}
          />
        </mesh>

        {/* Intricate pump valves & gears */}
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.26, 0.26, 0.12, 10]} />
          <meshStandardMaterial color={isFrozen ? '#dbeafe' : '#1e293b'} metalness={0.9} />
        </mesh>

        {/* Suction piping diving under the snow */}
        <mesh position={[-0.32, -0.4, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.7]} />
          <meshStandardMaterial color={isFrozen ? '#e2e8f0' : '#ea580c'} metalness={0.9} roughness={0.3} />
        </mesh>

        {/* Discharge pipe going up and back */}
        <mesh position={[0.2, 0.35, -0.22]} rotation={[Math.PI / 2, 0, -Math.PI / 6]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.6]} />
          <meshStandardMaterial color={isFrozen ? '#f1f5f9' : '#0284c7'} metalness={0.9} />
        </mesh>

        {/* Flashing diagnostic dome light */}
        <TowerWarningLight position={[0, 0.6, 0]} color={isFrozen ? '#ef4444' : '#06b6d4'} />

        {/* Frozen Water Ice blockage visual indicators (puddle, frosted encasing structure, icicles) */}
        {isFrozen && (
          <group position={[0, -0.2, 0]}>
            {/* Frozen puddle on concrete deck */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
              <circleGeometry args={[1.1, 32]} />
              <meshStandardMaterial
                color="#bfdbfe"
                emissive="#60a5fa"
                emissiveIntensity={0.6}
                transparent
                opacity={0.7}
                roughness={0.05}
              />
            </mesh>
            {/* Ice block encasing pump */}
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.55, 0.58, 0.95, 12]} />
              <meshStandardMaterial
                color="#e0f2fe"
                emissive="#93c5fd"
                emissiveIntensity={0.4}
                transparent
                opacity={0.65}
                roughness={0.05}
                metalness={0.1}
              />
            </mesh>
            {/* Dripping icicles (frozen coned indicators) */}
            {[[-0.38, 0.38], [0.38, 0.38], [0, -0.38]].map(([x, z], i) => (
              <mesh key={i} position={[x, 0.1, z]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.04, 0.3, 4]} />
                <meshStandardMaterial color="#ffffff" emissive="#bfdbfe" emissiveIntensity={0.5} transparent opacity={0.8} />
              </mesh>
            ))}
          </group>
        )}
      </group>
    );
  }

  return (
    <group position={asset.position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
        receiveShadow
      >
        <boxGeometry args={asset.size} />
        <meshStandardMaterial
          ref={bodyMaterialRef}
          color={primaryColor}
          bumpMap={getIndustrialPanelTexture() || undefined}
          bumpScale={0.03}
          roughness={0.4}
          metalness={0.5}
          emissive={isSelected ? '#38bdf8' : hovered ? '#0ea5e9' : anomalySeverity !== 'nominal' ? ANOMALY_GLOW_COLOR[anomalySeverity] : '#000000'}
          emissiveIntensity={isSelected ? 0.7 : hovered ? 0.4 : anomalySeverity === 'critical' ? 0.35 : anomalySeverity === 'warning' ? 0.18 : 0}
        />
      </mesh>

      {/* Industrial framing structure */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[asset.size[0] + 0.04, asset.size[1] + 0.04, asset.size[2] + 0.04]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.3} wireframe />
      </mesh>

      {/* Flashing hazard beacon */}
      <TowerWarningLight position={[0, asset.size[1] / 2 + 0.05, 0]} color="#f59e0b" />
    </group>
  );
};

// 21. Dynamic Blizzard Storm Snow Particles
const SnowstormEffect: React.FC<{ active: boolean; windSpeed: number }> = ({ active, windSpeed }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 500;
  const positions = useRef(new Float32Array(particleCount * 3));

  useEffect(() => {
    for (let i = 0; i < particleCount; i++) {
      positions.current[i * 3] = (Math.random() - 0.5) * 45;
      positions.current[i * 3 + 1] = Math.random() * 20;
      positions.current[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const geometry = pointsRef.current.geometry;
    const posAttr = geometry.attributes.position;
    if (!posAttr) return;

    // Fast horizontal wind speed during blizzard storms
    const fallSpeed = active ? 8.0 : 2.5;
    const windForce = active ? (windSpeed * 0.18) : 0.5;

    for (let i = 0; i < particleCount; i++) {
      let y = posAttr.getY(i);
      let x = posAttr.getX(i);
      let z = posAttr.getZ(i);

      y -= fallSpeed * delta * 5;
      x -= windForce * delta * (Math.random() * 0.5 + 0.85);

      if (y < 0) {
        y = 20;
        x = (Math.random() - 0.5) * 45 + 12;
        z = (Math.random() - 0.5) * 45;
      }

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.14} transparent opacity={active ? 0.9 : 0.3} sizeAttenuation />
    </points>
  );
};

// 22. StreetLight post casting warm pools of yellow light
const StreetLight: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {/* Light Pole */}
      <mesh castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.6]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Light fixture arm */}
      <mesh position={[0.08, 0.8, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.25]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>
      {/* Light bulb head */}
      <mesh position={[0.2, 0.76, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      {/* Volumetric light scattering cone for atmospheric mist */}
      <mesh position={[0.2, 0.76 - 0.8, 0]}>
        <coneGeometry args={[0.6, 1.6, 16, 1, true]} />
        <meshBasicMaterial
          color="#fef08a"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Dynamic spot light casting pool of light on snow */}
      <spotLight
        position={[0.2, 0.72, 0]}
        angle={Math.PI / 3.6}
        penumbra={0.65}
        intensity={3.2}
        distance={7.5}
        color="#fef08a"
        castShadow
        shadow-bias={-0.001}
      />
    </group>
  );
};

// 23. Additive Blending Waving Aurora Borealis (Southern Lights) in background
const AuroraBorealis: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);

  const auroraTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 256, 0, 0);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      grad.addColorStop(0.18, 'rgba(16, 185, 129, 0.9)'); // bright emerald green base
      grad.addColorStop(0.55, 'rgba(6, 182, 212, 0.7)'); // cyan mid curtains
      grad.addColorStop(0.85, 'rgba(168, 85, 247, 0.45)'); // purple top fringes
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      const geo = meshRef.current.geometry as THREE.PlaneGeometry;
      const pos = geo.attributes.position;
      const time = state.clock.getElapsedTime();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // Animate wave vertices to create green curtain movement
        const wave = Math.sin(x * 0.06 + time * 0.4) * 2.2 + Math.cos(y * 0.08 + time * 0.6) * 0.8;
        pos.setZ(i, wave);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 20, -50]} rotation={[0.22, 0, 0]}>
      <planeGeometry args={[160, 24, 40, 6]} />
      <meshBasicMaterial
        map={auroraTexture}
        transparent
        opacity={0.38}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  telemetry,
  selectedAssetId,
  onAssetSelect,
  activeScenario = 'none',
  emergencyMode = false,
  isNight: isNightProp = false,
}) => {
  const [webglSupported, setWebglSupported] = useState(true);
  const [isNight, setIsNight] = useState(isNightProp);
  const [controlsMode, setControlsMode] = useState<'orbit' | 'pan'>('orbit');

  useEffect(() => {
    setIsNight(isNightProp);
  }, [isNightProp]);

  // Retain texture caches in memory across tab switches to avoid re-rendering textures

  const assets: AssetData[] = [
    { id: 'bld_admin', name: 'Administration & Control Core', type: 'box', position: [-2.5, 1.25, -2.5], size: [2.5, 2.5, 3], color: '#1e293b', telemetryField: 'bld_admin' },
    { id: 'bld_living', name: 'Living Quarters (Residential)', type: 'box', position: [2.5, 0.75, -1.8], size: [3.8, 1.5, 2.4], color: '#334155', telemetryField: 'bld_living' },
    { id: 'bld_labs', name: 'Science Labs Module', type: 'cylinder', position: [-8.5, 1.25, 0.5], size: [2.4, 2.5, 2.4], color: '#475569', telemetryField: 'bld_labs' },
    { id: 'bld_utility', name: 'Water & Utility Annex', type: 'box', position: [0.0, 1.0, 5.0], size: [2.2, 2, 2.2], color: '#0ea5e9', telemetryField: 'bld_utility' },
    { id: 'gen_1', name: 'Diesel Generator G1 (Main)', type: 'generator', position: [-3.5, 0.65, 3.5], size: [1.0, 1.1, 1.6], color: '#f97316', telemetryField: 'gen_1' },
    { id: 'gen_2', name: 'Diesel Generator G2 (Auxiliary)', type: 'generator', position: [-5.5, 0.65, 4.0], size: [1.0, 1.1, 1.6], color: '#eab308', telemetryField: 'gen_2' },
    { id: 'gen_3', name: 'Diesel Generator G3 (Emergency)', type: 'generator', position: [-1.5, 0.65, 3.5], size: [1.0, 1.1, 1.6], color: '#ef4444', telemetryField: 'gen_3' },
    { id: 'fuel_storage', name: 'Diesel Storage Tanks (SAB)', type: 'fuel_storage', position: [8.0, 1, 0.5], size: [2.0, 2.0, 2.0], color: '#cbd5e1', telemetryField: 'fuel_storage' },
    { id: 'eq_satellite', name: 'Primary SATCOM Dish Tower', type: 'tower', position: [-8.0, 0, -4.0], size: [1.2, 4, 1.2], color: '#cbd5e1', telemetryField: 'eq_satellite' },
    { id: 'bld_weather', name: 'Meteorological Sensor Array', type: 'tower', position: [6.0, 0, -5.5], size: [1, 3, 1], color: '#94a3b8', telemetryField: 'bld_weather' },
    { id: 'eq_water_pump', name: 'Subglacial Lake Intake Unit', type: 'box', position: [-11.5, 0.5, 1.0], size: [1.2, 1, 1.2], color: '#0284c7', telemetryField: 'eq_water_pump' },
    { id: 'bld_warehouse', name: 'Warehouse & Spares Depot', type: 'box', position: [7.0, 1, 4.2], size: [3.8, 2, 3.6], color: '#4b5563', telemetryField: 'bld_warehouse' }
  ];

  const [cameraTargetPos, setCameraTargetPos] = useState<THREE.Vector3>(() => new THREE.Vector3(0, 14, 20));
  const [cameraTargetLook, setCameraTargetLook] = useState<THREE.Vector3>(() => new THREE.Vector3(0, 0, 1));

  // Sync selection focus coordinates
  useEffect(() => {
    if (!selectedAssetId) return;

    const foundAsset = assets.find(a => a.id === selectedAssetId);
    if (foundAsset) {
      const aPos = foundAsset.position;
      setCameraTargetPos(new THREE.Vector3(aPos[0], aPos[1] + 3.8, aPos[2] + 4.8));
      setCameraTargetLook(new THREE.Vector3(...aPos));
    }
  }, [selectedAssetId]);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const supported = !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
      setWebglSupported(supported);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  const getLiveStatus = (asset: AssetData) => {
    if (!telemetry) return null;
    if (asset.id.startsWith('gen_')) {
      return telemetry.generators.find((g: any) => g.id === asset.id);
    }
    if (asset.id.startsWith('eq_')) {
      return telemetry.equipment.find((e: any) => e.id === asset.id);
    }
    return telemetry.buildings.find((b: any) => b.id === asset.id);
  };

  const handleAssetClick = (asset: AssetData) => {
    const liveStatus = getLiveStatus(asset);
    onAssetSelect({ ...asset, liveStatus });
    const aPos = asset.position;
    setCameraTargetPos(new THREE.Vector3(aPos[0], aPos[1] + 3.8, aPos[2] + 4.8));
    setCameraTargetLook(new THREE.Vector3(...aPos));
  };

  if (!webglSupported) {
    return (
      <div className="h-full w-full bg-slate-950 p-6 flex flex-col justify-between border border-slate-800 rounded-lg glow-blue font-mono relative overflow-y-auto">
        <div>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <span className="text-sky-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              Station Schematic 2D Vector Twin (WebGL Fallback)
            </span>
            <span className="text-slate-500 text-xs">ONLINE SCHEMATIC CONTROLS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {assets.map((asset) => {
              const liveStatus = getLiveStatus(asset);
              const isSelected = selectedAssetId === asset.id;
              let statusBorder = isSelected ? 'border-sky-500 glow-blue' : 'border-slate-800';
              let statusBg = isSelected ? 'bg-sky-950/30' : 'bg-slate-900/40 hover:bg-slate-900/90';
              return (
                <button
                  key={asset.id}
                  onClick={() => handleAssetClick(asset)}
                  className={`p-4 border rounded text-left transition-all ${statusBorder} ${statusBg} flex flex-col justify-between h-28`}
                >
                  <div className="font-bold text-xs uppercase tracking-wider line-clamp-1 text-slate-200">{asset.name}</div>
                  <div className="flex items-center justify-between mt-2 text-xs border-t border-slate-800/40 pt-1.5 w-full text-slate-400">
                    <span>Temp: {liveStatus?.temp ? `${Math.round(liveStatus.temp)}°C` : 'N/A'}</span>
                    <span>Load: {liveStatus?.load !== undefined ? `${liveStatus.load} kW` : 'N/A'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const fuelPercentage = telemetry ? (telemetry.resources.fuel / telemetry.resources.fuelCapacity) * 100 : 75;
  const satcomStatus = telemetry ? (telemetry.equipment.find((e: any) => e.id === 'eq_satellite')?.status || 'nominal') : 'nominal';
  const windSpeedValue = telemetry ? telemetry.weather.windSpeed : 25;
  const isBlizzard = activeScenario === 'snowstorm' || windSpeedValue > 55;

  return (
    <div className="h-full w-full bg-slate-950/70 border border-slate-800/80 rounded-lg overflow-hidden relative glow-blue flex flex-col min-h-[400px]">
      {/* Dynamic angled leader line animation style */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes dash {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}} />

      {/* Viewport Top Actions bar */}
      <div className="absolute top-3 left-3 z-10 flex gap-2.5 items-center flex-wrap">
        <div className="bg-slate-950/90 border border-slate-800 p-2 px-3 rounded flex items-center gap-2 font-mono text-xs text-sky-400 backdrop-blur-sm pointer-events-none">
          <span className={`h-2.5 w-2.5 rounded-full ${emergencyMode ? 'bg-red-500 animate-ping' : 'bg-sky-500 animate-pulse'}`}></span>
          <span>INTERACTIVE DIGITAL TWIN: 3D WEBGL ACTIVE</span>
        </div>

        <button
          onClick={() => setIsNight(!isNight)}
          className="bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-[10px] text-slate-300 p-2 px-3 rounded font-mono font-bold uppercase transition-all hover:text-sky-400 backdrop-blur-sm cursor-pointer"
        >
          {isNight ? '☼ Polar Day' : '☾ Polar Night'}
        </button>
      </div>

      {/* Floating presets */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5 flex-wrap max-w-[280px] justify-end">
        {[
          { label: 'Overview', assetId: 'overview' },
          { label: 'Power Grid', assetId: 'gen_2' },
          { label: 'Habitat', assetId: 'bld_living' },
          { label: 'Science', assetId: 'bld_labs' },
          { label: 'Comms', assetId: 'eq_satellite' },
          { label: 'Logistics', assetId: 'bld_warehouse' },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => {
              if (p.assetId === 'overview') {
                setCameraTargetPos(new THREE.Vector3(0, 14, 20));
                setCameraTargetLook(new THREE.Vector3(0, 0, 1));
                onAssetSelect(null);
                return;
              }

              const found = assets.find(a => a.id === p.assetId);
              if (found) {
                handleAssetClick(found);
              }
            }}
            className="bg-slate-950/90 hover:bg-sky-600 hover:text-white border border-slate-800 text-[9px] text-slate-300 p-1 px-2 rounded font-mono font-bold uppercase transition-all backdrop-blur-sm cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Viewport Container */}
      <div className="flex-1 w-full h-full relative overflow-hidden select-none bg-slate-950">
        <Canvas
          camera={{ position: [0, 14, 20], fov: 42 }}
          shadows
          dpr={[1, 1.5]}
          gl={{ powerPreference: 'high-performance', antialias: true, alpha: false }}
        >
          <WebGL3DScene
            isNight={isNight}
            selectedAssetId={selectedAssetId}
            assets={assets}
            telemetry={telemetry}
            satcomStatus={satcomStatus}
            emergencyMode={emergencyMode}
            windSpeedValue={windSpeedValue}
            isBlizzard={isBlizzard}
            handleAssetClick={handleAssetClick}
            fuelPercentage={fuelPercentage}
          />

          <CameraController targetPos={cameraTargetPos} targetLook={cameraTargetLook} />
          <CompassController />

          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            minDistance={4}
            maxDistance={35}
            maxPolarAngle={Math.PI / 1.95}
            mouseButtons={{
              LEFT: controlsMode === 'orbit' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: controlsMode === 'orbit' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE
            }}
          />
        </Canvas>

        {/* Floating HUD Compass Dial */}
        <div className="absolute bottom-4 right-4 z-10 bg-slate-950/90 border border-slate-800 p-2 rounded-full h-16 w-16 flex items-center justify-center backdrop-blur-sm pointer-events-none select-none">
          <div id="compass-dial-needle" className="relative w-full h-full rounded-full transition-transform duration-75 flex items-center justify-center">
            <span className="absolute -top-2 text-[9px] font-mono text-red-500 font-bold">N</span>
            <span className="absolute -bottom-2 text-[9px] font-mono text-slate-400 font-bold">S</span>
            <span className="absolute -left-2 text-[9px] font-mono text-slate-400 font-bold">W</span>
            <span className="absolute -right-2 text-[9px] font-mono text-slate-400 font-bold">E</span>
            <div className="w-0.5 h-10 bg-gradient-to-b from-red-500 to-slate-600 relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-red-500 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* HUD control controls bar */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-6 bg-slate-950/90 border border-slate-800/80 p-2.5 px-6 rounded-lg backdrop-blur-md shadow-2xl select-none text-slate-400 font-mono text-[9px] border-b-2 border-b-sky-500/80">
          <button
            onClick={() => setControlsMode('orbit')}
            className={`flex flex-col items-center gap-1 transition-all hover:text-sky-400 cursor-pointer ${controlsMode === 'orbit' ? 'text-sky-400 font-bold scale-105' : ''}`}
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>ORBIT</span>
          </button>

          <button
            onClick={() => setControlsMode('pan')}
            className={`flex flex-col items-center gap-1 transition-all hover:text-sky-400 cursor-pointer ${controlsMode === 'pan' ? 'text-sky-400 font-bold scale-105' : ''}`}
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
            <span>PAN</span>
          </button>

          <button
            onClick={() => {
              // Zoom camera in towards looking target
              const dir = new THREE.Vector3().subVectors(cameraTargetLook, cameraTargetPos).normalize();
              const dist = cameraTargetPos.distanceTo(cameraTargetLook);
              if (dist > 4) {
                setCameraTargetPos(new THREE.Vector3().copy(cameraTargetPos).addScaledVector(dir, 2.5));
              }
            }}
            className="flex flex-col items-center gap-1 transition-all hover:text-sky-400 active:scale-95 cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span>ZOOM IN</span>
          </button>

          <button
            onClick={() => {
              // Zoom camera out from looking target
              const dir = new THREE.Vector3().subVectors(cameraTargetLook, cameraTargetPos).normalize();
              const dist = cameraTargetPos.distanceTo(cameraTargetLook);
              if (dist < 32) {
                setCameraTargetPos(new THREE.Vector3().copy(cameraTargetPos).addScaledVector(dir, -2.5));
              }
            }}
            className="flex flex-col items-center gap-1 transition-all hover:text-sky-400 active:scale-95 cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <span>ZOOM OUT</span>
          </button>

          <button
            onClick={() => {
              if (selectedAssetId) {
                const found = assets.find(a => a.id === selectedAssetId);
                if (found) {
                  const aPos = found.position;
                  setCameraTargetPos(new THREE.Vector3(aPos[0], aPos[1] + 3.8, aPos[2] + 4.8));
                  setCameraTargetLook(new THREE.Vector3(...aPos));
                }
              }
            }}
            className={`flex flex-col items-center gap-1 transition-all hover:text-sky-400 cursor-pointer ${selectedAssetId ? 'text-emerald-400 font-bold' : 'opacity-40 cursor-not-allowed'}`}
            disabled={!selectedAssetId}
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>FOCUS</span>
          </button>

          <button
            onClick={() => {
              setCameraTargetPos(new THREE.Vector3(0, 14, 20));
              setCameraTargetLook(new THREE.Vector3(0, 0, 1));
              setControlsMode('orbit');
              onAssetSelect(null);
            }}
            className="flex flex-col items-center gap-1 transition-all hover:text-sky-400 active:scale-95 cursor-pointer"
          >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>RESET</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface WebGL3DSceneProps {
  isNight: boolean;
  selectedAssetId: string | null;
  assets: AssetData[];
  telemetry: any;
  satcomStatus: string;
  emergencyMode: boolean;
  windSpeedValue: number;
  isBlizzard: boolean;
  handleAssetClick: (asset: AssetData) => void;
  fuelPercentage: number;
}

const WebGL3DScene: React.FC<WebGL3DSceneProps> = ({
  isNight,
  selectedAssetId,
  assets,
  telemetry,
  satcomStatus,
  emergencyMode,
  windSpeedValue,
  isBlizzard,
  handleAssetClick,
  fuelPercentage,
}) => {
  const getLiveStatus = (asset: AssetData) => {
    if (!telemetry) return null;
    if (asset.id.startsWith('gen_')) {
      return telemetry.generators.find((g: any) => g.id === asset.id);
    }
    if (asset.id.startsWith('eq_')) {
      return telemetry.equipment.find((e: any) => e.id === asset.id);
    }
    return telemetry.buildings.find((b: any) => b.id === asset.id);
  };

  const waterFreezeActive = telemetry?.activeScenario === 'water_shortage' || (telemetry?.resources?.waterDays ?? 99) <= 5 || (telemetry?.equipment?.find((e: any) => e.id === 'eq_water_pump')?.status ?? 'nominal') === 'critical';

  return (
    <group>
      <fog attach="fog" args={[isBlizzard ? (isNight ? '#0b1329' : '#cbd5e1') : (isNight ? '#090d16' : '#e2e8f0'), isBlizzard ? 10 : 25, isBlizzard ? 30 : 55]} />

      <ambientLight intensity={isNight ? 0.12 : emergencyMode ? 0.35 : 0.6} color={isNight ? '#1e293b' : emergencyMode ? '#ef4444' : '#ffffff'} />

      <directionalLight
        position={[25, 18, 15]}
        intensity={isNight ? 0.08 : 1.7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
        shadow-camera-near={0.1}
        shadow-camera-far={100}
        color={isNight ? '#38bdf8' : emergencyMode ? '#f87171' : '#f0f9ff'}
      />

      {emergencyMode && (
        <pointLight position={[0, 4, 0]} color="#ef4444" intensity={2.0} distance={18} />
      )}

      <pointLight position={[-15, 6, -10]} intensity={isNight ? 0.15 : 0.4} color="#e0f2fe" />

      <AntarcticTerrain isNight={isNight} />
      <AntarcticMountains isNight={isNight} />
      <Helipad />
      <PistenBullyVehicle />
      <WavingIndianFlag position={[1.0, 0.22, -4.5]} />

      {/* Street Lights */}
      <StreetLight position={[-2.5, 0.5, -2.0]} />
      <StreetLight position={[2.5, 0.5, -1.8]} />
      <StreetLight position={[-8.5, 0.5, 0.5]} />
      <StreetLight position={[6.0, 0.5, -4.5]} />
      <StreetLight position={[7.0, 0.5, 3.5]} />
      <StreetLight position={[-5.0, 0.5, 3.0]} />

      {/* Aurora Borealis */}
      <AuroraBorealis />

      {/* Pipelines */}
      <PipeBridge start={[8.0, 0.6, 0.5]} end={[-5.5, 0.6, 4.0]} color="#ea580c" flowColor="#ea580c" flowActive={true} />
      <PipeBridge start={[-11.5, 0.4, 1.0]} end={[0.0, 0.5, 5.0]} color={waterFreezeActive ? '#f8fafc' : '#0284c7'} flowColor={waterFreezeActive ? '#fbbf24' : '#38bdf8'} flowActive={!waterFreezeActive} />
      <PipeBridge start={[-5.5, 0.5, 4.0]} end={[-2.5, 0.7, -2.5]} color="#4b5563" flowColor="#f59e0b" flowActive={true} />

      {/* Infrastructure modules */}
      {assets.map((asset) => {
        const isSelected = selectedAssetId === asset.id;
        const liveStatus = getLiveStatus(asset);

        let labelName = '';
        let statusText = 'NORMAL';
        let statusColor = 'text-emerald-400';
        let statusDotBg = 'bg-emerald-500';
        let statusPulse = false;

        if (asset.id === 'eq_satellite') {
          labelName = 'SATELLITE DISH';
          statusText = satcomStatus === 'nominal' ? 'ONLINE' : 'DEGRADED';
          statusColor = satcomStatus === 'nominal' ? 'text-emerald-400' : 'text-amber-500 animate-pulse';
          statusDotBg = satcomStatus === 'nominal' ? 'bg-emerald-500' : 'bg-amber-500';
          statusPulse = satcomStatus !== 'nominal';
        } else if (asset.id === 'bld_weather') {
          labelName = 'COMM TOWER';
          statusText = 'ONLINE';
        } else if (asset.id === 'bld_admin') {
          labelName = 'ADMIN BLOCK';
          statusText = emergencyMode ? 'LOCKDOWN' : 'NORMAL';
          statusColor = emergencyMode ? 'text-red-400' : 'text-emerald-400';
          statusDotBg = emergencyMode ? 'bg-red-500' : 'bg-emerald-500';
          statusPulse = emergencyMode;
        } else if (asset.id === 'bld_living') {
          labelName = 'HABITAT BLOCK';
          statusText = 'NORMAL';
        } else if (asset.id === 'fuel_storage') {
          labelName = 'FUEL STORAGE';
          const daysLeft = telemetry ? telemetry.resources.fuelDays : 31;
          statusText = `${daysLeft} DAYS LEFT`;
          statusColor = daysLeft < 30 ? 'text-red-400 animate-pulse' : 'text-orange-400';
          statusDotBg = daysLeft < 30 ? 'bg-red-500' : 'bg-orange-500';
          statusPulse = daysLeft < 30;
        } else if (asset.id === 'bld_labs') {
          labelName = 'RESEARCH LAB';
          statusText = 'NORMAL';
        } else if (asset.id === 'gen_2') {
          labelName = 'POWER HOUSE';
          statusText = emergencyMode ? 'OVERLOAD' : 'NORMAL';
          statusColor = emergencyMode ? 'text-red-400' : 'text-emerald-400';
          statusDotBg = emergencyMode ? 'bg-red-500' : 'bg-emerald-500';
        } else if (asset.id === 'bld_utility') {
          labelName = 'WATER TREATMENT';
          const waterDays = telemetry ? telemetry.resources.waterDays : 42;
          statusText = `${waterDays} DAYS LEFT`;
          statusColor = waterDays < 15 ? 'text-red-400 animate-pulse' : 'text-blue-400';
          statusDotBg = waterDays < 15 ? 'bg-red-500' : 'bg-blue-500';
          statusPulse = waterDays < 15;
        }

        let assetComponent = null;

        if (asset.id.startsWith('gen_')) {
          assetComponent = (
            <GeneratorUnit
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
              emergencyMode={emergencyMode || telemetry?.activeScenario === 'water_shortage' || (telemetry?.resources?.waterDays ?? 99) <= 5}
              backupActive={telemetry?.powerGrid?.backupActive || telemetry?.activeScenario === 'water_shortage' || (telemetry?.resources?.waterDays ?? 99) <= 5}
            />
          );
        } else if (asset.id === 'fuel_storage') {
          assetComponent = (
            <FuelTanksGroup
              position={asset.position}
              fuelPercentage={fuelPercentage}
              isSelected={isSelected}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
              isLeaking={telemetry?.activeScenario === 'fuel_shortage' || (telemetry?.resources?.fuelDays ?? 999) < 15}
            />
          );
        } else if (asset.id === 'bld_admin') {
          assetComponent = (
            <AdminCore
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
              emergencyMode={emergencyMode}
            />
          );
        } else if (asset.id === 'bld_living') {
          assetComponent = (
            <LivingModule
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
            />
          );
        } else if (asset.id === 'bld_labs') {
          assetComponent = (
            <ScienceLabs
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
            />
          );
        } else if (asset.id === 'bld_utility') {
          const waterDays = telemetry?.resources?.waterDays ?? 99;
          const waterVolume = telemetry?.resources?.water ?? 12000;
          const waterCapacity = telemetry?.resources?.waterCapacity ?? 20000;
          const utilityFreezeActive = telemetry?.activeScenario === 'water_shortage' || waterDays <= 5 || (telemetry?.equipment?.find((e: any) => e.id === 'eq_water_pump')?.status ?? 'nominal') === 'critical';
          const utilityLowWater = waterDays <= 15 || (waterVolume / waterCapacity) <= 0.45;
          const utilityWaterPercent = Math.max(12, Math.min(100, (Math.min(waterVolume / waterCapacity, 1) * 100)));
          assetComponent = (
            <WaterUtility
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
              freezeActive={utilityFreezeActive}
              lowWater={utilityLowWater}
              waterPercent={utilityWaterPercent}
            />
          );
        } else if (asset.id === 'bld_warehouse') {
          assetComponent = (
            <LogisticsWarehouse
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
              isNight={isNight}
            />
          );
        } else if (asset.id === 'eq_satellite') {
          assetComponent = (
            <group onClick={() => handleAssetClick(asset)}>
              <SatcomDish position={asset.position} status={satcomStatus} />
              {isSelected && (
                <mesh position={[asset.position[0], asset.position[1] + 4.5, asset.position[2]]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.18, 0.35, 4]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
              )}
              <TowerWarningLight position={[asset.position[0], asset.position[1] + 4.0, asset.position[2]]} />
            </group>
          );
        } else if (asset.id === 'bld_weather') {
          assetComponent = (
            <group onClick={() => handleAssetClick(asset)}>
              <CommTower position={asset.position} windSpeed={windSpeedValue} />
              {isSelected && (
                <mesh position={[asset.position[0], asset.position[1] + 5.2, asset.position[2]]} rotation={[Math.PI, 0, 0]}>
                  <coneGeometry args={[0.18, 0.35, 4]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
              )}
              <TowerWarningLight position={[asset.position[0], asset.position[1] + 4.4, asset.position[2]]} />
            </group>
          );
        } else {
          assetComponent = (
            <ProceduralBuilding
              asset={asset}
              isSelected={isSelected}
              liveStatus={liveStatus}
              onClick={() => handleAssetClick(asset)}
            />
          );
        }

        return (
          <group key={asset.id}>
            {assetComponent}
            {labelName && (
              <Html
                distanceFactor={11}
                position={[asset.position[0], asset.position[1] + asset.size[1] / 2 + 0.8, asset.position[2]]}
                center
              >
                <div className="relative font-mono pointer-events-none select-none" style={{ width: '150px', height: '80px' }}>
                  <svg className="absolute overflow-visible top-0 left-0" style={{ transform: 'translate(75px, 40px)' }} width="100" height="100">
                    <line x1="0" y1="0" x2="30" y2="-25" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="3,3" opacity="0.85" />
                    <circle cx="0" cy="0" r="2.5" fill="#38bdf8" />
                  </svg>

                  <div
                    className="absolute bg-slate-950/90 border border-sky-900/60 rounded px-2.5 py-1.5 shadow-2xl backdrop-blur-md flex flex-col"
                    style={{
                      left: '105px',
                      top: '15px',
                      transform: 'translate(-50%, -50%)',
                      minWidth: '115px',
                      borderLeft: '3px solid #38bdf8'
                    }}
                  >
                    <span className="text-[9px] font-extrabold text-slate-200 tracking-wider uppercase">{labelName}</span>
                    <span className={`text-[8px] font-bold mt-0.5 flex items-center gap-1.5 uppercase ${statusColor}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDotBg} ${statusPulse ? 'animate-pulse' : ''}`}></span>
                      {statusText}
                    </span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      <SnowstormEffect active={isBlizzard} windSpeed={windSpeedValue} />
    </group>
  );
};

