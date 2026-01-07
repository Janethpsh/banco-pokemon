// backend/src/app.js
import express from "express";
import cors from "cors";

import authRoutes from "./auth/routes.js";
import accountRoutes from "./account/routes.js";
import beneficiariesRoutes from "./beneficiaries/routes.js";
import transfersRoutes from "./transfers/routes.js";

const app = express();

// ✅ Permite llamadas desde Live Server (127.0.0.1:5500)
app.use(cors());

// ✅ Para leer JSON en req.body
app.use(express.json());

// Rutas
app.use("/auth", authRoutes);
app.use("/account", accountRoutes);
app.use("/beneficiaries", beneficiariesRoutes);
app.use("/transfers", transfersRoutes);

export default app;
