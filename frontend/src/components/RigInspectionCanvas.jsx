import {
    forwardRef,
    useImperativeHandle,
    useRef
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';

const SEVERITY_COLORS = {
    LOW: '#2563eb',
    MEDIUM: '#d97706',
    HIGH: '#ea580c',
    CRITICAL: '#dc2626'
};

function clickHandler(meshZone, onZoneClick) {
    return (event) => {
        event.stopPropagation();
        if (event.delta && event.delta > 5) return;
        const { x, y, z } = event.point;
        onZoneClick({
            mesh_zone: meshZone,
            pos_x: Number(x.toFixed(4)),
            pos_y: Number(y.toFixed(4)),
            pos_z: Number(z.toFixed(4))
        });
    };
}

function FallbackRigMeshes({ vehicleRole, onZoneClick }) {
    if (vehicleRole === 'TRACTOR') {
        return (
            <group>
                <mesh
                    position={[0, 1.35, 1.2]}
                    onClick={clickHandler('cab_engine_bay', onZoneClick)}
                >
                    <boxGeometry args={[2.3, 2.1, 2.2]} />
                    <meshStandardMaterial color="#334155" />
                </mesh>
                <mesh
                    position={[0, 0.75, -1.2]}
                    onClick={clickHandler('chassis_fifth_wheel', onZoneClick)}
                >
                    <boxGeometry args={[1.4, 0.45, 4.2]} />
                    <meshStandardMaterial color="#475569" />
                </mesh>
                {[-1.2, 1.2].map((x, index) => (
                    <mesh
                        key={x}
                        position={[x, 0.55, 1.7]}
                        rotation={[0, 0, Math.PI / 2]}
                        onClick={clickHandler(
                            index === 0 ? 'front_left_hub' : 'front_right_hub',
                            onZoneClick
                        )}
                    >
                        <cylinderGeometry args={[0.55, 0.55, 0.35, 20]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                ))}
            </group>
        );
    }

    return (
        <group>
            <mesh
                position={[0, 1.25, 0]}
                onClick={clickHandler('trailer_deck_frame', onZoneClick)}
            >
                <boxGeometry args={[2.45, 0.35, 8.2]} />
                <meshStandardMaterial color="#334155" />
            </mesh>
            {[-2.8, -1.5, -0.2].map((z, axleIndex) =>
                [-1.22, 1.22].map((x, sideIndex) => (
                    <mesh
                        key={`${axleIndex}-${sideIndex}`}
                        position={[x, 0.55, z]}
                        rotation={[0, 0, Math.PI / 2]}
                        onClick={clickHandler(
                            `axle_${axleIndex + 1}_${sideIndex === 0 ? 'left' : 'right'}_brake`,
                            onZoneClick
                        )}
                    >
                        <cylinderGeometry args={[0.55, 0.55, 0.38, 20]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                ))
            )}
        </group>
    );
}

function SceneContent({
    vehicleRole,
    pins,
    onPlacePin,
    onSelectPin,
    snapshotRef
}) {
    const { gl, scene, camera } = useThree();

    useImperativeHandle(
        snapshotRef,
        () => ({
            captureDataUrl: () => {
                gl.render(scene, camera);
                return gl.domElement.toDataURL('image/png');
            }
        }),
        [camera, gl, scene]
    );

    const handleZoneClick = ({ mesh_zone, pos_x, pos_y, pos_z }) => {
        onPlacePin({
            vehicle_role: vehicleRole,
            mesh_zone,
            pos_x,
            pos_y,
            pos_z
        });
    };
    const visiblePins = pins.filter((pin) => pin.vehicle_role === vehicleRole);

    return (
        <>
            <ambientLight intensity={0.85} />
            <directionalLight position={[6, 10, 6]} intensity={1.25} />
            <gridHelper args={[16, 16, '#334155', '#1e293b']} />

            <FallbackRigMeshes
                vehicleRole={vehicleRole}
                onZoneClick={handleZoneClick}
            />

            {visiblePins.map((pin) => (
                <mesh
                    key={pin.id}
                    position={[
                        Number(pin.pos_x),
                        Number(pin.pos_y),
                        Number(pin.pos_z)
                    ]}
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelectPin(pin);
                    }}
                >
                    <sphereGeometry args={[0.14, 16, 16]} />
                    <meshStandardMaterial
                        color={SEVERITY_COLORS[pin.severity] || '#f59e0b'}
                    />
                    <Html distanceFactor={10}>
                        <div className="rounded bg-slate-900/90 px-2 py-0.5 text-[11px] font-medium text-white whitespace-nowrap shadow">
                            {pin.mesh_zone} ({pin.stage})
                        </div>
                    </Html>
                </mesh>
            ))}

            <OrbitControls makeDefault enableDamping />
        </>
    );
}

const RigInspectionCanvas = forwardRef(function RigInspectionCanvas(
    { vehicleRole, pins, onPlacePin, onSelectPin },
    ref
) {
    const snapshotRef = useRef(null);

    useImperativeHandle(
        ref,
        () => ({
            captureSnapshotDataUrl: () =>
                snapshotRef.current?.captureDataUrl() || null
        }),
        []
    );

    return (
        <div className="h-[380px] w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
            <Canvas
                dpr={[1, 2]}
                camera={{ position: [5.5, 4.2, 6.5], fov: 45 }}
                gl={{ preserveDrawingBuffer: true }}
            >
                <SceneContent
                    vehicleRole={vehicleRole}
                    pins={pins}
                    onPlacePin={onPlacePin}
                    onSelectPin={onSelectPin}
                    snapshotRef={snapshotRef}
                />
            </Canvas>
        </div>
    );
});

export default RigInspectionCanvas;
