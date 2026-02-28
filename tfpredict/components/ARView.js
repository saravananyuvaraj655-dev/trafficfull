import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";

/* ================= KALMAN FILTER ================= */

class KalmanFilter {
  constructor({ R = 0.0003, Q = 0.0000003 } = {}) {
    this.R = R;
    this.Q = Q;
    this.cov = NaN;
    this.x = NaN;
  }

  filter(z) {
    if (isNaN(this.x)) {
      this.x = z;
      this.cov = this.R;
    } else {
      const predCov = this.cov + this.Q;
      const K = predCov / (predCov + this.R);
      this.x = this.x + K * (z - this.x);
      this.cov = (1 - K) * predCov;
    }
    return this.x;
  }
}

/* ================= GEO HELPERS ================= */

const R = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const haversine = (a, b) => {
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

const bearing = (p1, p2) => {
  const lat1 = toRad(p1[0]);
  const lat2 = toRad(p2[0]);
  const dLon = toRad(p2[1] - p1[1]);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) *
      Math.cos(lat2) *
      Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/* ================= CAR ICON ================= */

const carIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;background:#2196f3;border-radius:50%;border:3px solid white;"></div>`,
  iconSize: [18, 18],
  className: "",
});

/* ================= MINI MAP FOLLOW ================= */

const SmoothFollow = ({ userPos, heading }) => {
  const map = useMap();

  useEffect(() => {
    if (!userPos) return;
    map.setView(userPos, 17, { animate: true });
  }, [userPos]);

  useEffect(() => {
    const container = map.getContainer();
    container.style.transformOrigin = "center center";
    container.style.transition = "transform 0.3s linear";
    container.style.transform = `rotate(${-heading}deg)`;
  }, [heading]);

  return null;
};

/* ================= AR VIEW ================= */

