"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const router = useRouter();

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(true);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstall(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => console.log("Service Worker Registered"));
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    await deferredPrompt.userChoice;

    setDeferredPrompt(null);
    setShowInstall(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🚦 Traffic Prediction System</h1>

        <p style={styles.subtitle}>
          Smart Route Navigation with Real-Time Traffic Updates
        </p>

        <button
          style={styles.button}
          onClick={() => router.push("/TrafficPage")}
        >
          🧭 Start Navigation
        </button>

        {showInstall && (
          <button
            style={styles.installButton}
            onClick={handleInstallClick}
          >
            📲 Install App
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #0d47a1, #1976d2)",
  },
  card: {
    background: "#ffffff",
    padding: "40px",
    borderRadius: "20px",
    textAlign: "center",
    boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
    width: "350px",
  },
  title: {
    marginBottom: "15px",
    color: "#0d47a1",
  },
  subtitle: {
    marginBottom: "25px",
    color: "#555",
  },
  button: {
    padding: "12px 25px",
    fontSize: "16px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    marginBottom: "15px",
  },
  installButton: {
    padding: "10px 20px",
    fontSize: "14px",
    backgroundColor: "#43a047",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
  },
};