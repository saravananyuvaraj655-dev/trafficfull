import axios from "axios";

const API = axios.create({
  baseURL: "http://127.0.0.1:8000/api",
});

export const fetchBestRoute = (start, end) =>
  API.post("/best-route/", { start, end });
