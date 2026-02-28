"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import ARView from "./ARView";

let L;
if (typeof window !== "undefined") {
  L = require("leaflet");
}

/* ================= GEO HELPERS ================= */

const haversine = (a, b) => {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) *
      Math.cos(toRad(b[0])) *
      Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
};

const getClosestIndex = (route, carPos) => {
  let minIndex = 0;
  let minDistance = Infinity;

  route.forEach((p, i) => {
    const d = haversine(p, carPos);
    if (d < minDistance) {
      minDistance = d;
      minIndex = i;
    }
  });

  return minIndex;
};

/* ================= MAP HELPERS ================= */

function AutoZoom({ coords, startNav }) {
  const map = useMap();
  useEffect(() => {
    if (!coords?.length || startNav) return;
    map.fitBounds(coords, { padding: [60, 60] });
  }, [coords, startNav, map]);
  return null;
}

function FollowCar({ pos }) {
  const map = useMap();
  useEffect(() => {
    if (!pos) return;
    map.flyTo(pos, 18, { duration: 0.7 });
  }, [pos, map]);
  return null;
}

/* ================= MAIN COMPONENT ================= */

export default function RouteMap({
  best,
  viewMode,
  startNav,
  arMode,
  stopAR,
  startName,
  endName,
}) {
  const [iconsReady, setIconsReady] = useState(false);
  const [icons, setIcons] = useState({});
  const [routeData, setRouteData] = useState(best);
  const [carPos, setCarPos] = useState(null);
  const [selectedInfo, setSelectedInfo] = useState(null);

  const routes = routeData?.routes || [];
  const bestIndex = routeData?.best_route_index ?? 0;
  const activeRoute = routes[bestIndex];
  const weather = routeData?.weather;

  /* ICON SETUP */
  useEffect(() => {
    if (!L) return;

    delete L.Icon.Default.prototype._getIconUrl;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    setIcons({
      startIcon: new L.Icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        iconSize: [32, 32],
      }),
      endIcon: new L.Icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        iconSize: [32, 32],
      }),
      carIcon: new L.Icon({
        iconUrl: "https://maps.google.com/mapfiles/kml/shapes/cabs.png",
        iconSize: [36, 36],
      }),
    });

    setIconsReady(true);
  }, []);

  useEffect(() => {
    setRouteData(best);
  }, [best]);

  const fullRoute = useMemo(() => {
    if (!activeRoute?.coordinates) return [];
    return activeRoute.coordinates.map((c) => [c[1], c[0]]);
  }, [activeRoute]);

  /* GPS */
  useEffect(() => {
    if (!startNav) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setCarPos([pos.coords.latitude, pos.coords.longitude]),
      console.error,
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [startNav]);

  const remainingRoute = useMemo(() => {
    if (!startNav || !carPos || !fullRoute.length)
      return fullRoute;
    const index = getClosestIndex(fullRoute, carPos);
    return [carPos, ...fullRoute.slice(index)];
  }, [carPos, startNav, fullRoute]);

  if (!iconsReady) return null;

  if (arMode && fullRoute.length) {
    return (
      <ARView
        route={fullRoute}
        eta={activeRoute?.duration_min}
        stopAR={stopAR}
      />
    );
  }

  const getWeatherIcon = (c) => {
    if (c === "Rain") return "🌧";
    if (c === "Clouds") return "☁";
    if (c === "Clear") return "☀";
    return "🌤";
  };

  return (
    <>
      <MapContainer
        center={[11.0168, 76.9558]}
        zoom={12}
        style={{ height: "75vh" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <AutoZoom coords={fullRoute} startNav={startNav} />

        {/* ROUTES */}
        {viewMode === "all" &&
          routes.map((route, i) => {
            const coords =
              route.coordinates?.map((c) => [c[1], c[0]]) || [];
            return (
              <Polyline
                key={i}
                positions={coords}
                color={i === bestIndex ? "#1abd24" : "#3584c4"}
                weight={i === bestIndex ? 8 : 5}
                eventHandlers={{
                  click: () =>
                    setSelectedInfo({
                      title:
                        i === bestIndex
                          ? "Best Route"
                          : `Alt Route ${i + 1}`,
                      lines: [
                        `📏 ${route.distance_km} km`,
                        `⏱ ${route.duration_min} min`,
                        `🚦 ${route.avg_traffic}%`,
                      ],
                    }),
                }}
              />
            );
          })}

        {viewMode === "best" && !startNav && (
          <Polyline positions={fullRoute} color="#1abd24" weight={8} />
        )}

        {startNav && remainingRoute.length > 1 && (
          <Polyline positions={remainingRoute} color="#0d47a1" weight={8} />
        )}

        {fullRoute.length > 0 && (
          <>
            <Marker position={fullRoute[0]} icon={icons.startIcon} />
            <Marker
              position={fullRoute[fullRoute.length - 1]}
              icon={icons.endIcon}
            />
          </>
        )}

        {carPos && startNav && (
          <>
            <Marker position={carPos} icon={icons.carIcon}>
              <Popup>🚗 Live Navigation</Popup>
            </Marker>
            <FollowCar pos={carPos} />
          </>
        )}
      </MapContainer>

           {/* WEATHER CARD */}
      {weather && (
        <div
          style={{
            position: "fixed",
            top: 100,
            left: 20,
            background: "#fff",
            padding: 15,
            borderRadius: 12,
            boxShadow: "0 6px 16px rgba(0,0,0,0.2)",
            zIndex: 99999,
          }}
        >
          <h4>
            {getWeatherIcon(weather.condition)} {weather.condition}
          </h4>
          <p>🌡 {weather.temperature}°C</p>
          <p>🌧 Rain: {weather.rain} mm</p>
        </div>
      )}

      {/* ETA + REMAINING DISTANCE CARD */}
      {activeRoute && startNav && (
        <div
          style={{
            position: "fixed",
            top: 100,
            right: 20,
            background: "#0d47a1",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: 12,
            boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
            zIndex: 99999,
          }}
        >
          <p>📏 Remaining: {activeRoute.distance_km ?? 0} km</p>
          <p>⏱ ETA: {activeRoute.duration_min ?? 0} min</p>
        </div>
      )}

      {/* INFO CARD */}
      {selectedInfo && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            width: 300,
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            zIndex: 99999,
          }}
        >
          <h3>{selectedInfo.title}</h3>

          {selectedInfo.lines?.map((line, i) => (
            <p key={i}>{line}</p>
          ))}

          <button
            onClick={() => setSelectedInfo(null)}
            style={{
              marginTop: 10,
              padding: "6px 12px",
              border: "none",
              background: "#1976d2",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}
    </>
  );
}