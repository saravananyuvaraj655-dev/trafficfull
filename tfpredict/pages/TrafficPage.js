"use client";
import React, { useState, useEffect, useRef } from "react";

import axios from "axios";
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import dynamic from "next/dynamic";
import debounce from "lodash/debounce";
import RouteForm from "../components/RouteForm";

/* ================= DYNAMIC MAP ================= */
const RouteMap = dynamic(() => import("../components/RouteMap"), {
  ssr: false,
});

/* ================= ENV API ================= */
const API_BASE = "https://gumptionless-iconoclastically-addison.ngrok-free.dev";

const TrafficPage = () => {
  /* ================= CORE STATE ================= */
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startCoords, setStartCoords] = useState(null);

  const [bestRoute, setBestRoute] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [travelMode, setTravelMode] = useState("driving");

  const [viewMode, setViewMode] = useState("all"); // "all" | "best"
  const [startNav, setStartNav] = useState(false);
  const [arMode, setArMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lastRequestRef = useRef(null);
  const modeChangeCooldown = useRef(false);

  /* ================= AREA SUGGESTIONS ================= */
  const fetchAreaSuggestions = async (input) => {
    if (!input) return;

    try {
      const res = await axios.get(`${API_BASE}/api/area-suggestions/`, {
        params: { q: input },
      });
      setSuggestions(res.data?.suggestions || []);
    } catch (err) {
      console.error("Suggestion error:", err);
    }
  };

  const debouncedSuggest = useRef(
    debounce((val) => fetchAreaSuggestions(val), 400)
  ).current;

  useEffect(() => {
    return () => debouncedSuggest.cancel();
  }, [debouncedSuggest]);

  /* ================= ROUTE API ================= */
  const callBestRouteAPI = async (payload, resetNav = true) => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.post(
        `${API_BASE}/api/best-route/`,
        payload
      );

      if (!res.data) throw new Error("Invalid route response");

      setBestRoute(res.data);

      // Always default to show all routes after fetching
      setViewMode("all");

      if (resetNav) {
        setStartNav(false);
        setArMode(false);
      }
    } catch (err) {
      console.error("Route API error:", err);
      setError("Failed to fetch route. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ================= FIND ROUTE ================= */
  const fetchBestRoute = () => {
    if (!start || !end) {
      setError("Please enter start and destination.");
      return;
    }

    const payload = {
      start: startCoords
        ? `${startCoords.lat},${startCoords.lng}`
        : start,
      end,
      mode: travelMode,
    };

    lastRequestRef.current = payload;
    callBestRouteAPI(payload, true);
    setSuggestions([]);
  };

  /* ================= MODE CHANGE ================= */
  useEffect(() => {
    if (!lastRequestRef.current || modeChangeCooldown.current) return;

    modeChangeCooldown.current = true;

    const updatedPayload = {
      ...lastRequestRef.current,
      mode: travelMode,
    };

    lastRequestRef.current = updatedPayload;
    callBestRouteAPI(updatedPayload, false);

    setTimeout(() => {
      modeChangeCooldown.current = false;
    }, 800);
  }, [travelMode]);

  /* ================= LIVE GPS ================= */
  const getLiveLocation = () => {
    if (!navigator.geolocation) {
      setError("GPS not supported in this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStartCoords({ lat: latitude, lng: longitude });

        try {
          const res = await axios.get(
            "https://nominatim.openstreetmap.org/reverse",
            {
              params: {
                lat: latitude,
                lon: longitude,
                format: "json",
              },
              headers: { "User-Agent": "traffic-app" },
            }
          );

          const addr = res.data?.address || {};
          const display =
            addr.road ||
            addr.neighbourhood ||
            addr.suburb ||
            addr.city ||
            "Current Location";

          setStart(display);
        } catch {
          setStart("Current Location");
        }
      },
      () => setError("Location permission denied."),
      { enableHighAccuracy: true }
    );
  };

  /* ================= START ROUTE ================= */
  const handleStartRoute = () => {
    setViewMode("best");
    setStartNav(true);
    setArMode(false);
  };

  /* ================= START AR ================= */
  const handleStartAR = () => {
    setViewMode("best");
    setStartNav(true);

    setTimeout(() => {
      setArMode(true);
    }, 200);
  };

  /* ================= UI ================= */
  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Coimbatore Smart Route Navigator
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={getLiveLocation}>
          📍 Use Live GPS Location
        </Button>
      </Box>

      <Paper elevation={3} sx={{ p: 2 }}>
        <RouteForm
          start={start}
          end={end}
          setStart={setStart}
          setEnd={setEnd}
          onSubmit={fetchBestRoute}
          suggestions={suggestions}
          onSearchChange={(v) => debouncedSuggest(v)}
        />
      </Paper>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {/* Travel Mode */}
      <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
        {["driving", "walking", "truck"].map((mode) => (
          <Button
            key={mode}
            variant={travelMode === mode ? "contained" : "outlined"}
            onClick={() => setTravelMode(mode)}
          >
            {mode === "driving" && "🚗 Car"}
            {mode === "walking" && "🚶 Walk"}
            {mode === "truck" && "🏍️ Bike"}
          </Button>
        ))}
      </Box>

      {/* Navigation Controls */}
      <Box sx={{ mt: 2, display: "flex", gap: 2 }}>
        <Button
          variant="contained"
          disabled={!bestRoute}
          onClick={() => {
            setViewMode("all");
            setStartNav(false);
            setArMode(false);
          }}
        >
          🛣 Show All Routes
        </Button>

        <Button
          variant="contained"
          color="success"
          disabled={!bestRoute}
          onClick={() => {
            setViewMode("best");
            setStartNav(false);
            setArMode(false);
          }}
        >
          🚦 Show Best Route
        </Button>

        <Button
          variant="contained"
          color="secondary"
          disabled={!bestRoute}
          onClick={handleStartRoute}
        >
          ▶ Start Route
        </Button>

        <Button
          variant="contained"
          color="warning"
          disabled={!bestRoute}
          onClick={handleStartAR}
        >
          🧭 Start AR
        </Button>
      </Box>

      <Box sx={{ mt: 3, height: "75vh" }}>
        <RouteMap
          best={bestRoute}
          viewMode={viewMode}
          startNav={startNav}
          arMode={arMode}
          stopAR={() => setArMode(false)}
        />
      </Box>
    </Container>
  );
};

export default TrafficPage;
