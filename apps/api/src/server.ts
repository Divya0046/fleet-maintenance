import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth";
import protectedRouter from "./routes/protected";
import vehiclesRouter from "./routes/vehicles";
import servicesRouter from "./routes/services";
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/api/vehicles", vehiclesRouter);
app.use("/api/services", servicesRouter);
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "fleet-maintenance-api",
  });
});

app.use("/api/auth", authRouter);
//app.use("/api/auth", authRouter);
app.use("/api/protected", protectedRouter);
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});