const ARView = ({ route, eta, stopAR }) => {
  const videoRef = useRef(null);
  const mountRef = useRef(null);
  const arrowRef = useRef(null);
  const streamRef = useRef(null);
  const animationRef = useRef(null);

  const latFilter = useRef(new KalmanFilter());
  const lonFilter = useRef(new KalmanFilter());

  const [userPos, setUserPos] = useState(null);
  const [heading, setHeading] = useState(0);
  const [turnText, setTurnText] = useState("Go Straight");
  const [distanceToTurn, setDistanceToTurn] = useState(0);
  const [remainingRoute, setRemainingRoute] = useState([]);
  const [nextTurnPoint, setNextTurnPoint] = useState(null);
  const [remainingDistance, setRemainingDistance] = useState(0);

  /* ================= CAMERA ================= */

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
      });

    return () =>
      streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /* ================= GPS (MINIMAP SAFE VERSION) ================= */

  useEffect(() => {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;

        const smoothLat = latFilter.current.filter(latitude);
        const smoothLon = lonFilter.current.filter(longitude);

        setUserPos((prev) => {
          // Always allow first position
          if (!prev) return [smoothLat, smoothLon];

          // Ignore extreme bad signal after first lock
          if (accuracy > 80) return prev;

          const movement = haversine(prev, [smoothLat, smoothLon]);

          // Ignore tiny drift
          if (movement < 6) return prev;

          return [smoothLat, smoothLon];
        });
      },
      console.error,
      {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  /* ================= COMPASS ================= */

  useEffect(() => {
    const handle = (event) => {
      if (event.alpha !== null) {
        setHeading((prev) =>
          prev * 0.85 + (360 - event.alpha) * 0.15
        );
      }
    };
    window.addEventListener("deviceorientation", handle);
    return () =>
      window.removeEventListener("deviceorientation", handle);
  }, []);

  /* ================= THREE ARROW ================= */

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    const shape = new THREE.Shape();
    shape.moveTo(0, 2);
    shape.lineTo(1.2, 0.5);
    shape.lineTo(0.5, 0.5);
    shape.lineTo(0.5, -2);
    shape.lineTo(-0.5, -2);
    shape.lineTo(-0.5, 0.5);
    shape.lineTo(-1.2, 0.5);
    shape.lineTo(0, 2);

    const geometry = new THREE.ShapeGeometry(shape);
    const material = new THREE.MeshBasicMaterial({
      color: 0x2196f3,
      transparent: true,
      opacity: 0,
    });

    const arrow = new THREE.Mesh(geometry, material);
    arrow.position.set(0, 0, -6);
    scene.add(arrow);
    arrowRef.current = arrow;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationRef.current);
      renderer.dispose();
    };
  }, []);

  /* ================= TURN LOGIC ================= */

 useEffect(() => {
  if (!userPos || !route?.length || !arrowRef.current) return;

  let closestIndex = 0;
  let minDist = Infinity;

  route.forEach((p, i) => {
    const d = haversine(userPos, p);
    if (d < minDist) {
      minDist = d;
      closestIndex = i;
    }
  });

  const slicedRoute = route.slice(closestIndex);
  setRemainingRoute([userPos, ...slicedRoute]);

  // Remaining distance
  let total = 0;
  total += haversine(userPos, route[closestIndex]);
  for (let i = closestIndex; i < route.length - 1; i++) {
    total += haversine(route[i], route[i + 1]);
  }
  setRemainingDistance(total);

  const nextPoint = route[closestIndex + 1];
  if (!nextPoint) {
    arrowRef.current.material.opacity = 0;
    return;
  }

  setNextTurnPoint(nextPoint);

  const dist = haversine(userPos, nextPoint);
  setDistanceToTurn(dist);

  const routeBearing = bearing(userPos, nextPoint);
  let relativeAngle = routeBearing - heading;
  relativeAngle = ((relativeAngle + 540) % 360) - 180;

  // 🔥 Only show arrow under 50m
  if (dist <= 50) {
    arrowRef.current.material.opacity = 1;

    if (relativeAngle > 40) {
      setTurnText("Turn Right");
      arrowRef.current.rotation.z = -Math.PI / 2;
    } 
    else if (relativeAngle < -40) {
      setTurnText("Turn Left");
      arrowRef.current.rotation.z = Math.PI / 2;
    } 
    else {
      setTurnText("Go Straight");
      arrowRef.current.rotation.z = 0;
    }

  } else {
    // Hide arrow when far
    arrowRef.current.material.opacity = 0;
    setTurnText("Go Straight");
  }

}, [userPos, heading, route]);

  /* ================= UI ================= */

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: -1,
        }}
      />

      <div ref={mountRef} style={{ position: "fixed", inset: 0 }} />

      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          padding: "14px 18px",
          borderRadius: 14,
        }}
      >
        <p>📏 {Math.floor(distanceToTurn)} m</p>
        <p>🧭 {turnText}</p>
        <p>📍 {(remainingDistance / 1000).toFixed(2)} km</p>
        <p>⏱ ETA {(eta ?? 0).toFixed(1)} min</p>
      </div>

      {userPos && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 20,
            width: 200,
            height: 200,
            borderRadius: 14,
            overflow: "hidden",
            zIndex: 999,
          }}
        >
          <MapContainer
            center={userPos}
            zoom={17}
            style={{ height: "100%", width: "100%" }}
            dragging={false}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <SmoothFollow userPos={userPos} heading={heading} />
            {remainingRoute.length > 1 && (
              <Polyline
                positions={remainingRoute}
                pathOptions={{ color: "#1976d2", weight: 6 }}
              />
            )}
            {nextTurnPoint && (
              <CircleMarker
                center={nextTurnPoint}
                radius={8}
                pathOptions={{
                  color: "orange",
                  fillColor: "yellow",
                  fillOpacity: 1,
                }}
              />
            )}
            <Marker position={userPos} icon={carIcon} />
          </MapContainer>
        </div>
      )}

      <button
        onClick={stopAR}
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          padding: "10px 14px",
          background: "#ff4d4d",
          color: "#fff",
          border: "none",
          borderRadius: 10,
        }}
      >
        Exit AR
      </button>
    </>
  );
};

export default ARView;
